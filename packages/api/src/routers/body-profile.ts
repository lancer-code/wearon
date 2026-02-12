import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { protectedProcedure, router } from '../trpc'

// MEDIUM #3 FIX: Per-user rate limiting to prevent mutation spam
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_UPDATES = 10 // 10 updates per minute per user
const userUpdateCounts = new Map<string, { count: number; resetAt: number }>()

function checkUpdateRateLimit(userId: string): void {
  const now = Date.now()
  const existing = userUpdateCounts.get(userId)

  if (!existing || now >= existing.resetAt) {
    userUpdateCounts.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return
  }

  if (existing.count >= RATE_LIMIT_MAX_UPDATES) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX_UPDATES} profile updates per minute.`,
    })
  }

  existing.count += 1
}

function cleanupUpdateRateLimitCache(): void {
  const now = Date.now()
  for (const [userId, data] of userUpdateCounts.entries()) {
    if (now >= data.resetAt) {
      userUpdateCounts.delete(userId)
    }
  }
}

// Cleanup rate limit cache every 5 minutes
setInterval(cleanupUpdateRateLimitCache, 5 * 60 * 1000)

// HIGH #1 FIX: Runtime type validation schema for database response
const bodyProfileDbSchema = z.object({
  height_cm: z.number(),
  weight_kg: z.number().nullable(),
  body_type: z.string().nullable(),
  fit_preference: z.string().nullable(),
  gender: z.string().nullable(),
  est_chest_cm: z.number().nullable(),
  est_waist_cm: z.number().nullable(),
  est_hip_cm: z.number().nullable(),
  est_shoulder_cm: z.number().nullable(),
  source: z.string(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
})

// LOW #4 FIX + MEDIUM #2 FIX: Shared validation with realistic ranges
const heightCmSchema = z.number().min(100).max(250).refine(
  (val) => Number.isFinite(val) && Number.isInteger(val * 10),
  { message: 'height_cm must have at most 1 decimal place' }
)

const measurementSchema = z.number().min(30).max(200)  // MEDIUM #2 FIX: Realistic body measurement ranges

const saveProfileInputSchema = z.object({
  heightCm: heightCmSchema,
  weightKg: z.number().min(30).max(300).optional(),  // MEDIUM #2 FIX: Realistic weight range
  bodyType: z.string().min(1).max(100).optional(),
  fitPreference: z.string().min(1).max(100).optional(),
  gender: z.string().min(1).max(50).optional(),
  estChestCm: measurementSchema.optional(),
  estWaistCm: measurementSchema.optional(),
  estHipCm: measurementSchema.optional(),
  estShoulderCm: measurementSchema.optional(),
  source: z.enum(['manual', 'user_input']).optional(),
})

const updateFromSizeRecInputSchema = z.object({
  heightCm: heightCmSchema,
  bodyType: z.string().min(1).max(100).optional(),
  estChestCm: measurementSchema.optional(),
  estWaistCm: measurementSchema.optional(),
  estHipCm: measurementSchema.optional(),
  estShoulderCm: measurementSchema.optional(),
})

function mapBodyProfile(data: Record<string, unknown>) {
  // HIGH #1 FIX: Validate runtime types before mapping
  const validated = bodyProfileDbSchema.parse(data)

  return {
    heightCm: validated.height_cm,
    weightKg: validated.weight_kg,
    bodyType: validated.body_type,
    fitPreference: validated.fit_preference,
    gender: validated.gender,
    estChestCm: validated.est_chest_cm,
    estWaistCm: validated.est_waist_cm,
    estHipCm: validated.est_hip_cm,
    estShoulderCm: validated.est_shoulder_cm,
    source: validated.source,
    createdAt: validated.created_at,
    updatedAt: validated.updated_at,
  }
}

function hasEstimatedMeasurements(data: Record<string, unknown>): boolean {
  return (
    data.est_chest_cm !== null ||
    data.est_waist_cm !== null ||
    data.est_hip_cm !== null ||
    data.est_shoulder_cm !== null
  )
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

    return mapBodyProfile(data as unknown as Record<string, unknown>)
  }),

  getSizeRecInput: protectedProcedure.query(async ({ ctx }) => {
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
      return {
        useSavedProfile: false,
        profile: null,
      }
    }

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch body profile for size recommendation',
        cause: error,
      })
    }

    if (!data) {
      return {
        useSavedProfile: false,
        profile: null,
      }
    }

    const profileData = data as unknown as Record<string, unknown>
    if (!hasEstimatedMeasurements(profileData)) {
      return {
        useSavedProfile: false,
        profile: mapBodyProfile(profileData),
      }
    }

    return {
      useSavedProfile: true,
      profile: mapBodyProfile(profileData),
    }
  }),

  saveProfile: protectedProcedure.input(saveProfileInputSchema).mutation(async ({ ctx, input }) => {
    // MEDIUM #3 FIX: Check rate limit before processing
    checkUpdateRateLimit(ctx.user.id)

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

    return mapBodyProfile(data as unknown as Record<string, unknown>)
  }),

  updateFromSizeRec: protectedProcedure
    .input(updateFromSizeRecInputSchema)
    .mutation(async ({ ctx, input }) => {
      // MEDIUM #3 FIX: Check rate limit before processing
      checkUpdateRateLimit(ctx.user.id)

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

      return mapBodyProfile(data as unknown as Record<string, unknown>)
    }),
})
