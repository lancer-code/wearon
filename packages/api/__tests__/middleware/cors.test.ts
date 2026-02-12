import { describe, expect, it } from 'vitest'
import { checkCors, handlePreflight } from '../../src/middleware/cors'

describe('checkCors', () => {
  it('allows request from an allowed domain', () => {
    const request = new Request('https://example.com/api/v1/health', {
      headers: { origin: 'https://test.myshopify.com' },
    })
    const result = checkCors(request, ['https://test.myshopify.com'])
    expect(result).toBeNull()
  })

  it('rejects request from disallowed domain', async () => {
    const request = new Request('https://example.com/api/v1/health', {
      headers: { origin: 'https://evil.com' },
    })
    const result = checkCors(request, ['https://test.myshopify.com'])

    expect(result).not.toBeNull()
    const body = await result!.json()
    expect(result!.status).toBe(403)
    expect(body.error.code).toBe('DOMAIN_MISMATCH')
  })

  it('allows request with no Origin header (server-to-server)', () => {
    const request = new Request('https://example.com/api/v1/health')
    const result = checkCors(request, ['https://test.myshopify.com'])
    expect(result).toBeNull()
  })

  it('allows any origin when allowedDomains is empty', () => {
    const request = new Request('https://example.com/api/v1/health', {
      headers: { origin: 'https://any-site.com' },
    })
    const result = checkCors(request, [])
    expect(result).toBeNull()
  })
})

describe('handlePreflight', () => {
  it('returns null for non-OPTIONS requests', () => {
    const request = new Request('https://example.com/api/v1/health', {
      method: 'GET',
    })
    const result = handlePreflight(request, ['https://test.myshopify.com'])
    expect(result).toBeNull()
  })

  it('returns 204 with CORS headers for valid OPTIONS request', () => {
    const request = new Request('https://example.com/api/v1/health', {
      method: 'OPTIONS',
      headers: { origin: 'https://test.myshopify.com' },
    })
    const result = handlePreflight(request, ['https://test.myshopify.com'])

    expect(result).not.toBeNull()
    expect(result!.status).toBe(204)
    expect(result!.headers.get('Access-Control-Allow-Origin')).toBe('https://test.myshopify.com')
    expect(result!.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS')
    expect(result!.headers.get('Access-Control-Allow-Headers')).toBe('Authorization, Content-Type, X-Request-Id')
  })

  it('returns 403 for OPTIONS from disallowed origin', async () => {
    const request = new Request('https://example.com/api/v1/health', {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.com' },
    })
    const result = handlePreflight(request, ['https://test.myshopify.com'])

    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('returns 204 for OPTIONS without Origin header', () => {
    const request = new Request('https://example.com/api/v1/health', {
      method: 'OPTIONS',
    })
    const result = handlePreflight(request, ['https://test.myshopify.com'])

    expect(result).not.toBeNull()
    expect(result!.status).toBe(204)
  })
})
