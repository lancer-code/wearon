import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase credentials not configured for storage cleanup')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const BUCKET_NAME = 'virtual-tryon-images'
const EXPIRY_HOURS = 6

export interface CleanupResult {
  deletedCount: number
  folders: {
    userUploads: number
    stitched: number
    generated: number
  }
  errors: Array<{ file: string; error: string }>
}

/**
 * Delete files older than specified hours from a specific folder
 */
async function cleanupFolder(folderPath: string, expiryHours: number): Promise<{
  deletedCount: number
  errors: Array<{ file: string; error: string }>
}> {
  const cutoffTime = new Date(Date.now() - expiryHours * 60 * 60 * 1000)
  let deletedCount = 0
  const errors: Array<{ file: string; error: string }> = []

  try {
    // List all files in the folder
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(folderPath, {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'asc' },
      })

    if (listError) {
      errors.push({ file: folderPath, error: listError.message })
      return { deletedCount, errors }
    }

    if (!files || files.length === 0) {
      return { deletedCount, errors }
    }

    // Filter files older than cutoff time
    const filesToDelete = files.filter((file) => {
      if (!file.created_at) return false
      const fileDate = new Date(file.created_at)
      return fileDate < cutoffTime
    })

    if (filesToDelete.length === 0) {
      return { deletedCount, errors }
    }

    // Delete files in batches of 100
    const batchSize = 100
    for (let i = 0; i < filesToDelete.length; i += batchSize) {
      const batch = filesToDelete.slice(i, i + batchSize)
      const filePaths = batch.map((file) => `${folderPath}/${file.name}`)

      const { error: deleteError } = await supabase.storage.from(BUCKET_NAME).remove(filePaths)

      if (deleteError) {
        filePaths.forEach((path) => {
          errors.push({ file: path, error: deleteError.message })
        })
      } else {
        deletedCount += filePaths.length
      }
    }

    return { deletedCount, errors }
  } catch (error) {
    errors.push({
      file: folderPath,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return { deletedCount, errors }
  }
}

/**
 * Cleanup old files from all folders in the storage bucket
 */
export async function cleanupExpiredFiles(): Promise<CleanupResult> {
  const result: CleanupResult = {
    deletedCount: 0,
    folders: {
      userUploads: 0,
      stitched: 0,
      generated: 0,
    },
    errors: [],
  }

  // Clean up user-uploads folder (user-submitted images)
  const userUploadsResult = await cleanupFolder('user-uploads', EXPIRY_HOURS)
  result.folders.userUploads = userUploadsResult.deletedCount
  result.deletedCount += userUploadsResult.deletedCount
  result.errors.push(...userUploadsResult.errors)

  // Clean up stitched folder (collages)
  const stitchedResult = await cleanupFolder('stitched', EXPIRY_HOURS)
  result.folders.stitched = stitchedResult.deletedCount
  result.deletedCount += stitchedResult.deletedCount
  result.errors.push(...stitchedResult.errors)

  // Clean up generated folder (AI-generated images)
  const generatedResult = await cleanupFolder('generated', EXPIRY_HOURS)
  result.folders.generated = generatedResult.deletedCount
  result.deletedCount += generatedResult.deletedCount
  result.errors.push(...generatedResult.errors)

  return result
}

/**
 * Clean up old generation sessions from database
 * (Keep metadata but mark URLs as expired)
 */
export async function cleanupOldSessions(): Promise<number> {
  const cutoffTime = new Date(Date.now() - EXPIRY_HOURS * 60 * 60 * 1000)

  const { data, error } = await supabase
    .from('generation_sessions')
    .update({
      model_image_url: 'expired',
      outfit_image_url: 'expired',
      stitched_image_url: 'expired',
      generated_image_url: 'expired',
    })
    .lt('created_at', cutoffTime.toISOString())
    .neq('model_image_url', 'expired')
    .select('id')

  if (error) {
    console.error('Error cleaning up old sessions:', error)
    return 0
  }

  return data?.length || 0
}
