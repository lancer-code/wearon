import { NextRequest, NextResponse } from 'next/server'
import { cleanupExpiredFiles, cleanupOldSessions, recoverStuckJobs } from '@api/services/storage-cleanup'

// Vercel Cron Job: Cleanup expired files from Supabase Storage
// Schedule: Daily at midnight UTC (cron: 0 0 * * *)
// Set CRON_SECRET environment variable in Vercel dashboard
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

    // Recover stuck jobs (processing/pending for more than 10 minutes)
    const stuckJobsResult = await recoverStuckJobs()

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
        stuckJobs: {
          recovered: stuckJobsResult.recoveredCount,
          refunded: stuckJobsResult.refundedCount,
          errors: stuckJobsResult.errors.length,
        },
      },
      errors: [...fileCleanupResult.errors, ...stuckJobsResult.errors.map(e => ({ file: e.sessionId, error: e.error }))],
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
