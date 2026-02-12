import type { NextResponse } from 'next/server'
import { createChildLogger } from '../logger'
import type { B2BContext } from '../types/b2b'
import { errorResponse } from '../utils/b2b-response'
import { authenticateApiKey } from './api-key-auth'
import { addCorsHeaders, checkCors, handlePreflight } from './cors'
import { checkRateLimit } from './rate-limit'
import { extractRequestId } from './request-id'

export function withB2BAuth(
  handler: (request: Request, context: B2BContext) => Promise<NextResponse>,
): (request: Request) => Promise<NextResponse> {
  return async (request: Request): Promise<NextResponse> => {
    const requestId = extractRequestId(request)
    const log = createChildLogger(requestId)

    try {
      // Handle OPTIONS preflight before auth (browser sends preflight without Authorization)
      const preflightResult = handlePreflight(request, [])
      if (preflightResult) {
        return preflightResult
      }

      // Authenticate API key
      const authResult = await authenticateApiKey(request)
      if ('error' in authResult) {
        return authResult.error
      }

      const { context } = authResult

      // Now that we have the store's allowed domains, handle OPTIONS for authenticated preflight
      if (request.method === 'OPTIONS') {
        const preflightWithDomains = handlePreflight(request, context.allowedDomains)
        if (preflightWithDomains) {
          return preflightWithDomains
        }
      }

      // Check CORS
      const corsResult = checkCors(request, context.allowedDomains)
      if (corsResult) {
        return corsResult
      }

      // Check rate limit
      const rateLimitResult = await checkRateLimit(context.storeId, context.subscriptionTier)
      if (!rateLimitResult.allowed) {
        return rateLimitResult.response
      }

      // Execute handler
      const response = await handler(request, context)

      // Add rate limit headers to successful responses
      response.headers.set('X-RateLimit-Limit', String(rateLimitResult.headers.limit))
      response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.headers.remaining))
      response.headers.set('X-RateLimit-Reset', String(rateLimitResult.headers.reset))

      // Add CORS headers
      const origin = request.headers.get('origin')
      addCorsHeaders(response, origin)

      return response
    } catch (err) {
      log.error({ err }, 'Unhandled error in B2B middleware')
      return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500)
    }
  }
}
