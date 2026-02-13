import crypto from 'node:crypto'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock environment
const TEST_API_KEY = 'test-client-id'
const TEST_API_SECRET = 'test-api-secret-key'

vi.stubEnv('NEXT_PUBLIC_SHOPIFY_CLIENT_ID', TEST_API_KEY)
vi.stubEnv('SHOPIFY_CLIENT_SECRET', TEST_API_SECRET)
// Mock supabase admin client — keep a reference to override per-test
const mockSingle = vi.fn(() =>
  Promise.resolve({
    data: { id: 'store-123', shop_domain: 'test-store.myshopify.com', status: 'active' },
    error: null,
  })
)

vi.mock('../../lib/supabase-admin', () => ({
  getAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockSingle,
        })),
      })),
    })),
  })),
}))

// Mock logger
const mockChildLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}
vi.mock('../../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createChildLogger: vi.fn(() => mockChildLogger),
}))

// Mock merchant-ops to provide MerchantOpsError without loading full dependency tree
vi.mock('../../services/merchant-ops', () => {
  class MerchantOpsError extends Error {
    constructor(message: string, public readonly code: string) {
      super(message)
      this.name = 'MerchantOpsError'
    }
  }
  return { MerchantOpsError }
})

import { authenticateShopifySession } from '../shopify-session'

function createJWT(
  payload: Record<string, unknown>,
  secret: string = TEST_API_SECRET,
  algorithm: string = 'HS256'
): string {
  const header = Buffer.from(JSON.stringify({ alg: algorithm, typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${signature}`
}

function createValidPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000)
  return {
    iss: 'https://test-store.myshopify.com/admin',
    dest: 'https://test-store.myshopify.com',
    aud: TEST_API_KEY,
    sub: 'shop-user-42',
    exp: now + 300,
    nbf: now - 10,
    iat: now,
    jti: 'test-jti',
    sid: 'test-sid',
    ...overrides,
  }
}

describe('authenticateShopifySession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore default mock after clearAllMocks wipes implementations
    mockSingle.mockImplementation(() =>
      Promise.resolve({
        data: { id: 'store-123', shop_domain: 'test-store.myshopify.com', status: 'active' },
        error: null,
      })
    )
  })

  it('authenticates a valid session token', async () => {
    const token = createJWT(createValidPayload())
    const request = new Request('https://wearonai.com/api/shopify/store', {
      headers: { Authorization: `Bearer ${token}` },
    })

    const result = await authenticateShopifySession(request)

    expect('context' in result).toBe(true)
    if ('context' in result) {
      expect(result.context.storeId).toBe('store-123')
      expect(result.context.shopDomain).toBe('test-store.myshopify.com')
      expect(result.context.shopifyUserId).toBe('shop-user-42')
    }
  })

  it('rejects request with missing Authorization header', async () => {
    const request = new Request('https://wearonai.com/api/shopify/store')

    const result = await authenticateShopifySession(request)

    expect('error' in result).toBe(true)
  })

  it('rejects request with non-Bearer auth', async () => {
    const request = new Request('https://wearonai.com/api/shopify/store', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    })

    const result = await authenticateShopifySession(request)

    expect('error' in result).toBe(true)
  })

  it('rejects token with wrong signature (different secret)', async () => {
    const token = createJWT(createValidPayload(), 'wrong-secret')
    const request = new Request('https://wearonai.com/api/shopify/store', {
      headers: { Authorization: `Bearer ${token}` },
    })

    const result = await authenticateShopifySession(request)

    expect('error' in result).toBe(true)
  })

  it('rejects expired token', async () => {
    const now = Math.floor(Date.now() / 1000)
    const token = createJWT(createValidPayload({ exp: now - 60 }))
    const request = new Request('https://wearonai.com/api/shopify/store', {
      headers: { Authorization: `Bearer ${token}` },
    })

    const result = await authenticateShopifySession(request)

    expect('error' in result).toBe(true)
  })

  it('rejects token not yet valid (nbf in future)', async () => {
    const now = Math.floor(Date.now() / 1000)
    const token = createJWT(createValidPayload({ nbf: now + 600 }))
    const request = new Request('https://wearonai.com/api/shopify/store', {
      headers: { Authorization: `Bearer ${token}` },
    })

    const result = await authenticateShopifySession(request)

    expect('error' in result).toBe(true)
  })

  it('rejects token with wrong audience', async () => {
    const token = createJWT(createValidPayload({ aud: 'wrong-client-id' }))
    const request = new Request('https://wearonai.com/api/shopify/store', {
      headers: { Authorization: `Bearer ${token}` },
    })

    const result = await authenticateShopifySession(request)

    expect('error' in result).toBe(true)
  })

  it('rejects malformed JWT (not 3 parts)', async () => {
    const request = new Request('https://wearonai.com/api/shopify/store', {
      headers: { Authorization: 'Bearer not.a.valid.jwt.at.all' },
    })

    const result = await authenticateShopifySession(request)

    expect('error' in result).toBe(true)
  })

  it('rejects empty token string', async () => {
    const request = new Request('https://wearonai.com/api/shopify/store', {
      headers: { Authorization: 'Bearer ' },
    })

    const result = await authenticateShopifySession(request)

    expect('error' in result).toBe(true)
  })

  it('uses timing-safe comparison for signature verification', async () => {
    const timingSpy = vi.spyOn(crypto, 'timingSafeEqual')
    const token = createJWT(createValidPayload())
    const request = new Request('https://wearonai.com/api/shopify/store', {
      headers: { Authorization: `Bearer ${token}` },
    })

    await authenticateShopifySession(request)

    expect(timingSpy).toHaveBeenCalled()
    timingSpy.mockRestore()
  })

  it('rejects store with non-active status', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'store-456', shop_domain: 'test-store.myshopify.com', status: 'suspended' },
      error: null,
    })

    const token = createJWT(createValidPayload())
    const request = new Request('https://wearonai.com/api/shopify/store', {
      headers: { Authorization: `Bearer ${token}` },
    })

    const result = await authenticateShopifySession(request)

    expect('error' in result).toBe(true)
  })
})
