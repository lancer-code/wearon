import { NextRequest, NextResponse } from 'next/server'
import { runChurnDetectionForAllStores } from '../../../../../../../packages/api/src/services/churn-detection'

/**
 * Vercel Cron Job: Churn Detection
 *
 * Schedule: Weekly (every Monday at 6:00 AM UTC)
 * Vercel cron expression: 0 6 * * 1
 *
 * Compares current vs previous week generation counts for all active stores.
 * Flags stores with >50% week-over-week generation drop as churn risk.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 500 },
    )
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    )
  }

  try {
    const startTime = Date.now()

    const results = await runChurnDetectionForAllStores()

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration,
      results: {
        processed: results.processed,
        newlyFlagged: results.newlyFlagged,
        unflagged: results.unflagged,
        errors: results.errors.length,
      },
      errors: results.errors,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
