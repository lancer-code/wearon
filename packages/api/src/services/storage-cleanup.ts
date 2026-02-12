import { createClient } from '@supabase/supabase-js'
import { logger } from '../logger'

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
    uploads: number
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
      uploads: 0,
      generated: 0,
    },
    errors: [],
  }

  // Clean up uploads folder (user-submitted images via presigned URLs)
  const uploadsResult = await cleanupFolder('uploads', EXPIRY_HOURS)
  result.folders.uploads = uploadsResult.deletedCount
  result.deletedCount += uploadsResult.deletedCount
  result.errors.push(...uploadsResult.errors)

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
      generated_image_url: 'expired',
    })
    .lt('created_at', cutoffTime.toISOString())
    .neq('model_image_url', 'expired')
    .select('id')

  if (error) {
    logger.error({ err: error }, 'Error cleaning up old sessions')
    return 0
  }

  return data?.length || 0
}

// Stuck job timeout in minutes
const STUCK_JOB_TIMEOUT_MINUTES = 10

export interface StuckJobRecoveryResult {
  recoveredCount: number
  refundedCount: number
  errors: Array<{ sessionId: string; error: string }>
}

/**
 * Recover stuck jobs that have been processing for too long
 * - Find sessions in 'processing' or 'pending' status for more than 10 minutes
 * - Mark them as failed and refund credits
 */
export async function recoverStuckJobs(): Promise<StuckJobRecoveryResult> {
  const result: StuckJobRecoveryResult = {
    recoveredCount: 0,
    refundedCount: 0,
    errors: [],
  }

  const cutoffTime = new Date(Date.now() - STUCK_JOB_TIMEOUT_MINUTES * 60 * 1000)

  try {
    // Find stuck sessions (processing or pending for too long)
    const { data: stuckSessions, error: fetchError } = await supabase
      .from('generation_sessions')
      .select('id, user_id, status, created_at')
      .in('status', ['processing', 'pending'])
      .lt('created_at', cutoffTime.toISOString())

    if (fetchError) {
      result.errors.push({ sessionId: 'fetch', error: fetchError.message })
      return result
    }

    if (!stuckSessions || stuckSessions.length === 0) {
      return result
    }

    logger.info(`[StuckJobRecovery] Found ${stuckSessions.length} stuck sessions`)

    // Process each stuck session
    for (const session of stuckSessions) {
      try {
        // Refund credits
        const { error: refundError } = await supabase.rpc('refund_credits', {
          p_user_id: session.user_id,
          p_amount: 1,
          p_description: `Stuck job recovery: session ${session.id} timed out after ${STUCK_JOB_TIMEOUT_MINUTES} minutes`,
        })

        if (refundError) {
          result.errors.push({ sessionId: session.id, error: `Refund failed: ${refundError.message}` })
        } else {
          result.refundedCount++
        }

        // Mark session as failed
        const { error: updateError } = await supabase
          .from('generation_sessions')
          .update({
            status: 'failed',
            error_message: `Job timed out after ${STUCK_JOB_TIMEOUT_MINUTES} minutes - credits refunded`,
            completed_at: new Date().toISOString(),
          })
          .eq('id', session.id)

        if (updateError) {
          result.errors.push({ sessionId: session.id, error: `Update failed: ${updateError.message}` })
        } else {
          result.recoveredCount++
        }

        // Log analytics event
        await supabase.from('analytics_events').insert({
          event_type: 'stuck_job_recovered',
          user_id: session.user_id,
          metadata: {
            session_id: session.id,
            original_status: session.status,
            stuck_duration_minutes: Math.round((Date.now() - new Date(session.created_at).getTime()) / 60000),
          },
        })
      } catch (sessionError) {
        result.errors.push({
          sessionId: session.id,
          error: sessionError instanceof Error ? sessionError.message : 'Unknown error',
        })
      }
    }

    logger.info(`[StuckJobRecovery] Recovered ${result.recoveredCount} sessions, refunded ${result.refundedCount} credits`)
    return result
  } catch (error) {
    result.errors.push({
      sessionId: 'general',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return result
  }
}
