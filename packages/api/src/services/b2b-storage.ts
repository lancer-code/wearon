import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '../logger'

const B2B_BUCKET = 'virtual-tryon-images'

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
 * Get the storage path prefix for a store's uploads.
 * Format: stores/{store_id}/uploads/
 */
export function getStoreUploadPath(storeId: string): string {
  return `stores/${storeId}/uploads`
}

/**
 * Get the storage path prefix for a store's generated images.
 * Format: stores/{store_id}/generated/
 */
export function getStoreGeneratedPath(storeId: string): string {
  return `stores/${storeId}/generated`
}

/**
 * Create presigned upload URLs scoped to a store's storage path.
 */
export async function createStoreUploadUrls(
  storeId: string,
  files: { fileName: string; contentType: string }[],
): Promise<{ path: string; uploadUrl: string; token: string }[]> {
  const supabase = getServiceClient()
  const prefix = getStoreUploadPath(storeId)

  const results = await Promise.all(
    files.map(async (file) => {
      const ext = file.fileName.split('.').pop() ?? 'jpg'
      const path = `${prefix}/${Date.now()}-${crypto.randomUUID()}.${ext}`

      const { data, error } = await supabase.storage
        .from(B2B_BUCKET)
        .createSignedUploadUrl(path)

      if (error) {
        logger.error(
          { storeId, fileName: file.fileName, err: error.message },
          '[B2B Storage] Failed to create upload URL',
        )
        throw new Error(`Failed to create upload URL: ${error.message}`)
      }

      return {
        path,
        uploadUrl: data.signedUrl,
        token: data.token,
      }
    }),
  )

  return results
}

/**
 * Create signed download URLs for store files.
 */
export async function createStoreDownloadUrls(
  storeId: string,
  paths: string[],
  expiresIn = 6 * 60 * 60,
): Promise<{ path: string; downloadUrl: string }[]> {
  const supabase = getServiceClient()
  const prefix = getStoreUploadPath(storeId)

  const results = await Promise.all(
    paths.map(async (filePath) => {
      // Verify path belongs to this store
      if (!filePath.startsWith(`stores/${storeId}/`)) {
        throw new Error('Access denied: path does not belong to this store')
      }

      const { data, error } = await supabase.storage
        .from(B2B_BUCKET)
        .createSignedUrl(filePath, expiresIn)

      if (error) {
        logger.error(
          { storeId, path: filePath, err: error.message },
          '[B2B Storage] Failed to create download URL',
        )
        throw new Error(`Failed to create download URL: ${error.message}`)
      }

      return {
        path: filePath,
        downloadUrl: data.signedUrl,
      }
    }),
  )

  return results
}
