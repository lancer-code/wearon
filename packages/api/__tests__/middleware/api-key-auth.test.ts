import { createHash } from 'node:crypto'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock Supabase
const mockSingle = vi.fn()
const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle })
const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 })
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

// Set env vars before import
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

import { authenticateApiKey } from '../../src/middleware/api-key-auth'

describe('authenticateApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for missing Authorization header', async () => {
    const request = new Request('https://example.com/api/v1/health')
    const result = await authenticateApiKey(request, 'req_test_1')

    expect('error' in result).toBe(true)
    if ('error' in result) {
      const body = await result.error.json()
      expect(result.error.status).toBe(401)
      expect(body.error.code).toBe('INVALID_API_KEY')
    }
  })

  it('returns 401 for key without wk_ prefix', async () => {
    const request = new Request('https://example.com/api/v1/health', {
      headers: { Authorization: 'Bearer invalid_key_format' },
    })
    const result = await authenticateApiKey(request, 'req_test_2')

    expect('error' in result).toBe(true)
    if ('error' in result) {
      const body = await result.error.json()
      expect(body.error.code).toBe('INVALID_API_KEY')
    }
  })

  it('returns 401 for invalid API key (not found in DB)', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })

    const request = new Request('https://example.com/api/v1/health', {
      headers: { Authorization: 'Bearer wk_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4' },
    })
    const result = await authenticateApiKey(request, 'req_test_3')

    expect('error' in result).toBe(true)
    if ('error' in result) {
      const body = await result.error.json()
      expect(body.error.code).toBe('INVALID_API_KEY')
    }
  })

  it('returns 401 for inactive store', async () => {
    mockSingle.mockResolvedValue({
      data: {
        store_id: 'store_123',
        allowed_domains: ['https://test.myshopify.com'],
        stores: {
          shop_domain: 'test.myshopify.com',
          subscription_tier: 'starter',
          status: 'inactive',
        },
      },
      error: null,
    })

    const request = new Request('https://example.com/api/v1/health', {
      headers: { Authorization: 'Bearer wk_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4' },
    })
    const result = await authenticateApiKey(request, 'req_test_4')

    expect('error' in result).toBe(true)
    if ('error' in result) {
      const body = await result.error.json()
      expect(body.error.code).toBe('INVALID_API_KEY')
    }
  })

  it('returns B2BContext for valid API key with active store', async () => {
    mockSingle.mockResolvedValue({
      data: {
        store_id: 'store_123',
        allowed_domains: ['https://test.myshopify.com'],
        stores: {
          shop_domain: 'test.myshopify.com',
          subscription_tier: 'growth',
          status: 'active',
        },
      },
      error: null,
    })

    const apiKey = 'wk_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
    const requestId = 'req_test_5'
    const request = new Request('https://example.com/api/v1/health', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const result = await authenticateApiKey(request, requestId)

    expect('context' in result).toBe(true)
    if ('context' in result) {
      expect(result.context.storeId).toBe('store_123')
      expect(result.context.shopDomain).toBe('test.myshopify.com')
      expect(result.context.subscriptionTier).toBe('growth')
      expect(result.context.isActive).toBe(true)
      expect(result.context.requestId).toBe(requestId)
    }

    // Verify the hash was computed correctly
    const expectedHash = createHash('sha256').update(apiKey).digest('hex')
    expect(mockEq1).toHaveBeenCalledWith('key_hash', expectedHash)
  })
})
