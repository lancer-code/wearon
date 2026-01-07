import { NextRequest, NextResponse } from 'next/server'
import { cleanupExpiredFiles, cleanupOldSessions } from '../../../../../../../packages/api/src/services/storage-cleanup'

/**
 * Vercel Cron Job: Cleanup expired files from Supabase Storage
 *
 * Schedule: Every 6 hours
 * Vercel cron expression: 0 */6 * * *
 *
 * To configure in Vercel:
 * 1. Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/cleanup",
 *     "schedule": "0 */6 * * *"
 *   }]
 * }
 *
 * 2. Set CRON_SECRET environment variable in Vercel dashboard
 */
export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 500 }
    )
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const startTime = Date.now()

    // Clean up expired files from storage
    const fileCleanupResult = await cleanupExpiredFiles()

    // Clean up old session URLs in database
    const sessionsUpdated = await cleanupOldSessions()

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration,
      results: {
        files: {
          total: fileCleanupResult.deletedCount,
          folders: fileCleanupResult.folders,
          errors: fileCleanupResult.errors.length,
        },
        sessions: {
          updated: sessionsUpdated,
        },
      },
      errors: fileCleanupResult.errors,
    })
  } catch (error) {
    console.error('[Cron] Cleanup failed:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request)
}
