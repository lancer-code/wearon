import axios from 'axios'
import { z } from 'zod'
import { createChildLogger } from '../../../../../../packages/api/src/logger'
import { withB2BAuth } from '../../../../../../packages/api/src/middleware/b2b'
import type { B2BContext } from '../../../../../../packages/api/src/types/b2b'
import {
  errorResponse,
  successResponse,
} from '../../../../../../packages/api/src/utils/b2b-response'

const WORKER_TIMEOUT_MS = 5000
const NFR2_TARGET_MS = 1000
const SIZE_REC_UNAVAILABLE_MESSAGE = 'Size recommendation temporarily unavailable'

// MEDIUM #3 FIX: Per-store rate limiting to prevent abuse of free endpoint
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 100 // 100 requests per hour per store
const storeRequestCounts = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(storeId: string): boolean {
  const now = Date.now()
  const existing = storeRequestCounts.get(storeId)

  if (!existing || now >= existing.resetAt) {
    storeRequestCounts.set(storeId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  existing.count += 1
  return true
}

function cleanupRateLimitCache(): void {
  const now = Date.now()
  for (const [storeId, data] of storeRequestCounts.entries()) {
    if (now >= data.resetAt) {
      storeRequestCounts.delete(storeId)
    }
  }
}

// Cleanup rate limit cache every 5 minutes
setInterval(cleanupRateLimitCache, 5 * 60 * 1000)

// LOW #5 FIX: Hash worker URL to prevent infrastructure exposure in logs
function hashWorkerUrl(url: string | null): string {
  if (!url) return 'not_configured'
  // Simple hash for logging - not cryptographic, just obfuscation
  let hash = 0
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return `worker_${Math.abs(hash).toString(16)}`
}

function createSizeRecRequestSchema() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  return z.object({
    image_url: z
      .string()
      .url()
      .refine(
        (url) => {
          if (!supabaseUrl) return false
          try {
            const supabaseDomain = new URL(supabaseUrl).hostname
            const urlDomain = new URL(url).hostname
            return urlDomain === supabaseDomain || urlDomain.endsWith(`.${supabaseDomain}`)
          } catch {
            return false
          }
        },
        { message: 'image_url must be from trusted storage domain' }
      ),
    height_cm: z.number().min(100).max(250).refine(
      (val) => {
        // MEDIUM #2 FIX: Prevent excessive floating-point precision
        // Allow max 1 decimal place (e.g., 175.5)
        // Check if val * 10 is an integer (meaning at most 1 decimal place)
        return Number.isFinite(val) && Number.isInteger(val * 10)
      },
      { message: 'height_cm must have at most 1 decimal place' }
    ),
  })
}

const ALLOWED_MEASUREMENT_KEYS = [
  'chest_cm',
  'waist_cm',
  'hip_cm',
  'shoulder_cm',
  'inseam_cm',
  'height_cm',
] as const

const sizeRecWorkerResponseSchema = z.object({
  recommended_size: z.string(),
  measurements: z.record(z.number()).refine(
    (measurements) => {
      const keys = Object.keys(measurements)
      // HIGH #1 FIX: Limit measurement object size to prevent DoS
      if (keys.length > 20) return false
      // Validate all keys are in allowed list
      return keys.every((key) => ALLOWED_MEASUREMENT_KEYS.includes(key as any))
    },
    { message: 'Invalid or excessive measurement keys' }
  ),
  confidence: z.number(),
  body_type: z.string().nullable(),
})

function resolveWorkerApiUrl(): string | null {
  const workerApiUrl = process.env.WORKER_API_URL
  if (!workerApiUrl || !workerApiUrl.trim()) {
    return null
  }

  return workerApiUrl.replace(/\/+$/, '')
}

function toWorkerEndpoint(workerApiUrl: string): string {
  return `${workerApiUrl}/estimate-body`
}

function isWorkerUnavailableError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) {
    return false
  }

  if (err.code === 'ECONNABORTED' || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return true
  }

  if (typeof err.response?.status !== 'number') {
    return true
  }

  return err.response.status >= 500
}

export async function handleSizeRecPost(request: Request, context: B2BContext) {
  const log = createChildLogger(context.requestId)

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return errorResponse('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  const sizeRecRequestSchema = createSizeRecRequestSchema()
  const parsedBody = sizeRecRequestSchema.safeParse(rawBody)
  if (!parsedBody.success) {
    const issues = parsedBody.error.issues.map((i) => i.message).join(', ')
    return errorResponse(
      'VALIDATION_ERROR',
      `Validation failed: ${issues}`,
      400
    )
  }

  // MEDIUM #3 FIX: Check per-store rate limit
  if (!checkRateLimit(context.storeId)) {
    log.warn({ store_id: context.storeId }, '[B2B Size Rec] Rate limit exceeded')
    return errorResponse(
      'RATE_LIMIT_EXCEEDED',
      `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per hour.`,
      429
    )
  }

  const workerApiUrl = resolveWorkerApiUrl()
  if (!workerApiUrl) {
    log.error({ worker_id: hashWorkerUrl(null) }, '[B2B Size Rec] WORKER_API_URL not configured')
    return errorResponse('SERVICE_UNAVAILABLE', SIZE_REC_UNAVAILABLE_MESSAGE, 503)
  }

  const workerEndpoint = toWorkerEndpoint(workerApiUrl)
  const startedAtMs = Date.now()

  try {
    const workerResponse = await axios.post(
      workerEndpoint,
      {
        image_url: parsedBody.data.image_url,
        height_cm: parsedBody.data.height_cm,
      },
      {
        timeout: WORKER_TIMEOUT_MS,
        headers: {
          'X-Request-Id': context.requestId,
        },
      }
    )

    const parsedWorkerResponse = sizeRecWorkerResponseSchema.safeParse(workerResponse.data)
    if (!parsedWorkerResponse.success) {
      log.error({ worker_id: hashWorkerUrl(workerApiUrl) }, '[B2B Size Rec] Invalid worker response payload')
      return errorResponse('SERVICE_UNAVAILABLE', SIZE_REC_UNAVAILABLE_MESSAGE, 503)
    }

    const responseTimeMs = Date.now() - startedAtMs
    if (responseTimeMs > NFR2_TARGET_MS) {
      log.warn(
        {
          worker_id: hashWorkerUrl(workerApiUrl),
          response_time_ms: responseTimeMs,
          nfr_target_ms: NFR2_TARGET_MS,
        },
        '[B2B Size Rec] Response exceeded NFR2 target'
      )
    }

    // LOW #4 FIX: Removed timing headers to prevent ML model inference attacks
    // Timing is still logged server-side for monitoring NFR2
    const response = successResponse({
      recommended_size: parsedWorkerResponse.data.recommended_size,
      measurements: parsedWorkerResponse.data.measurements,
      confidence: parsedWorkerResponse.data.confidence,
      body_type: parsedWorkerResponse.data.body_type,
    })
    return response
  } catch (err) {
    const responseTimeMs = Date.now() - startedAtMs
    log.error(
      {
        worker_id: hashWorkerUrl(workerApiUrl),
        error_code: axios.isAxiosError(err) ? err.code : 'UNKNOWN',
        status: axios.isAxiosError(err) ? err.response?.status : null,
        response_time_ms: responseTimeMs,
      },
      '[B2B Size Rec] Worker request failed'
    )

    if (isWorkerUnavailableError(err)) {
      return errorResponse('SERVICE_UNAVAILABLE', SIZE_REC_UNAVAILABLE_MESSAGE, 503)
    }

    if (axios.isAxiosError(err) && err.response?.status && err.response.status >= 400 && err.response.status < 500) {
      return errorResponse('VALIDATION_ERROR', 'Worker rejected the request', 400)
    }

    return errorResponse('INTERNAL_ERROR', 'Failed to process size recommendation request', 500)
  }
}

export const POST = withB2BAuth(handleSizeRecPost)
