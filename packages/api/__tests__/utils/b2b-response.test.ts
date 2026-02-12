import { describe, expect, it } from 'vitest'
import {
  errorResponse,
  forbiddenResponse,
  notFoundResponse,
  rateLimitResponse,
  serviceUnavailableResponse,
  successResponse,
  unauthorizedResponse,
} from '../../src/utils/b2b-response'

describe('successResponse', () => {
  it('wraps data in { data, error: null } format', async () => {
    const response = successResponse({ sessionId: 'abc', status: 'queued' })
    const body = await response.json()

    expect(body.data).toBeDefined()
    expect(body.error).toBeNull()
    expect(response.status).toBe(200)
  })

  it('converts camelCase keys to snake_case', async () => {
    const response = successResponse({ storeId: 'abc', createdAt: '2026-01-01' })
    const body = await response.json()

    expect(body.data).toEqual({ store_id: 'abc', created_at: '2026-01-01' })
  })
})

describe('errorResponse', () => {
  it('returns correct HTTP status', async () => {
    const response = errorResponse('INTERNAL_ERROR', 'Something failed', 500)
    expect(response.status).toBe(500)

    const body = await response.json()
    expect(body.data).toBeNull()
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(body.error.message).toBe('Something failed')
  })
})

describe('rateLimitResponse', () => {
  it('returns 429 with rate limit headers', async () => {
    const response = rateLimitResponse('RATE_LIMIT_EXCEEDED', 'Too many requests', {
      limit: 100,
      remaining: 0,
      reset: 1234567890,
    })

    expect(response.status).toBe(429)
    expect(response.headers.get('X-RateLimit-Limit')).toBe('100')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(response.headers.get('X-RateLimit-Reset')).toBe('1234567890')

    const body = await response.json()
    expect(body.data).toBeNull()
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED')
  })
})

describe('convenience responses', () => {
  it('unauthorizedResponse returns 401', async () => {
    const response = unauthorizedResponse()
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error.code).toBe('INVALID_API_KEY')
  })

  it('forbiddenResponse returns 403', async () => {
    const response = forbiddenResponse()
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error.code).toBe('DOMAIN_MISMATCH')
  })

  it('notFoundResponse returns 404', async () => {
    const response = notFoundResponse()
    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('serviceUnavailableResponse returns 503', async () => {
    const response = serviceUnavailableResponse()
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE')
  })

  it('all error responses have { data: null, error: { code, message } } format', async () => {
    const responses = [
      unauthorizedResponse(),
      forbiddenResponse(),
      notFoundResponse(),
      serviceUnavailableResponse(),
    ]

    for (const response of responses) {
      const body = await response.json()
      expect(body).toHaveProperty('data', null)
      expect(body).toHaveProperty('error')
      expect(body.error).toHaveProperty('code')
      expect(body.error).toHaveProperty('message')
    }
  })
})
