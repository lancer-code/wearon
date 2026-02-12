import crypto from 'node:crypto'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { logger } from '../logger'
import { pushGenerationTask } from '../services/redis-queue'
import { router, protectedProcedure } from '../trpc'
import { TASK_PAYLOAD_VERSION } from '../types/queue'
import type { GenerationTaskPayload } from '../types/queue'

// Default system prompt for virtual try-on with OpenAI GPT Image 1.5
const DEFAULT_SYSTEM_PROMPT = `Virtual try-on: Using the provided images:
- First image: Model (person to dress)
- Second image (if provided): Outfit/clothes
- Additional images (if provided): Accessories

Generate a single portrait photo of the model wearing all provided items.

Requirements:
- Preserve the model's exact face, skin tone, hair, body
- Natural clothing fit with realistic draping
- Place accessories correctly (watch→wrist, necklace→neck, hat→head)
- Professional fashion photography, natural lighting
- Output ONE portrait (3:4 ratio)`

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
            })
          )
          .optional(),
        ageVerified: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new Error('Unauthorized')
      }

      // MEDIUM #1 FIX + LOW #4 FIX: Log age verification failures for COPPA compliance and provide specific error
      if (input.ageVerified !== true) {
        logger.warn(
          {
            userId: ctx.user.id,
            ageVerified: input.ageVerified,
            event: 'age_verification_failed_b2c',
          },
          '[COPPA] B2C user failed age verification - access blocked'
        )

        throw new TRPCError({
          code: 'FORBIDDEN',
          message:
            'You must be 13 or older to use this feature. Age verification is required for COPPA compliance.',
        })
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
        logger.error({ user_id: userId, error: deductError }, 'Credit deduction error')
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
          status: 'queued',
          model_image_url: input.modelImageUrl,
          outfit_image_url: input.outfitImageUrl,
          accessories: input.accessories || [],
          prompt_system: DEFAULT_SYSTEM_PROMPT,
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

      // Build image_urls array: model first, outfit second, accessories after
      const imageUrls: string[] = [input.modelImageUrl]
      if (input.outfitImageUrl) {
        imageUrls.push(input.outfitImageUrl)
      }
      if (input.accessories) {
        for (const accessory of input.accessories) {
          imageUrls.push(accessory.url)
        }
      }

      const taskPayload: GenerationTaskPayload = {
        taskId: crypto.randomUUID(),
        channel: 'b2c',
        userId,
        sessionId,
        imageUrls,
        prompt: DEFAULT_SYSTEM_PROMPT,
        requestId: `req_${crypto.randomUUID()}`,
        version: TASK_PAYLOAD_VERSION,
        createdAt: new Date().toISOString(),
      }

      // Push to Redis queue
      try {
        await pushGenerationTask(taskPayload)

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
          status: 'queued',
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

        // Note: TRPC doesn't have SERVICE_UNAVAILABLE code, using TIMEOUT as closest match
        // HTTP status will be 408, but message clearly indicates unavailability
        throw new TRPCError({
          code: 'TIMEOUT',
          message: 'Generation service temporarily unavailable. Please try again later.',
        })
      }
    }),

  getById: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
      })
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

      return data
    }),

  getHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
        offset: z.number().int().min(0).default(0),
        status: z.enum(['queued', 'processing', 'completed', 'failed']).optional(),
      })
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
      .in('status', ['queued', 'processing'])

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
