import { type SupabaseClient, createClient } from '@supabase/supabase-js'
import { logger } from '../logger'

const CHURN_THRESHOLD = 0.5 // 50% week-over-week decrease

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceKey)
}

export interface ChurnDetectionResult {
  storeId: string
  currentWeekCount: number
  previousWeekCount: number
  isChurnRisk: boolean
  changePercent: number
}

/**
 * Detect churn risk for a single store by comparing current vs previous week generation counts.
 * Flags as churn risk if week-over-week decrease > 50%.
 */
export async function detectChurnRisk(
  storeId: string,
  // biome-ignore lint: SupabaseClient generic variance
  supabase?: SupabaseClient<any>,
): Promise<ChurnDetectionResult> {
  const db = supabase || getAdminSupabase()
  const now = new Date()

  const currentWeekStart = new Date(now)
  currentWeekStart.setDate(now.getDate() - 7)

  const previousWeekStart = new Date(now)
  previousWeekStart.setDate(now.getDate() - 14)

  // Current week generation count
  const { count: currentWeekCount, error: currentError } = await db
    .from('store_generation_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .gte('created_at', currentWeekStart.toISOString())

  if (currentError) {
    throw new Error(`Failed to query current week: ${currentError.message}`)
  }

  // Previous week generation count
  const { count: previousWeekCount, error: previousError } = await db
    .from('store_generation_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .gte('created_at', previousWeekStart.toISOString())
    .lt('created_at', currentWeekStart.toISOString())

  if (previousError) {
    throw new Error(`Failed to query previous week: ${previousError.message}`)
  }

  const current = currentWeekCount || 0
  const previous = previousWeekCount || 0

  // Calculate change percentage (avoid division by zero)
  let changePercent = 0
  let isChurnRisk = false

  if (previous > 0) {
    changePercent = (current - previous) / previous
    isChurnRisk = changePercent <= -CHURN_THRESHOLD
  }
  // If previous was 0 and current is also 0, not a churn risk (no activity baseline)
  // If previous was 0 and current > 0, growth — not churn

  return {
    storeId,
    currentWeekCount: current,
    previousWeekCount: previous,
    isChurnRisk,
    changePercent: Math.round(changePercent * 100),
  }
}

/**
 * Run churn detection for all active stores and update flags.
 * Returns count of newly flagged and unflagged stores.
 */
export async function runChurnDetectionForAllStores(): Promise<{
  processed: number
  newlyFlagged: number
  unflagged: number
  errors: Array<{ storeId: string; error: string }>
}> {
  const db = getAdminSupabase()

  // Get all active stores
  const { data: stores, error: storesError } = await db
    .from('stores')
    .select('id, shop_domain, is_churn_risk')
    .eq('status', 'active')

  if (storesError) {
    throw new Error(`Failed to fetch stores: ${storesError.message}`)
  }

  const results = {
    processed: 0,
    newlyFlagged: 0,
    unflagged: 0,
    errors: [] as Array<{ storeId: string; error: string }>,
  }

  for (const store of stores || []) {
    try {
      const detection = await detectChurnRisk(store.id, db)
      results.processed++

      if (detection.isChurnRisk && !store.is_churn_risk) {
        // Newly flagged
        await db
          .from('stores')
          .update({
            is_churn_risk: true,
            churn_flagged_at: new Date().toISOString(),
          })
          .eq('id', store.id)

        results.newlyFlagged++
        logger.info({
          storeId: store.id,
          shopDomain: store.shop_domain,
          changePercent: detection.changePercent,
          msg: 'Store flagged as churn risk',
        })
      } else if (!detection.isChurnRisk && store.is_churn_risk) {
        // No longer at risk — unflag
        await db
          .from('stores')
          .update({
            is_churn_risk: false,
          })
          .eq('id', store.id)

        results.unflagged++
        logger.info({
          storeId: store.id,
          shopDomain: store.shop_domain,
          msg: 'Store churn risk cleared',
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      results.errors.push({ storeId: store.id, error: message })
      logger.error({
        storeId: store.id,
        error: message,
        msg: 'Churn detection failed for store',
      })
    }
  }

  return results
}

export { CHURN_THRESHOLD }
