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
    height_cm: z.number().min(100).max(250),
  })
}

const sizeRecWorkerResponseSchema = z.object({
  recommended_size: z.string(),
  measurements: z.record(z.number()),
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

  const workerApiUrl = resolveWorkerApiUrl()
  if (!workerApiUrl) {
    log.error({ worker_url: null }, '[B2B Size Rec] WORKER_API_URL not configured')
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
      log.error({ worker_url: workerApiUrl }, '[B2B Size Rec] Invalid worker response payload')
      return errorResponse('SERVICE_UNAVAILABLE', SIZE_REC_UNAVAILABLE_MESSAGE, 503)
    }

    const responseTimeMs = Date.now() - startedAtMs
    if (responseTimeMs > NFR2_TARGET_MS) {
      log.warn(
        {
          worker_url: workerApiUrl,
          response_time_ms: responseTimeMs,
          nfr_target_ms: NFR2_TARGET_MS,
        },
        '[B2B Size Rec] Response exceeded NFR2 target'
      )
    }

    const response = successResponse({
      recommended_size: parsedWorkerResponse.data.recommended_size,
      measurements: parsedWorkerResponse.data.measurements,
      confidence: parsedWorkerResponse.data.confidence,
      body_type: parsedWorkerResponse.data.body_type,
    })
    response.headers.set('X-Size-Rec-Latency-Ms', String(responseTimeMs))
    response.headers.set('X-Size-Rec-Target-Ms', String(NFR2_TARGET_MS))
    return response
  } catch (err) {
    const responseTimeMs = Date.now() - startedAtMs
    log.error(
      {
        worker_url: workerApiUrl,
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
