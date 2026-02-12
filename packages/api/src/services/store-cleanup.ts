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
    log.info({ storeId }, '[StoreCleanup] Store already inactive, re-running cleanup for idempotent retry')
    result.alreadyInactive = true
    // Continue with cleanup to ensure API keys/jobs/storage are cleaned even if store status was set
  }

  // Delete API keys (check error)
  const { data: deletedKeys, error: deleteKeysError } = await supabase
    .from('store_api_keys')
    .delete()
    .eq('store_id', storeId)
    .select('id')

  if (deleteKeysError) {
    log.error({ storeId, err: deleteKeysError.message }, '[StoreCleanup] Failed to delete API keys')
    throw new Error(`API key deletion failed: ${deleteKeysError.message}`)
  }

  result.apiKeysDeleted = deletedKeys?.length ?? 0
  log.info({ storeId, count: result.apiKeysDeleted }, '[StoreCleanup] API keys deleted')

  // Mark store as inactive (check error)
  const { error: updateError } = await supabase
    .from('stores')
    .update({ status: 'inactive', updated_at: new Date().toISOString() })
    .eq('id', storeId)

  if (updateError) {
    log.error({ storeId, err: updateError.message }, '[StoreCleanup] Failed to mark store inactive')
    throw new Error(`Store update failed: ${updateError.message}`)
  }

  log.info({ storeId }, '[StoreCleanup] Store marked inactive')

  // Cancel queued generation jobs (check error)
  const { data: cancelledJobs, error: cancelJobsError } = await supabase
    .from('store_generation_sessions')
    .update({ status: 'failed', error_message: 'Store uninstalled' })
    .eq('store_id', storeId)
    .eq('status', 'queued')
    .select('id')

  if (cancelJobsError) {
    log.error({ storeId, err: cancelJobsError.message }, '[StoreCleanup] Failed to cancel jobs')
    throw new Error(`Job cancellation failed: ${cancelJobsError.message}`)
  }

  result.jobsCancelled = cancelledJobs?.length ?? 0
  log.info({ storeId, count: result.jobsCancelled }, '[StoreCleanup] Queued jobs cancelled')

  // Schedule storage cleanup: delete files from both uploads and generated buckets
  const buckets = ['uploads', 'generated']

  for (const bucket of buckets) {
    try {
      // Paginated file listing to handle large file sets
      let offset = 0
      const limit = 1000
      let hasMore = true

      while (hasMore) {
        const { data: files, error: listError } = await supabase.storage
          .from(bucket)
          .list(`stores/${storeId}`, {
            limit,
            offset,
            sortBy: { column: 'name', order: 'asc' },
          })

        if (listError) {
          log.error(
            { storeId, bucket, err: listError.message },
            '[StoreCleanup] Storage list failed',
          )
          break
        }

        if (!files || files.length === 0) {
          hasMore = false
          break
        }

        // Delete files in batch
        const filePaths = files.map((f) => `stores/${storeId}/${f.name}`)
        const { error: removeError } = await supabase.storage.from(bucket).remove(filePaths)

        if (removeError) {
          log.error(
            { storeId, bucket, count: filePaths.length, err: removeError.message },
            '[StoreCleanup] Storage delete failed',
          )
        } else {
          result.storageFilesDeleted += filePaths.length
          log.info(
            { storeId, bucket, count: filePaths.length },
            '[StoreCleanup] Storage batch deleted',
          )
        }

        // Check if there are more files
        hasMore = files.length === limit
        offset += limit
      }
    } catch (err) {
      log.error(
        { storeId, bucket, err: err instanceof Error ? err.message : 'Unknown' },
        '[StoreCleanup] Storage cleanup failed (non-fatal)',
      )
    }
  }

  log.info({ storeId, result }, '[StoreCleanup] Cleanup complete')
  return result
}
