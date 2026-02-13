import { getAdminClient } from '../lib/supabase-admin'
import { logger } from '../logger'

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
  const supabase = getAdminClient()

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
