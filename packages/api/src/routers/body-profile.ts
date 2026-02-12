import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { protectedProcedure, router } from '../trpc'

const saveProfileInputSchema = z.object({
  heightCm: z.number().min(100).max(250),
  weightKg: z.number().positive().optional(),
  bodyType: z.string().min(1).max(100).optional(),
  fitPreference: z.string().min(1).max(100).optional(),
  gender: z.string().min(1).max(50).optional(),
  estChestCm: z.number().positive().optional(),
  estWaistCm: z.number().positive().optional(),
  estHipCm: z.number().positive().optional(),
  estShoulderCm: z.number().positive().optional(),
  source: z.enum(['manual', 'user_input']).optional(),
})

const updateFromSizeRecInputSchema = z.object({
  heightCm: z.number().min(100).max(250),
  bodyType: z.string().min(1).max(100).optional(),
  estChestCm: z.number().positive().optional(),
  estWaistCm: z.number().positive().optional(),
  estHipCm: z.number().positive().optional(),
  estShoulderCm: z.number().positive().optional(),
})

function mapBodyProfile(data: Record<string, unknown>) {
  return {
    heightCm: data.height_cm as number,
    weightKg: (data.weight_kg as number | null) ?? null,
    bodyType: (data.body_type as string | null) ?? null,
    fitPreference: (data.fit_preference as string | null) ?? null,
    gender: (data.gender as string | null) ?? null,
    estChestCm: (data.est_chest_cm as number | null) ?? null,
    estWaistCm: (data.est_waist_cm as number | null) ?? null,
    estHipCm: (data.est_hip_cm as number | null) ?? null,
    estShoulderCm: (data.est_shoulder_cm as number | null) ?? null,
    source: data.source as string,
    createdAt: (data.created_at as string | null) ?? null,
    updatedAt: (data.updated_at as string | null) ?? null,
  }
}

export const bodyProfileRouter = router({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('user_body_profiles')
      .select(
        [
          'height_cm',
          'weight_kg',
          'body_type',
          'fit_preference',
          'gender',
          'est_chest_cm',
          'est_waist_cm',
          'est_hip_cm',
          'est_shoulder_cm',
          'source',
          'created_at',
          'updated_at',
        ].join(', ')
      )
      .eq('user_id', ctx.user.id)
      .single()

    if (error?.code === 'PGRST116') {
      return null
    }

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch body profile',
        cause: error,
      })
    }

    if (!data) {
      return null
    }

    return mapBodyProfile(data as Record<string, unknown>)
  }),

  saveProfile: protectedProcedure.input(saveProfileInputSchema).mutation(async ({ ctx, input }) => {
    const source = input.source ?? 'manual'

    const { data, error } = await ctx.supabase
      .from('user_body_profiles')
      .upsert(
        {
          user_id: ctx.user.id,
          height_cm: input.heightCm,
          weight_kg: input.weightKg ?? null,
          body_type: input.bodyType ?? null,
          fit_preference: input.fitPreference ?? null,
          gender: input.gender ?? null,
          est_chest_cm: input.estChestCm ?? null,
          est_waist_cm: input.estWaistCm ?? null,
          est_hip_cm: input.estHipCm ?? null,
          est_shoulder_cm: input.estShoulderCm ?? null,
          source,
        },
        { onConflict: 'user_id' }
      )
      .select(
        [
          'height_cm',
          'weight_kg',
          'body_type',
          'fit_preference',
          'gender',
          'est_chest_cm',
          'est_waist_cm',
          'est_hip_cm',
          'est_shoulder_cm',
          'source',
          'created_at',
          'updated_at',
        ].join(', ')
      )
      .single()

    if (error || !data) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to save body profile',
        cause: error,
      })
    }

    return mapBodyProfile(data as Record<string, unknown>)
  }),

  updateFromSizeRec: protectedProcedure
    .input(updateFromSizeRecInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('user_body_profiles')
        .upsert(
          {
            user_id: ctx.user.id,
            height_cm: input.heightCm,
            body_type: input.bodyType ?? null,
            est_chest_cm: input.estChestCm ?? null,
            est_waist_cm: input.estWaistCm ?? null,
            est_hip_cm: input.estHipCm ?? null,
            est_shoulder_cm: input.estShoulderCm ?? null,
            source: 'mediapipe',
          },
          { onConflict: 'user_id' }
        )
        .select(
          [
            'height_cm',
            'weight_kg',
            'body_type',
            'fit_preference',
            'gender',
            'est_chest_cm',
            'est_waist_cm',
            'est_hip_cm',
            'est_shoulder_cm',
            'source',
            'created_at',
            'updated_at',
          ].join(', ')
        )
        .single()

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update body profile from size recommendation',
          cause: error,
        })
      }

      return mapBodyProfile(data as Record<string, unknown>)
    }),
})
