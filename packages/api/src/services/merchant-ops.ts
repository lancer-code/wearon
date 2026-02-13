import crypto from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'
import { logger } from '../logger'
import { addStoreCredits } from './b2b-credits'
import { ensureHiddenTryOnCreditProduct } from './shopify-credit-product'
import {
  calculatePaygTotalCents,
  changeSubscriptionPlan,
  createPaygCheckoutSession,
  createSubscriptionCheckoutSession,
  getBillingCatalog,
  getTierCredits,
  type SubscriptionTier,
} from './paddle'

let serviceClient: SupabaseClient | null = null

function getServiceClient(): SupabaseClient {
  if (!serviceClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
    }

    serviceClient = createClient(supabaseUrl, supabaseServiceKey)
  }
  return serviceClient
}

const TIER_ORDER: Record<SubscriptionTier, number> = {
  starter: 1,
  growth: 2,
  scale: 3,
}

function makeRequestId(): string {
  return `req_${crypto.randomUUID()}`
}

export interface MerchantStore {
  id: string
  ownerUserId: string | null
  shopDomain: string
  billingMode: string
  subscriptionTier: string | null
  subscriptionId: string | null
  subscriptionStatus: string | null
  subscriptionCurrentPeriodEnd: string | null
  paddleCustomerId: string | null
  status: string
  onboardingCompleted: boolean
  createdAt: string | null
}

export class MerchantOpsError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'BAD_REQUEST' | 'INTERNAL_ERROR'
  ) {
    super(message)
    this.name = 'MerchantOpsError'
  }
}

export async function getStoreByUserId(
  adminSupabase: SupabaseClient,
  userId: string
): Promise<MerchantStore> {
  const { data: store, error } = await adminSupabase
    .from('stores')
    .select(
      'id, owner_user_id, shop_domain, billing_mode, subscription_tier, subscription_id, subscription_status, subscription_current_period_end, paddle_customer_id, status, onboarding_completed, created_at'
    )
    .eq('owner_user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new MerchantOpsError('No store linked to your account', 'NOT_FOUND')
    }
    logger.error({ user_id: userId, err: error.message }, '[MerchantOps] Store lookup failed')
    throw new MerchantOpsError('Failed to load store information', 'INTERNAL_ERROR')
  }

  if (!store) {
    throw new MerchantOpsError('No store linked to your account', 'NOT_FOUND')
  }

  return {
    id: store.id as string,
    ownerUserId: (store.owner_user_id as string | null) ?? null,
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
}

export async function getStoreById(storeId: string): Promise<MerchantStore> {
  const supabase = getServiceClient()

  const { data: store, error } = await supabase
    .from('stores')
    .select(
      'id, owner_user_id, shop_domain, billing_mode, subscription_tier, subscription_id, subscription_status, subscription_current_period_end, paddle_customer_id, status, onboarding_completed, created_at'
    )
    .eq('id', storeId)
    .single()

  if (error || !store) {
    throw new MerchantOpsError('Store not found', 'NOT_FOUND')
  }

  return {
    id: store.id as string,
    ownerUserId: (store.owner_user_id as string | null) ?? null,
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
}

export function getStoreBillingCatalog(store: MerchantStore) {
  return {
    catalog: getBillingCatalog(),
    store: {
      id: store.id,
      subscriptionTier: store.subscriptionTier,
      subscriptionId: store.subscriptionId,
      subscriptionStatus: store.subscriptionStatus,
      currentPeriodEnd: store.subscriptionCurrentPeriodEnd,
    },
  }
}

export async function getStoreCreditBalance(storeId: string) {
  const supabase = getServiceClient()

  const { data: credits, error } = await supabase
    .from('store_credits')
    .select('balance, total_purchased, total_spent')
    .eq('store_id', storeId)
    .single()

  if (error) {
    logger.error({ store_id: storeId, err: error.message }, '[MerchantOps] Credit balance query failed')
    throw new MerchantOpsError('Failed to load credit balance', 'INTERNAL_ERROR')
  }

  return {
    balance: (credits?.balance as number | undefined) ?? 0,
    totalPurchased: (credits?.total_purchased as number | undefined) ?? 0,
    totalSpent: (credits?.total_spent as number | undefined) ?? 0,
  }
}

export async function createCheckout(
  store: MerchantStore,
  input: { mode: 'subscription'; tier: SubscriptionTier } | { mode: 'payg'; credits: number },
  userId: string,
  userEmail?: string
) {
  const requestId = makeRequestId()

  try {
    if (input.mode === 'subscription') {
      const result = await createSubscriptionCheckoutSession({
        tier: input.tier,
        requestId,
        storeId: store.id,
        shopDomain: store.shopDomain,
        userId,
        userEmail,
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
      storeId: store.id,
      shopDomain: store.shopDomain,
      userId,
      userEmail,
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
      '[MerchantOps] Checkout session creation failed'
    )
    throw new MerchantOpsError('Failed to create checkout session', 'INTERNAL_ERROR')
  }
}

export async function changePlan(
  store: MerchantStore,
  targetTier: SubscriptionTier
) {
  const requestId = makeRequestId()
  const supabase = getServiceClient()

  const currentTierRaw = store.subscriptionTier
  const currentTier =
    currentTierRaw === 'starter' || currentTierRaw === 'growth' || currentTierRaw === 'scale'
      ? currentTierRaw
      : null

  if (!store.subscriptionId) {
    throw new MerchantOpsError('No active subscription found for this store', 'BAD_REQUEST')
  }

  if (currentTier === targetTier) {
    return { changed: false, targetTier, effectiveFrom: 'none' }
  }

  const isUpgrade = currentTier ? TIER_ORDER[targetTier] > TIER_ORDER[currentTier] : true
  const effectiveFrom = isUpgrade ? 'immediately' : 'next_billing_period'

  try {
    await changeSubscriptionPlan({
      subscriptionId: store.subscriptionId,
      targetTier,
      requestId,
      effectiveFrom,
    })

    if (isUpgrade && currentTier) {
      const { error: updateError } = await supabase
        .from('stores')
        .update({ subscription_tier: targetTier, subscription_status: 'active' })
        .eq('id', store.id)

      if (updateError) {
        throw new Error(`Failed to persist upgraded subscription tier: ${updateError.message}`)
      }

      const deltaCredits = Math.max(
        0,
        getTierCredits(targetTier) - getTierCredits(currentTier)
      )
      if (deltaCredits > 0) {
        await addStoreCredits(
          store.id,
          deltaCredits,
          'subscription',
          requestId,
          `Upgrade ${currentTier} -> ${targetTier} delta credits`
        )
      }
    }

    return { changed: true, targetTier, effectiveFrom }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    logger.error(
      {
        request_id: requestId,
        store_id: store.id,
        subscription_id: store.subscriptionId,
        target_tier: targetTier,
        err: errorMessage,
      },
      '[MerchantOps] Subscription plan change failed'
    )

    if (errorMessage.includes('persist upgraded subscription tier')) {
      throw new MerchantOpsError(
        'Database error while updating subscription. Please try again.',
        'INTERNAL_ERROR'
      )
    }
    if (errorMessage.includes('Paddle') || errorMessage.toLowerCase().includes('payment')) {
      throw new MerchantOpsError(
        'Payment provider temporarily unavailable. Please try again in a few minutes.',
        'INTERNAL_ERROR'
      )
    }
    if (errorMessage.includes('Credit')) {
      throw new MerchantOpsError(
        'Error processing subscription credits. Please contact support.',
        'INTERNAL_ERROR'
      )
    }

    throw new MerchantOpsError(
      'Failed to change subscription plan. Please try again or contact support.',
      'INTERNAL_ERROR'
    )
  }
}

export async function getApiKeyPreview(storeId: string) {
  const supabase = getServiceClient()

  const { data: apiKey, error } = await supabase
    .from('store_api_keys')
    .select('key_prefix, created_at')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    logger.error({ store_id: storeId, err: error.message }, '[MerchantOps] API key preview query failed')
    throw new MerchantOpsError('Failed to load API key information', 'INTERNAL_ERROR')
  }

  if (!apiKey || !apiKey.key_prefix) {
    return { maskedKey: null, createdAt: null }
  }

  const maskedKey = `${apiKey.key_prefix}...****`
  return { maskedKey, createdAt: apiKey.created_at }
}

export async function regenerateApiKey(storeId: string, shopDomain: string) {
  const supabase = getServiceClient()

  const randomHex = crypto.randomBytes(16).toString('hex')
  const plaintext = `wk_${randomHex}`
  const keyHash = crypto.createHash('sha256').update(plaintext).digest('hex')
  const keyPrefix = plaintext.substring(0, 16)

  // Deactivate old keys FIRST to prevent multiple active keys coexisting
  const { error: deactivateError } = await supabase
    .from('store_api_keys')
    .update({ is_active: false })
    .eq('store_id', storeId)
    .eq('is_active', true)

  if (deactivateError) {
    logger.error(
      { store_id: storeId, err: deactivateError.message },
      '[MerchantOps] Failed to deactivate old keys before regeneration'
    )
    throw new MerchantOpsError('Failed to regenerate API key', 'INTERNAL_ERROR')
  }

  const { error: insertError } = await supabase.from('store_api_keys').insert({
    store_id: storeId,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    allowed_domains: [`https://${shopDomain}`],
    is_active: true,
  })

  if (insertError) {
    logger.error(
      { store_id: storeId, err: insertError.message },
      '[MerchantOps] API key regeneration failed at insert step'
    )
    throw new MerchantOpsError('Failed to regenerate API key', 'INTERNAL_ERROR')
  }

  logger.info({ store_id: storeId }, '[MerchantOps] API key regenerated')

  return { apiKey: plaintext }
}

export async function getOverageUsage(storeId: string) {
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('store_credit_transactions')
    .select('id, amount, description, request_id, created_at')
    .eq('store_id', storeId)
    .eq('type', 'overage')
    .order('created_at', { ascending: false })
    .limit(25)

  if (error) {
    throw new MerchantOpsError('Failed to load overage history', 'INTERNAL_ERROR')
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    amount: Math.abs((row.amount as number | null) ?? 0),
    description: (row.description as string | null) ?? 'Overage usage',
    requestId: (row.request_id as string | null) ?? null,
    createdAt: (row.created_at as string | null) ?? null,
  }))
}

export async function getStoreConfig(storeId: string) {
  const supabase = getServiceClient()

  const { data: store, error } = await supabase
    .from('stores')
    .select('id, shop_domain, billing_mode, retail_credit_price, subscription_tier, status')
    .eq('id', storeId)
    .single()

  if (error || !store) {
    throw new MerchantOpsError('Store configuration not found', 'NOT_FOUND')
  }

  return {
    storeId: store.id as string,
    shopDomain: store.shop_domain as string,
    billingMode: store.billing_mode as string,
    retailCreditPrice: store.retail_credit_price as number | null,
    subscriptionTier: store.subscription_tier as string | null,
    status: store.status as string,
  }
}

export async function updateStoreConfig(
  storeId: string,
  billingMode: string,
  retailCreditPrice: number | null
) {
  const supabase = getServiceClient()

  // If switching to resell mode, sync the Shopify credit product
  let shopifyProductId: string | null = null
  let shopifyVariantId: string | null = null

  if (billingMode === 'resell_mode' && retailCreditPrice) {
    const { data: currentStore, error: storeError } = await supabase
      .from('stores')
      .select('shop_domain, access_token_encrypted, shopify_product_id, shopify_variant_id')
      .eq('id', storeId)
      .single()

    if (storeError || !currentStore) {
      throw new MerchantOpsError('Store not found', 'NOT_FOUND')
    }

    if (currentStore.access_token_encrypted) {
      try {
        const shopifyResult = await ensureHiddenTryOnCreditProduct({
          accessTokenEncrypted: currentStore.access_token_encrypted as string,
          existingProductId: currentStore.shopify_product_id as string | null,
          existingVariantId: currentStore.shopify_variant_id as string | null,
          requestId: `cfg_${crypto.randomUUID()}`,
          retailCreditPrice,
          shopDomain: currentStore.shop_domain as string,
        })
        shopifyProductId = shopifyResult.shopifyProductId
        shopifyVariantId = shopifyResult.shopifyVariantId
      } catch (err) {
        logger.error(
          { err: err instanceof Error ? err.message : String(err), storeId },
          '[MerchantOps] Failed to sync Shopify credit product'
        )
        throw new MerchantOpsError('Failed to sync Shopify credit product', 'INTERNAL_ERROR')
      }
    }
  }

  const updatePayload: Record<string, unknown> = {
    billing_mode: billingMode,
    retail_credit_price: billingMode === 'resell_mode' ? retailCreditPrice : null,
  }

  if (shopifyProductId !== null) {
    updatePayload.shopify_product_id = shopifyProductId
    updatePayload.shopify_variant_id = shopifyVariantId
  }

  const { data: updated, error } = await supabase
    .from('stores')
    .update(updatePayload)
    .eq('id', storeId)
    .select('id, shop_domain, billing_mode, retail_credit_price, subscription_tier, status')
    .single()

  if (error || !updated) {
    logger.error(
      { err: error?.message, storeId },
      '[MerchantOps] Store config update failed'
    )
    throw new MerchantOpsError('Failed to update store configuration', 'INTERNAL_ERROR')
  }

  return {
    storeId: updated.id as string,
    shopDomain: updated.shop_domain as string,
    billingMode: updated.billing_mode as string,
    retailCreditPrice: updated.retail_credit_price as number | null,
    subscriptionTier: updated.subscription_tier as string | null,
    status: updated.status as string,
  }
}
