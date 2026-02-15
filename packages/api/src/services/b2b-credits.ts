import crypto from 'node:crypto'
import { getAdminClient } from '../lib/supabase-admin'
import { logger } from '../logger'
import type { SubscriptionTier } from './paddle'

function isMissingDatabaseObject(message: string | undefined, objectName: string): boolean {
  if (!message) {
    return false
  }
  const lowered = message.toLowerCase()
  return lowered.includes(objectName.toLowerCase()) && lowered.includes('does not exist')
}

function normalizeShopperEmail(input: string): string {
  return input.trim().toLowerCase()
}

function hashShopperEmail(shopperEmail: string): string {
  return crypto.createHash('sha256').update(normalizeShopperEmail(shopperEmail)).digest('hex')
}

/**
 * Atomically deduct 1 credit from a store's balance.
 * Returns true if deduction succeeded, false if insufficient balance.
 */
export async function deductStoreCredit(
  storeId: string,
  requestId: string,
  description = 'Generation credit deduction'
): Promise<boolean> {
  const supabase = getAdminClient()

  const { data, error } = await supabase.rpc('deduct_store_credits', {
    p_store_id: storeId,
    p_amount: 1,
    p_request_id: requestId,
    p_description: description,
  })

  if (error) {
    logger.error({ storeId, requestId, err: error.message }, '[B2B Credits] Deduction RPC failed')
    throw new Error(`Credit deduction failed: ${error.message}`)
  }

  return data as boolean
}

/**
 * Refund 1 credit to a store's balance (e.g., on generation failure).
 */
export async function refundStoreCredit(
  storeId: string,
  requestId: string,
  description = 'Generation failed - refund'
): Promise<void> {
  const supabase = getAdminClient()

  const { error } = await supabase.rpc('refund_store_credits', {
    p_store_id: storeId,
    p_amount: 1,
    p_request_id: requestId,
    p_description: description,
  })

  if (error) {
    logger.error({ storeId, requestId, err: error.message }, '[B2B Credits] Refund RPC failed')
    throw new Error(`Credit refund failed: ${error.message}`)
  }
}

/**
 * Atomically deduct 1 credit from a shopper's balance for resell mode.
 * Returns true if deduction succeeded, false if shopper has no credits.
 */
export async function deductStoreShopperCredit(
  storeId: string,
  shopperEmail: string,
  requestId: string,
  description = 'B2B shopper generation'
): Promise<boolean> {
  const supabase = getAdminClient()
  const normalizedShopperEmail = normalizeShopperEmail(shopperEmail)

  const { data, error } = await supabase.rpc('deduct_store_shopper_credits', {
    p_store_id: storeId,
    p_shopper_email: normalizedShopperEmail,
    p_amount: 1,
    p_request_id: requestId,
    p_description: description,
  })

  if (error) {
    logger.error(
      {
        storeId,
        requestId,
        shopperEmailHash: hashShopperEmail(normalizedShopperEmail),
        err: error.message,
      },
      '[B2B Credits] Shopper deduction RPC failed'
    )
    throw new Error(`Shopper credit deduction failed: ${error.message}`)
  }

  return data as boolean
}

/**
 * Refund 1 credit to a shopper's balance (resell mode queue/session failure).
 */
export async function refundStoreShopperCredit(
  storeId: string,
  shopperEmail: string,
  requestId: string,
  description = 'B2B shopper generation failed - refund'
): Promise<void> {
  const supabase = getAdminClient()
  const normalizedShopperEmail = normalizeShopperEmail(shopperEmail)

  const { error } = await supabase.rpc('refund_store_shopper_credits', {
    p_store_id: storeId,
    p_shopper_email: normalizedShopperEmail,
    p_amount: 1,
    p_request_id: requestId,
    p_description: description,
  })

  if (error) {
    logger.error(
      {
        storeId,
        requestId,
        shopperEmailHash: hashShopperEmail(normalizedShopperEmail),
        err: error.message,
      },
      '[B2B Credits] Shopper refund RPC failed'
    )
    throw new Error(`Shopper credit refund failed: ${error.message}`)
  }
}

/**
 * Get the current credit balance for a store.
 */
export async function getStoreBalance(
  storeId: string
): Promise<{ balance: number; totalPurchased: number; totalSpent: number }> {
  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('store_credits')
    .select('balance, total_purchased, total_spent')
    .eq('store_id', storeId)
    .single()

  if (error || !data) {
    logger.error({ storeId, err: error?.message }, '[B2B Credits] Balance query failed')
    throw new Error(`Store balance query failed: ${error?.message ?? 'No store_credits row found'}`)
  }

  return {
    balance: data.balance as number,
    totalPurchased: data.total_purchased as number,
    totalSpent: data.total_spent as number,
  }
}

/**
 * Returns shopper-level credits for a specific store. Missing rows resolve to zero balance.
 */
export async function getStoreShopperBalance(
  storeId: string,
  shopperEmail: string
): Promise<{ balance: number; totalPurchased: number; totalSpent: number }> {
  const supabase = getAdminClient()
  const normalizedShopperEmail = normalizeShopperEmail(shopperEmail)

  const { data, error } = await supabase
    .from('store_shopper_credits')
    .select('balance, total_purchased, total_spent')
    .eq('store_id', storeId)
    .eq('shopper_email', normalizedShopperEmail)
    .maybeSingle()

  if (error) {
    logger.error(
      {
        storeId,
        shopperEmailHash: hashShopperEmail(normalizedShopperEmail),
        err: error.message,
      },
      '[B2B Credits] Shopper balance query failed'
    )
    throw new Error(`Shopper balance query failed: ${error.message}`)
  }

  if (!data) {
    return {
      balance: 0,
      totalPurchased: 0,
      totalSpent: 0,
    }
  }

  return {
    balance: data.balance as number,
    totalPurchased: data.total_purchased as number,
    totalSpent: data.total_spent as number,
  }
}

/**
 * Atomically add credits to a store for a purchase/subscription top-up.
 */
export async function addStoreCredits(
  storeId: string,
  amount: number,
  type: 'purchase' | 'subscription',
  requestId: string,
  description: string
): Promise<void> {
  const supabase = getAdminClient()

  const { error } = await supabase.rpc('add_store_credits', {
    p_store_id: storeId,
    p_amount: amount,
    p_type: type,
    p_request_id: requestId,
    p_description: description,
  })

  if (error) {
    logger.error(
      { storeId, amount, type, requestId, err: error.message },
      '[B2B Credits] Add RPC failed'
    )
    if (isMissingDatabaseObject(error.message, 'add_store_credits')) {
      throw new Error(
        'Add store credits requires migration 008_paddle_billing_schema.sql to be applied'
      )
    }
    throw new Error(`Add store credits failed: ${error.message}`)
  }
}

/**
 * Log a billed overage usage record without changing credit balance.
 */
export async function logStoreOverage(
  storeId: string,
  requestId: string,
  description: string,
  amount = 1
): Promise<void> {
  const supabase = getAdminClient()

  const { error } = await supabase.from('store_credit_transactions').insert({
    store_id: storeId,
    amount: -Math.abs(amount),
    type: 'overage',
    request_id: requestId,
    description,
  })

  if (error) {
    logger.error(
      { storeId, requestId, err: error.message },
      '[B2B Credits] Overage log insert failed'
    )
    throw new Error(`Failed to log overage transaction: ${error.message}`)
  }
}

/**
 * Billing metadata used to decide subscription/overage behavior.
 */
export async function getStoreBillingProfile(storeId: string): Promise<{
  subscriptionTier: SubscriptionTier | null
  subscriptionId: string | null
  subscriptionStatus: string | null
}> {
  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('stores')
    .select('subscription_tier, subscription_id, subscription_status')
    .eq('id', storeId)
    .single()

  if (error || !data) {
    logger.error({ storeId, err: error?.message }, '[B2B Credits] Billing profile query failed')
    return {
      subscriptionTier: null,
      subscriptionId: null,
      subscriptionStatus: null,
    }
  }

  const rawTier = data.subscription_tier as string | null
  const subscriptionTier =
    rawTier === 'starter' || rawTier === 'growth' || rawTier === 'scale' ? rawTier : null

  return {
    subscriptionTier,
    subscriptionId: (data.subscription_id as string | null) ?? null,
    subscriptionStatus: (data.subscription_status as string | null) ?? null,
  }
}
