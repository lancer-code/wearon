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
const SIZE_REC_UNAVAILABLE_MESSAGE = 'Size recommendation temporarily unavailable'

const sizeRecRequestSchema = z.object({
  image_url: z.string().url(),
  height_cm: z.number().min(100).max(250),
})

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

  const parsedBody = sizeRecRequestSchema.safeParse(rawBody)
  if (!parsedBody.success) {
    return errorResponse(
      'VALIDATION_ERROR',
      'image_url must be a valid URL and height_cm must be between 100 and 250',
      400
    )
  }

  const workerApiUrl = resolveWorkerApiUrl()
  if (!workerApiUrl) {
    log.error({ worker_url: null }, '[B2B Size Rec] WORKER_API_URL not configured')
    return errorResponse('SERVICE_UNAVAILABLE', SIZE_REC_UNAVAILABLE_MESSAGE, 503)
  }

  const workerEndpoint = toWorkerEndpoint(workerApiUrl)

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

    return successResponse({
      recommendedSize: parsedWorkerResponse.data.recommended_size,
      measurements: parsedWorkerResponse.data.measurements,
      confidence: parsedWorkerResponse.data.confidence,
      bodyType: parsedWorkerResponse.data.body_type,
    })
  } catch (err) {
    log.error(
      {
        worker_url: workerApiUrl,
        error_code: axios.isAxiosError(err) ? err.code : 'UNKNOWN',
        status: axios.isAxiosError(err) ? err.response?.status : null,
      },
      '[B2B Size Rec] Worker request failed'
    )

    if (isWorkerUnavailableError(err)) {
      return errorResponse('SERVICE_UNAVAILABLE', SIZE_REC_UNAVAILABLE_MESSAGE, 503)
    }

    return errorResponse('INTERNAL_ERROR', 'Failed to process size recommendation request', 500)
  }
}

export const POST = withB2BAuth(handleSizeRecPost)
