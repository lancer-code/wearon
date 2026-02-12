import { createClient } from '@supabase/supabase-js'
import { withB2BAuth } from '../../../../../../../packages/api/src/middleware/b2b'
import { createChildLogger } from '../../../../../../../packages/api/src/logger'
import type { B2BContext } from '../../../../../../../packages/api/src/types/b2b'
import {
  errorResponse,
  successResponse,
} from '../../../../../../../packages/api/src/utils/b2b-response'

let serviceClient: ReturnType<typeof createClient> | null = null

function getServiceClient() {
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

function isValidISO8601(dateString: string): boolean {
  const date = new Date(dateString)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(dateString.substring(0, 10))
}

export async function handleGetAnalytics(request: Request, context: B2BContext) {
  const log = createChildLogger(context.requestId)
  const supabase = getServiceClient()

  const url = new URL(request.url)
  const startDate = url.searchParams.get('start_date')
  const endDate = url.searchParams.get('end_date')

  if (startDate && !isValidISO8601(startDate)) {
    return errorResponse('VALIDATION_ERROR', 'start_date must be a valid ISO 8601 date string', 400)
  }

  if (endDate && !isValidISO8601(endDate)) {
    return errorResponse('VALIDATION_ERROR', 'end_date must be a valid ISO 8601 date string', 400)
  }

  // Query generation sessions for stats
  let generationQuery = supabase
    .from('store_generation_sessions')
    .select('status')
    .eq('store_id', context.storeId)

  if (startDate) {
    generationQuery = generationQuery.gte('created_at', startDate)
  }
  if (endDate) {
    generationQuery = generationQuery.lte('created_at', endDate)
  }

  const { data: sessions, error: sessionsError } = await generationQuery

  if (sessionsError) {
    log.error(
      { err: sessionsError.message, storeId: context.storeId },
      '[B2B Analytics] Generation sessions query failed'
    )
    return errorResponse('INTERNAL_ERROR', 'Failed to retrieve analytics', 500)
  }

  const totalGenerations = sessions?.length ?? 0
  const completedGenerations = sessions?.filter((s) => s.status === 'completed').length ?? 0
  const failedGenerations = sessions?.filter((s) => s.status === 'failed').length ?? 0
  const successRate = totalGenerations > 0 ? completedGenerations / totalGenerations : 0

  // Query credit balance
  const { data: credits, error: creditsError } = await supabase
    .from('store_credits')
    .select('balance, total_purchased, total_spent')
    .eq('store_id', context.storeId)
    .single()

  if (creditsError) {
    log.error(
      { err: creditsError.message, storeId: context.storeId },
      '[B2B Analytics] Credits query failed'
    )
    return errorResponse('INTERNAL_ERROR', 'Failed to retrieve credit data', 500)
  }

  return successResponse({
    totalGenerations,
    completedGenerations,
    failedGenerations,
    successRate,
    creditsRemaining: credits?.balance ?? 0,
    creditsUsed: credits?.total_spent ?? 0,
  })
}

export const GET = withB2BAuth(handleGetAnalytics)
