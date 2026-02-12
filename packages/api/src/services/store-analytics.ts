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

export type StoreAnalyticsEventType =
  | 'generation_queued'
  | 'generation_completed'
  | 'generation_failed'
  | 'generation_moderation_blocked'
  | 'credit_purchased'
  | 'credit_deducted'
  | 'credit_refunded'
  | 'store_credit_insufficient'

export async function logStoreAnalyticsEvent(
  storeId: string,
  eventType: StoreAnalyticsEventType,
  metadata: Record<string, unknown> = {},
  shopperEmail?: string,
): Promise<void> {
  const supabase = getServiceClient()

  const row: Record<string, unknown> = {
    store_id: storeId,
    event_type: eventType,
    metadata,
  }
  if (shopperEmail) {
    row.shopper_email = shopperEmail
  }

  const { error } = await supabase.from('store_analytics_events').insert(row)

  if (error) {
    logger.error(
      { storeId, eventType, err: error.message },
      '[B2B Analytics] Failed to log analytics event'
    )
  }
}
