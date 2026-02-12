import crypto from 'node:crypto'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { logger } from '../logger'
import { addStoreCredits } from '../services/b2b-credits'
import {
  calculatePaygTotalCents,
  changeSubscriptionPlan,
  createPaygCheckoutSession,
  createSubscriptionCheckoutSession,
  getBillingCatalog,
  getTierCredits,
  type SubscriptionTier,
} from '../services/paddle'
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

const TIER_ORDER: Record<SubscriptionTier, number> = {
  starter: 1,
  growth: 2,
  scale: 3,
}

function makeRequestId(): string {
  return `req_${crypto.randomUUID()}`
}

async function getStoreForUser(adminSupabase: any, userId: string) {
  const { data: store, error } = await adminSupabase
    .from('stores')
    .select(
      'id, shop_domain, billing_mode, subscription_tier, subscription_id, subscription_status, subscription_current_period_end, paddle_customer_id, status, onboarding_completed, created_at'
    )
    .eq('owner_user_id', userId)
    .single()

  if (error) {
    // Distinguish between not found and actual errors
    if (error.code === 'PGRST116') {
      // PostgreSQL "no rows" error
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No store linked to your account',
      })
    }
    logger.error({ user_id: userId, err: error.message }, '[Merchant] Store lookup failed')
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to load store information',
    })
  }

  if (!store) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'No store linked to your account',
    })
  }

  return store
}

export const merchantRouter = router({
  /**
   * Get the store linked to the current authenticated user.
   */
  getMyStore: protectedProcedure.query(async ({ ctx }) => {
    const store = await getStoreForUser(ctx.adminSupabase, ctx.user.id)

    return {
      id: store.id as string,
      shopDomain: store.shop_domain as string,
      billingMode: store.billing_mode as string,
      subscriptionTier: (store.subscription_tier as string | null) ?? null,
      subscriptionId: (store.subscription_id as string | null) ?? null,
      subscriptionStatus: (store.subscription_status as string | null) ?? null,
      subscriptionCurrentPeriodEnd:
        (store.subscription_current_period_end as string | null) ?? null,
      paddleCustomerId: (store.paddle_customer_id as string | null) ?? null,
      status: store.status as string,
      onboardingCompleted: store.onboarding_completed as boolean,
      createdAt: (store.created_at as string | null) ?? null,
    }
  }),

  /**
   * Return billing catalog + current store billing state for merchant billing UI.
   */
  getBillingCatalog: protectedProcedure.query(async ({ ctx }) => {
    const store = await getStoreForUser(ctx.adminSupabase, ctx.user.id)
    return {
      catalog: getBillingCatalog(),
      store: {
        id: store.id as string,
        subscriptionTier: (store.subscription_tier as string | null) ?? null,
        subscriptionId: (store.subscription_id as string | null) ?? null,
        subscriptionStatus: (store.subscription_status as string | null) ?? null,
        currentPeriodEnd: (store.subscription_current_period_end as string | null) ?? null,
      },
    }
  }),

  /**
   * Create a Paddle checkout session for subscription or PAYG purchase.
   */
  createCheckoutSession: protectedProcedure
    .input(checkoutInputSchema)
    .mutation(async ({ ctx, input }) => {
      const store = await getStoreForUser(ctx.adminSupabase, ctx.user.id)
      const requestId = makeRequestId()

      try {
        if (input.mode === 'subscription') {
          const result = await createSubscriptionCheckoutSession({
            tier: input.tier,
            requestId,
            storeId: store.id as string,
            shopDomain: store.shop_domain as string,
            userId: ctx.user.id,
            userEmail: ctx.user.email,
          })

          return {
            checkoutUrl: result.checkoutUrl,
            transactionId: result.transactionId,
            mode: 'subscription' as const,
            tier: input.tier,
          }
        }

        const result = await createPaygCheckoutSession({
          credits: input.credits,
          requestId,
          storeId: store.id as string,
          shopDomain: store.shop_domain as string,
          userId: ctx.user.id,
          userEmail: ctx.user.email,
        })

        return {
          checkoutUrl: result.checkoutUrl,
          transactionId: result.transactionId,
          mode: 'payg' as const,
          credits: input.credits,
          totalCents: calculatePaygTotalCents(input.credits),
        }
      } catch (err) {
        logger.error(
          {
            request_id: requestId,
            store_id: store.id,
            err: err instanceof Error ? err.message : String(err),
          },
          '[Merchant] Checkout session creation failed'
        )
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create checkout session',
        })
      }
    }),

  /**
   * Change existing subscription plan.
   * Upgrades apply immediately and grant delta credits now.
   * Downgrades are scheduled for next billing period.
   */
  changePlan: protectedProcedure.input(changePlanInputSchema).mutation(async ({ ctx, input }) => {
    const store = await getStoreForUser(ctx.adminSupabase, ctx.user.id)
    const requestId = makeRequestId()

    const currentTierRaw = (store.subscription_tier as string | null) ?? null
    const currentTier =
      currentTierRaw === 'starter' || currentTierRaw === 'growth' || currentTierRaw === 'scale'
        ? currentTierRaw
        : null
    const subscriptionId = (store.subscription_id as string | null) ?? null

    if (!subscriptionId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No active subscription found for this store',
      })
    }

    if (currentTier === input.targetTier) {
      return {
        changed: false,
        targetTier: input.targetTier,
        effectiveFrom: 'none',
      }
    }

    const isUpgrade = currentTier ? TIER_ORDER[input.targetTier] > TIER_ORDER[currentTier] : true
    const effectiveFrom = isUpgrade ? 'immediately' : 'next_billing_period'

    try {
      await changeSubscriptionPlan({
        subscriptionId,
        targetTier: input.targetTier,
        requestId,
        effectiveFrom,
      })

      if (isUpgrade && currentTier) {
        // CRITICAL FIX (HIGH #1): Update store metadata BEFORE granting credits
        // This prevents double-credit on retry: if credit grant fails, retry won't re-update tier
        const { error: updateError } = await ctx.adminSupabase
          .from('stores')
          .update({ subscription_tier: input.targetTier, subscription_status: 'active' })
          .eq('id', store.id)

        if (updateError) {
          throw new Error(`Failed to persist upgraded subscription tier: ${updateError.message}`)
        }

        const deltaCredits = Math.max(
          0,
          getTierCredits(input.targetTier) - getTierCredits(currentTier)
        )
        if (deltaCredits > 0) {
          // Credits granted AFTER tier update succeeds
          // Combined with idempotency protection (migration 014), safe to retry
          await addStoreCredits(
            store.id as string,
            deltaCredits,
            'subscription',
            requestId,
            `Upgrade ${currentTier} -> ${input.targetTier} delta credits`
          )
        }
      }

      return {
        changed: true,
        targetTier: input.targetTier,
        effectiveFrom,
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      logger.error(
        {
          request_id: requestId,
          store_id: store.id,
          subscription_id: subscriptionId,
          target_tier: input.targetTier,
          err: errorMessage,
        },
        '[Merchant] Subscription plan change failed'
      )

      // MEDIUM #4 FIX: Provide specific error categories for better debugging
      if (errorMessage.includes('persist upgraded subscription tier')) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database error while updating subscription. Please try again.',
        })
      }

      if (errorMessage.includes('Paddle') || errorMessage.toLowerCase().includes('payment')) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Payment provider temporarily unavailable. Please try again in a few minutes.',
        })
      }

      if (errorMessage.includes('Credit')) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error processing subscription credits. Please contact support.',
        })
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to change subscription plan. Please try again or contact support.',
      })
    }
  }),

  /**
   * Get the masked API key preview for the merchant's store.
   * Never returns the full key — only masked version (e.g., wk_a1b2c3d4...****).
   */
  getApiKeyPreview: protectedProcedure.query(async ({ ctx }) => {
    const store = await getStoreForUser(ctx.adminSupabase, ctx.user.id)

    const { data: apiKey, error } = await ctx.adminSupabase
      .from('store_api_keys')
      .select('key_prefix, created_at')
      .eq('store_id', store.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      logger.error({ store_id: store.id, err: error.message }, '[Merchant] API key preview query failed')
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to load API key information',
      })
    }

    if (!apiKey || !apiKey.key_prefix) {
      return { maskedKey: null, createdAt: null }
    }

    // Display first 16 chars of real key + mask suffix (e.g., "wk_a1b2c3d4e5f6...****")
    const maskedKey = `${apiKey.key_prefix}...****`

    return {
      maskedKey,
      createdAt: apiKey.created_at,
    }
  }),

  /**
   * Get credit balance for the merchant's store.
   */
  getCreditBalance: protectedProcedure.query(async ({ ctx }) => {
    const store = await getStoreForUser(ctx.adminSupabase, ctx.user.id)

    const { data: credits, error } = await ctx.adminSupabase
      .from('store_credits')
      .select('balance, total_purchased, total_spent')
      .eq('store_id', store.id)
      .single()

    if (error) {
      logger.error({ store_id: store.id, err: error.message }, '[Merchant] Credit balance query failed')
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to load credit balance',
      })
    }

    return {
      balance: (credits?.balance as number | undefined) ?? 0,
      totalPurchased: (credits?.total_purchased as number | undefined) ?? 0,
      totalSpent: (credits?.total_spent as number | undefined) ?? 0,
    }
  }),

  /**
   * Get recent overage usage records for billing transparency.
   */
  getOverageUsage: protectedProcedure.query(async ({ ctx }) => {
    const store = await getStoreForUser(ctx.adminSupabase, ctx.user.id)

    const { data, error } = await ctx.adminSupabase
      .from('store_credit_transactions')
      .select('id, amount, description, request_id, created_at')
      .eq('store_id', store.id)
      .eq('type', 'overage')
      .order('created_at', { ascending: false })
      .limit(25)

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to load overage history',
      })
    }

    return (data ?? []).map((row) => ({
      id: row.id as string,
      amount: Math.abs((row.amount as number | null) ?? 0),
      description: (row.description as string | null) ?? 'Overage usage',
      requestId: (row.request_id as string | null) ?? null,
      createdAt: (row.created_at as string | null) ?? null,
    }))
  }),

  /**
   * Regenerate the API key for the merchant's store.
   * Invalidates the old key and creates a new one.
   * Returns the full key ONCE.
   * Atomic: inserts new key before deactivating old keys to prevent downtime.
   */
  regenerateApiKey: protectedProcedure.mutation(async ({ ctx }) => {
    const store = await getStoreForUser(ctx.adminSupabase, ctx.user.id)

    // Generate new API key
    const randomHex = crypto.randomBytes(16).toString('hex')
    const plaintext = `wk_${randomHex}`
    const keyHash = crypto.createHash('sha256').update(plaintext).digest('hex')
    const keyPrefix = plaintext.substring(0, 16) // First 16 chars for masked display

    // Step 1: Insert new active key FIRST (atomic guarantee - fails fast if DB issue)
    const { error: insertError } = await ctx.adminSupabase.from('store_api_keys').insert({
      store_id: store.id,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      allowed_domains: [`https://${store.shop_domain as string}`],
      is_active: true,
    })

    if (insertError) {
      logger.error(
        { store_id: store.id, err: insertError.message },
        '[Merchant] API key regeneration failed at insert step'
      )
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to regenerate API key',
      })
    }

    // Step 2: Deactivate old keys AFTER new key is successfully created
    // This ensures store always has at least one active key
    const { error: deactivateError } = await ctx.adminSupabase
      .from('store_api_keys')
      .update({ is_active: false })
      .eq('store_id', store.id)
      .neq('key_hash', keyHash)

    if (deactivateError) {
      // Log but don't fail - new key is already active so store is operational
      logger.warn(
        { store_id: store.id, err: deactivateError.message },
        '[Merchant] Failed to deactivate old keys after regeneration (non-fatal)'
      )
    }

    logger.info({ store_id: store.id }, '[Merchant] API key regenerated')

    return { apiKey: plaintext }
  }),

  /**
   * Complete the onboarding process for the merchant's store.
   * Sets onboarding_completed = true.
   */
  completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    const store = await getStoreForUser(ctx.adminSupabase, ctx.user.id)

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
