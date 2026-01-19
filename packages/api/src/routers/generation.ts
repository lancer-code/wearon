import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { addGenerationJob, getJobStatus } from '../services/queue'

// Default system prompt for virtual try-on (max 1024 chars for Grok API)
const DEFAULT_SYSTEM_PROMPT = `Virtual try-on: Generate a photorealistic image of the person wearing the provided outfit and accessories.

INPUT: Collage with LEFT=model photo, CENTER=accessories, RIGHT=outfit items.

OUTPUT: Single portrait photo of the model wearing ALL items. Requirements:
- Maintain exact appearance (face, body, skin tone, hair)
- Natural clothing fit with realistic draping
- Place accessories correctly (watch on wrist, necklace on neck, etc.)
- Realistic lighting and shadows
- Professional fashion photo quality
- Portrait orientation (3:4 ratio)

Do NOT output the collage - only the dressed model.`

export const generationRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        modelImageUrl: z.string().url(),
        outfitImageUrl: z.string().url().optional(),
        accessories: z
          .array(
            z.object({
              type: z.string(),
              url: z.string().url(),
            }),
          )
          .optional(),
        promptUser: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new Error('Unauthorized')
      }

      const userId = ctx.user.id

      // Check if user has sufficient credits
      const { data: creditsData, error: creditsError } = await ctx.supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', userId)
        .single()

      if (creditsError || !creditsData) {
        throw new Error('Failed to fetch user credits')
      }

      if (creditsData.balance < 1) {
        throw new Error('Insufficient credits. You need at least 1 credit to generate an image.')
      }

      // Deduct 1 credit
      const { data: deductResult, error: deductError } = await ctx.supabase.rpc('deduct_credits', {
        p_user_id: userId,
        p_amount: 1,
        p_description: 'Virtual try-on generation',
      })

      if (deductError) {
        console.error('Credit deduction error:', deductError)
        throw new Error(`Failed to deduct credits: ${deductError.message}`)
      }

      if (deductResult === false) {
        throw new Error('Insufficient credits. You need at least 1 credit to generate an image.')
      }

      // Create generation session record
      const { data: sessionData, error: sessionError } = await ctx.supabase
        .from('generation_sessions')
        .insert({
          user_id: userId,
          status: 'pending',
          model_image_url: input.modelImageUrl,
          outfit_image_url: input.outfitImageUrl,
          accessories: input.accessories || [],
          prompt_system: DEFAULT_SYSTEM_PROMPT,
          prompt_user: input.promptUser,
          credits_used: 1,
        })
        .select('id')
        .single()

      if (sessionError || !sessionData) {
        // Refund credits on error
        await ctx.supabase.rpc('refund_credits', {
          p_user_id: userId,
          p_amount: 1,
          p_description: 'Generation session creation failed - refund',
        })
        throw new Error('Failed to create generation session')
      }

      const sessionId = sessionData.id

      // Add job to queue
      try {
        await addGenerationJob({
          sessionId,
          userId,
          modelImageUrl: input.modelImageUrl,
          outfitImageUrl: input.outfitImageUrl,
          accessories: input.accessories,
          promptSystem: DEFAULT_SYSTEM_PROMPT,
          promptUser: input.promptUser,
        })

        // Log analytics event
        await ctx.supabase.from('analytics_events').insert({
          event_type: 'generation_started',
          user_id: userId,
          metadata: {
            session_id: sessionId,
            has_outfit: !!input.outfitImageUrl,
            accessories_count: input.accessories?.length || 0,
          },
        })

        return {
          sessionId,
          status: 'pending',
          message: 'Generation job queued successfully',
        }
      } catch (error) {
        // Refund credits and update session status on queue error
        await ctx.supabase.rpc('refund_credits', {
          p_user_id: userId,
          p_amount: 1,
          p_description: 'Queue error - refund',
        })

        await ctx.supabase
          .from('generation_sessions')
          .update({ status: 'failed', error_message: 'Failed to queue job' })
          .eq('id', sessionId)

        throw new Error('Failed to queue generation job')
      }
    }),

  getById: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new Error('Unauthorized')
      }

      const { data, error } = await ctx.supabase
        .from('generation_sessions')
        .select('*')
        .eq('id', input.sessionId)
        .eq('user_id', ctx.user.id)
        .single()

      if (error || !data) {
        throw new Error('Generation session not found')
      }

      // Also get job status from queue for active jobs
      if (data.status === 'pending' || data.status === 'processing') {
        const jobStatus = await getJobStatus(input.sessionId)
        return {
          ...data,
          jobStatus,
        }
      }

      return data
    }),

  getHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
        offset: z.number().int().min(0).default(0),
        status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new Error('Unauthorized')
      }

      let query = ctx.supabase
        .from('generation_sessions')
        .select('*')
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false })

      if (input.status) {
        query = query.eq('status', input.status)
      }

      const { data, error } = await query.range(input.offset, input.offset + input.limit - 1)

      if (error) {
        throw new Error(error.message)
      }

      return data
    }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      throw new Error('Unauthorized')
    }

    // Get total generations count
    const { count: totalCount, error: countError } = await ctx.supabase
      .from('generation_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', ctx.user.id)

    // Get completed generations count
    const { count: completedCount, error: completedError } = await ctx.supabase
      .from('generation_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', ctx.user.id)
      .eq('status', 'completed')

    // Get pending/processing count
    const { count: activeCount, error: activeError } = await ctx.supabase
      .from('generation_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', ctx.user.id)
      .in('status', ['pending', 'processing'])

    if (countError || completedError || activeError) {
      throw new Error('Failed to fetch generation statistics')
    }

    return {
      total: totalCount || 0,
      completed: completedCount || 0,
      active: activeCount || 0,
      failed: (totalCount || 0) - (completedCount || 0) - (activeCount || 0),
    }
  }),
})
