import { NextResponse } from 'next/server'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('../../src/middleware/api-key-auth', () => ({
  authenticateApiKey: vi.fn(),
}))

vi.mock('../../src/middleware/cors', () => ({
  checkCors: vi.fn().mockReturnValue(null),
  handlePreflight: vi.fn().mockReturnValue(null),
  addCorsHeaders: vi.fn().mockImplementation((response) => response),
}))

vi.mock('../../src/middleware/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    headers: { limit: 10, remaining: 9, reset: 1234567890 },
  }),
}))

import { withB2BAuth } from '../../src/middleware/b2b'
import { authenticateApiKey } from '../../src/middleware/api-key-auth'
import { handlePreflight, checkCors } from '../../src/middleware/cors'
import { checkRateLimit } from '../../src/middleware/rate-limit'

const mockContext = {
  storeId: 'store_123',
  shopDomain: 'test.myshopify.com',
  allowedDomains: ['https://test.myshopify.com'],
  subscriptionTier: 'starter',
  isActive: true,
  requestId: 'req_test-123',
}

describe('withB2BAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authenticateApiKey).mockResolvedValue({ context: mockContext })
    vi.mocked(handlePreflight).mockReturnValue(null)
    vi.mocked(checkCors).mockReturnValue(null)
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: true,
      headers: { limit: 10, remaining: 9, reset: 1234567890 },
    })
  })

  it('passes context to handler on valid request', async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ data: { ok: true }, error: null }))
    const wrappedHandler = withB2BAuth(handler)

    const request = new Request('https://example.com/api/v1/health', {
      headers: { Authorization: 'Bearer wk_test123' },
    })

    const response = await wrappedHandler(request)

    expect(handler).toHaveBeenCalledWith(request, mockContext)
    expect(response.status).toBe(200)
  })

  it('handles OPTIONS preflight before auth', async () => {
    vi.mocked(handlePreflight).mockReturnValue(new NextResponse(null, { status: 204 }))

    const handler = vi.fn()
    const wrappedHandler = withB2BAuth(handler)

    const request = new Request('https://example.com/api/v1/health', {
      method: 'OPTIONS',
    })

    const response = await wrappedHandler(request)

    expect(response.status).toBe(204)
    expect(handler).not.toHaveBeenCalled()
  })

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticateApiKey).mockResolvedValue({
      error: NextResponse.json({ data: null, error: { code: 'INVALID_API_KEY', message: 'Invalid' } }, { status: 401 }),
    })

    const handler = vi.fn()
    const wrappedHandler = withB2BAuth(handler)

    const request = new Request('https://example.com/api/v1/health')
    const response = await wrappedHandler(request)

    expect(response.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('returns 403 when CORS fails', async () => {
    vi.mocked(checkCors).mockReturnValue(
      NextResponse.json({ data: null, error: { code: 'DOMAIN_MISMATCH', message: 'Denied' } }, { status: 403 }),
    )

    const handler = vi.fn()
    const wrappedHandler = withB2BAuth(handler)

    const request = new Request('https://example.com/api/v1/health', {
      headers: { Authorization: 'Bearer wk_test123', origin: 'https://evil.com' },
    })

    const response = await wrappedHandler(request)

    expect(response.status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
  })

  it('returns 429 when rate limit exceeded', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: false,
      response: new NextResponse(
        JSON.stringify({ data: null, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many' } }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'X-RateLimit-Limit': '10' },
        },
      ),
    })

    const handler = vi.fn()
    const wrappedHandler = withB2BAuth(handler)

    const request = new Request('https://example.com/api/v1/health', {
      headers: { Authorization: 'Bearer wk_test123' },
    })

    const response = await wrappedHandler(request)

    expect(response.status).toBe(429)
    expect(handler).not.toHaveBeenCalled()
  })

  it('includes rate limit headers on successful response', async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ data: { ok: true }, error: null }))
    const wrappedHandler = withB2BAuth(handler)

    const request = new Request('https://example.com/api/v1/health', {
      headers: { Authorization: 'Bearer wk_test123' },
    })

    const response = await wrappedHandler(request)

    expect(response.headers.get('X-RateLimit-Limit')).toBe('10')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('9')
    expect(response.headers.get('X-RateLimit-Reset')).toBe('1234567890')
  })

  it('returns { data, error } format on error', async () => {
    vi.mocked(authenticateApiKey).mockResolvedValue({
      error: NextResponse.json({ data: null, error: { code: 'INVALID_API_KEY', message: 'Invalid' } }, { status: 401 }),
    })

    const handler = vi.fn()
    const wrappedHandler = withB2BAuth(handler)

    const request = new Request('https://example.com/api/v1/health')
    const response = await wrappedHandler(request)
    const body = await response.json()

    expect(body).toHaveProperty('data', null)
    expect(body).toHaveProperty('error')
    expect(body.error).toHaveProperty('code')
    expect(body.error).toHaveProperty('message')
  })
})
