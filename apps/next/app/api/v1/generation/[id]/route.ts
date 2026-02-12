import { withB2BAuth } from '../../../../../../../packages/api/src/middleware/b2b'
import { createChildLogger } from '../../../../../../../packages/api/src/logger'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
} from '../../../../../../../packages/api/src/utils/b2b-response'
import { createClient } from '@supabase/supabase-js'

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

export async function handleGenerationStatusGet(
  request: Request,
  context: {
    storeId: string
    requestId: string
  }
) {
  const log = createChildLogger(context.requestId)

  // Extract session ID from URL path
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  const sessionId = segments[segments.length - 1]

  if (!sessionId) {
    return errorResponse('VALIDATION_ERROR', 'Session ID is required', 400)
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(sessionId)) {
    return errorResponse('VALIDATION_ERROR', 'Invalid session ID format', 400)
  }

  const supabase = getServiceClient()

  // Query scoped to store_id — prevents cross-tenant access
  const { data: session, error } = await supabase
    .from('store_generation_sessions')
    .select(
      'id, store_id, status, model_image_url, outfit_image_url, generated_image_url, error_message, credits_used, request_id, created_at, completed_at'
    )
    .eq('id', sessionId)
    .eq('store_id', context.storeId)
    .single()

  if (error?.code === 'PGRST116') {
    log.info({ sessionId, storeId: context.storeId }, '[B2B Generation] Session not found')
    return notFoundResponse('Generation session not found')
  }

  if (error) {
    log.error(
      { sessionId, storeId: context.storeId, err: error.message, code: error.code },
      '[B2B Generation] Session query failed'
    )
    return errorResponse('INTERNAL_ERROR', 'Failed to load generation session', 500)
  }

  if (!session) {
    log.info({ sessionId, storeId: context.storeId }, '[B2B Generation] Session not found')
    return notFoundResponse('Generation session not found')
  }

  return successResponse({
    sessionId: session.id,
    status: session.status,
    modelImageUrl: session.model_image_url,
    outfitImageUrl: session.outfit_image_url,
    generatedImageUrl: session.generated_image_url,
    errorMessage: session.error_message,
    creditsUsed: session.credits_used,
    requestId: session.request_id,
    createdAt: session.created_at,
    completedAt: session.completed_at,
  })
}

export const GET = withB2BAuth(handleGenerationStatusGet)
