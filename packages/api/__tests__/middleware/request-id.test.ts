import { describe, expect, it } from 'vitest'
import { REQUEST_ID_HEADER, extractRequestId } from '../../src/middleware/request-id'

describe('extractRequestId', () => {
  it('generates a req_ + UUID v4 format ID when no header present', () => {
    const request = new Request('https://example.com', {
      headers: {},
    })

    const id = extractRequestId(request)

    expect(id).toMatch(/^req_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('preserves existing X-Request-Id header value', () => {
    const existingId = 'req_existing-id-value'
    const request = new Request('https://example.com', {
      headers: {
        [REQUEST_ID_HEADER]: existingId,
      },
    })

    const id = extractRequestId(request)

    expect(id).toBe(existingId)
  })

  it('generates unique IDs for different requests', () => {
    const request1 = new Request('https://example.com')
    const request2 = new Request('https://example.com')

    const id1 = extractRequestId(request1)
    const id2 = extractRequestId(request2)

    expect(id1).not.toBe(id2)
  })

  it('generated IDs contain valid UUID v4 format', () => {
    const request = new Request('https://example.com')
    const id = extractRequestId(request)

    // Strip 'req_' prefix and validate UUID format
    const uuid = id.replace('req_', '')
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

describe('REQUEST_ID_HEADER', () => {
  it('is X-Request-Id', () => {
    expect(REQUEST_ID_HEADER).toBe('X-Request-Id')
  })
})
