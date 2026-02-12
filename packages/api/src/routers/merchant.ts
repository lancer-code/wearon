import crypto from 'node:crypto'
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { logger } from '../logger'

export const merchantRouter = router({
  /**
   * Get the store linked to the current authenticated user.
   */
  getMyStore: protectedProcedure.query(async ({ ctx }) => {
    const { data: store, error } = await ctx.adminSupabase
      .from('stores')
      .select('id, shop_domain, billing_mode, subscription_tier, status, onboarding_completed, created_at')
      .eq('owner_user_id', ctx.user.id)
      .single()

    if (error || !store) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No store linked to your account',
      })
    }

    return {
      id: store.id,
      shopDomain: store.shop_domain,
      billingMode: store.billing_mode,
      subscriptionTier: store.subscription_tier,
      status: store.status,
      onboardingCompleted: store.onboarding_completed,
      createdAt: store.created_at,
    }
  }),

  /**
   * Get the masked API key preview for the merchant's store.
   * Never returns the full key — only masked version (e.g., wk_a1b2...****).
   */
  getApiKeyPreview: protectedProcedure.query(async ({ ctx }) => {
    // First get the store
    const { data: store } = await ctx.adminSupabase
      .from('stores')
      .select('id')
      .eq('owner_user_id', ctx.user.id)
      .single()

    if (!store) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No store linked to your account',
      })
    }

    // Get the active API key for this store
    const { data: apiKey } = await ctx.adminSupabase
      .from('store_api_keys')
      .select('key_hash, created_at')
      .eq('store_id', store.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!apiKey) {
      return { maskedKey: null, createdAt: null }
    }

    // Mask the key hash for display — show first 8 chars of hash + ****
    const maskedKey = `wk_${apiKey.key_hash.substring(0, 8)}...****`

    return {
      maskedKey,
      createdAt: apiKey.created_at,
    }
  }),

  /**
   * Get credit balance for the merchant's store.
   */
  getCreditBalance: protectedProcedure.query(async ({ ctx }) => {
    const { data: store } = await ctx.adminSupabase
      .from('stores')
      .select('id')
      .eq('owner_user_id', ctx.user.id)
      .single()

    if (!store) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No store linked to your account',
      })
    }

    const { data: credits } = await ctx.adminSupabase
      .from('store_credits')
      .select('balance, total_purchased, total_spent')
      .eq('store_id', store.id)
      .single()

    return {
      balance: credits?.balance ?? 0,
      totalPurchased: credits?.total_purchased ?? 0,
      totalSpent: credits?.total_spent ?? 0,
    }
  }),

  /**
   * Regenerate the API key for the merchant's store.
   * Invalidates the old key and creates a new one.
   * Returns the full key ONCE.
   */
  regenerateApiKey: protectedProcedure.mutation(async ({ ctx }) => {
    const { data: store } = await ctx.adminSupabase
      .from('stores')
      .select('id, shop_domain')
      .eq('owner_user_id', ctx.user.id)
      .single()

    if (!store) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No store linked to your account',
      })
    }

    // Deactivate all existing keys
    await ctx.adminSupabase
      .from('store_api_keys')
      .update({ is_active: false })
      .eq('store_id', store.id)

    // Generate new key
    const randomHex = crypto.randomBytes(16).toString('hex')
    const plaintext = `wk_${randomHex}`
    const keyHash = crypto.createHash('sha256').update(plaintext).digest('hex')

    const { error: insertError } = await ctx.adminSupabase
      .from('store_api_keys')
      .insert({
        store_id: store.id,
        key_hash: keyHash,
        allowed_domains: [store.shop_domain],
        is_active: true,
      })

    if (insertError) {
      logger.error({ storeId: store.id, err: insertError.message }, '[Merchant] API key regeneration failed')
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to regenerate API key',
      })
    }

    logger.info({ storeId: store.id }, '[Merchant] API key regenerated')

    return { apiKey: plaintext }
  }),

  /**
   * Complete the onboarding process for the merchant's store.
   * Sets onboarding_completed = true.
   */
  completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    const { data: store } = await ctx.adminSupabase
      .from('stores')
      .select('id')
      .eq('owner_user_id', ctx.user.id)
      .single()

    if (!store) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No store linked to your account',
      })
    }

    const { error } = await ctx.adminSupabase
      .from('stores')
      .update({ onboarding_completed: true })
      .eq('id', store.id)

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to complete onboarding',
      })
    }

    return { success: true }
  }),
})
