import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '../logger'

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

/**
 * Atomically deduct 1 credit from a store's balance.
 * Returns true if deduction succeeded, false if insufficient balance.
 */
export async function deductStoreCredit(
  storeId: string,
  requestId: string,
  description = 'Generation credit deduction',
): Promise<boolean> {
  const supabase = getServiceClient()

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
  description = 'Generation failed - refund',
): Promise<void> {
  const supabase = getServiceClient()

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
 * Get the current credit balance for a store.
 */
export async function getStoreBalance(
  storeId: string,
): Promise<{ balance: number; totalPurchased: number; totalSpent: number }> {
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('store_credits')
    .select('balance, total_purchased, total_spent')
    .eq('store_id', storeId)
    .single()

  if (error || !data) {
    logger.error({ storeId, err: error?.message }, '[B2B Credits] Balance query failed')
    return { balance: 0, totalPurchased: 0, totalSpent: 0 }
  }

  return {
    balance: data.balance as number,
    totalPurchased: data.total_purchased as number,
    totalSpent: data.total_spent as number,
  }
}
