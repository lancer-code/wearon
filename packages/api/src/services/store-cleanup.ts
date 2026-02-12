import { createClient } from '@supabase/supabase-js'
import { createChildLogger } from '../logger'

export interface CleanupResult {
  storeId: string
  apiKeysDeleted: number
  jobsCancelled: number
  storageFilesDeleted: number
  alreadyInactive: boolean
}

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceKey)
}

export async function cleanupStore(storeId: string, requestId: string): Promise<CleanupResult> {
  const log = createChildLogger(requestId)
  const supabase = getAdminSupabase()

  const result: CleanupResult = {
    storeId,
    apiKeysDeleted: 0,
    jobsCancelled: 0,
    storageFilesDeleted: 0,
    alreadyInactive: false,
  }

  // Check if store is already inactive (idempotency)
  const { data: store } = await supabase
    .from('stores')
    .select('status')
    .eq('id', storeId)
    .single()

  if (!store) {
    log.warn({ storeId }, '[StoreCleanup] Store not found')
    return result
  }

  if (store.status === 'inactive') {
    log.info({ storeId }, '[StoreCleanup] Store already inactive, skipping cleanup')
    result.alreadyInactive = true
    return result
  }

  // Delete API keys
  const { data: deletedKeys } = await supabase
    .from('store_api_keys')
    .delete()
    .eq('store_id', storeId)
    .select('id')

  result.apiKeysDeleted = deletedKeys?.length ?? 0
  log.info({ storeId, count: result.apiKeysDeleted }, '[StoreCleanup] API keys deleted')

  // Mark store as inactive
  await supabase
    .from('stores')
    .update({ status: 'inactive', updated_at: new Date().toISOString() })
    .eq('id', storeId)

  log.info({ storeId }, '[StoreCleanup] Store marked inactive')

  // Cancel queued generation jobs
  const { data: cancelledJobs } = await supabase
    .from('store_generation_sessions')
    .update({ status: 'failed', error_message: 'Store uninstalled' })
    .eq('store_id', storeId)
    .eq('status', 'queued')
    .select('id')

  result.jobsCancelled = cancelledJobs?.length ?? 0
  log.info({ storeId, count: result.jobsCancelled }, '[StoreCleanup] Queued jobs cancelled')

  // Schedule storage cleanup: delete files under stores/{store_id}/
  try {
    const { data: files } = await supabase.storage
      .from('uploads')
      .list(`stores/${storeId}`)

    if (files && files.length > 0) {
      const filePaths = files.map((f) => `stores/${storeId}/${f.name}`)
      await supabase.storage.from('uploads').remove(filePaths)
      result.storageFilesDeleted = filePaths.length
      log.info({ storeId, count: result.storageFilesDeleted }, '[StoreCleanup] Storage files deleted')
    }
  } catch (err) {
    log.error(
      { storeId, err: err instanceof Error ? err.message : 'Unknown' },
      '[StoreCleanup] Storage cleanup failed (non-fatal)',
    )
  }

  log.info({ storeId, result }, '[StoreCleanup] Cleanup complete')
  return result
}
