import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import {
  changePlan,
  createCheckout,
  getApiKeyPreview,
  getOverageUsage,
  getStoreByUserId,
  getStoreBillingCatalog,
  getStoreCreditBalance,
  MerchantOpsError,
  regenerateApiKey,
} from '../services/merchant-ops'
import type { SubscriptionTier } from '../services/paddle'
import { protectedProcedure, router } from '../trpc'

const checkoutInputSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('subscription'),
    tier: z.enum(['starter', 'growth', 'scale']),
  }),
  z.object({
    mode: z.literal('payg'),
    credits: z.number().int().min(1).max(5000),
  }),
])

const changePlanInputSchema = z.object({
  targetTier: z.enum(['starter', 'growth', 'scale']),
})

function toTRPCError(err: unknown): TRPCError {
  if (err instanceof MerchantOpsError) {
    const codeMap: Record<string, 'NOT_FOUND' | 'BAD_REQUEST' | 'INTERNAL_SERVER_ERROR'> = {
      NOT_FOUND: 'NOT_FOUND',
      BAD_REQUEST: 'BAD_REQUEST',
      INTERNAL_ERROR: 'INTERNAL_SERVER_ERROR',
    }
    return new TRPCError({
      code: codeMap[err.code] ?? 'INTERNAL_SERVER_ERROR',
      message: err.message,
    })
  }
  if (err instanceof TRPCError) {
    return err
  }
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: err instanceof Error ? err.message : 'Unknown error',
  })
}

export const merchantRouter = router({
  getMyStore: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await getStoreByUserId(ctx.adminSupabase, ctx.user.id)
    } catch (err) {
      throw toTRPCError(err)
    }
  }),

  getBillingCatalog: protectedProcedure.query(async ({ ctx }) => {
    try {
      const store = await getStoreByUserId(ctx.adminSupabase, ctx.user.id)
      return getStoreBillingCatalog(store)
    } catch (err) {
      throw toTRPCError(err)
    }
  }),

  createCheckoutSession: protectedProcedure
    .input(checkoutInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const store = await getStoreByUserId(ctx.adminSupabase, ctx.user.id)
        return await createCheckout(store, input, ctx.user.id, ctx.user.email)
      } catch (err) {
        throw toTRPCError(err)
      }
    }),

  changePlan: protectedProcedure.input(changePlanInputSchema).mutation(async ({ ctx, input }) => {
    try {
      const store = await getStoreByUserId(ctx.adminSupabase, ctx.user.id)
      return await changePlan(store, input.targetTier as SubscriptionTier)
    } catch (err) {
      throw toTRPCError(err)
    }
  }),

  getApiKeyPreview: protectedProcedure.query(async ({ ctx }) => {
    try {
      const store = await getStoreByUserId(ctx.adminSupabase, ctx.user.id)
      return await getApiKeyPreview(store.id)
    } catch (err) {
      throw toTRPCError(err)
    }
  }),

  getCreditBalance: protectedProcedure.query(async ({ ctx }) => {
    try {
      const store = await getStoreByUserId(ctx.adminSupabase, ctx.user.id)
      return await getStoreCreditBalance(store.id)
    } catch (err) {
      throw toTRPCError(err)
    }
  }),

  getOverageUsage: protectedProcedure.query(async ({ ctx }) => {
    try {
      const store = await getStoreByUserId(ctx.adminSupabase, ctx.user.id)
      return await getOverageUsage(store.id)
    } catch (err) {
      throw toTRPCError(err)
    }
  }),

  regenerateApiKey: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const store = await getStoreByUserId(ctx.adminSupabase, ctx.user.id)
      return await regenerateApiKey(store.id, store.shopDomain)
    } catch (err) {
      throw toTRPCError(err)
    }
  }),

  completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const store = await getStoreByUserId(ctx.adminSupabase, ctx.user.id)
      const { error } = await ctx.adminSupabase
        .from('stores')
        .update({ onboarding_completed: true })
        .eq('id', store.id)

      if (error) {
        throw new MerchantOpsError('Failed to complete onboarding', 'INTERNAL_ERROR')
      }

      return { success: true }
    } catch (err) {
      throw toTRPCError(err)
    }
  }),
})
