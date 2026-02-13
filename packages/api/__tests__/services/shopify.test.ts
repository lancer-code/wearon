import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the web-api adapter
vi.mock('@shopify/shopify-api/adapters/web-api', () => ({}))

// Mock the shopify-api module
const mockShopifyApi = vi.fn()
const mockSession = vi.fn()

vi.mock('@shopify/shopify-api', () => ({
  shopifyApi: (...args: unknown[]) => mockShopifyApi(...args),
  ApiVersion: { January26: '2026-01' },
  Session: (...args: unknown[]) => mockSession(...args),
}))

// Mock logger
vi.mock('../../src/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

describe('shopify service', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID = 'test-key'
    process.env.SHOPIFY_CLIENT_SECRET = 'test-secret'
    process.env.SHOPIFY_APP_URL = 'https://app.wearon.com'
    process.env.SHOPIFY_SCOPES = 'read_products,write_products'
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID
    delete process.env.SHOPIFY_CLIENT_SECRET
    delete process.env.SHOPIFY_APP_URL
    delete process.env.SHOPIFY_SCOPES
  })

  it('getShopifyApiInstance initializes with correct config', async () => {
    mockShopifyApi.mockReturnValue({
      auth: { begin: vi.fn(), callback: vi.fn() },
      utils: { sanitizeShop: vi.fn(), validateHmac: vi.fn() },
      clients: { Graphql: vi.fn() },
    })

    const { getShopifyApiInstance } = await import('../../src/services/shopify')
    getShopifyApiInstance()

    expect(mockShopifyApi).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-key',
        apiSecretKey: 'test-secret',
        hostName: 'app.wearon.com',
        scopes: ['read_products', 'write_products'],
        apiVersion: '2026-01',
        isEmbeddedApp: false,
      }),
    )
  })

  it('throws when env vars are missing', async () => {
    delete process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID

    const { getShopifyApiInstance } = await import('../../src/services/shopify')

    expect(() => getShopifyApiInstance()).toThrow('Missing Shopify environment variables')
  })

  it('strips protocol from SHOPIFY_APP_URL', async () => {
    process.env.SHOPIFY_APP_URL = 'https://app.wearon.com'
    mockShopifyApi.mockReturnValue({
      auth: { begin: vi.fn(), callback: vi.fn() },
      utils: { sanitizeShop: vi.fn(), validateHmac: vi.fn() },
      clients: { Graphql: vi.fn() },
    })

    const { getShopifyApiInstance } = await import('../../src/services/shopify')
    getShopifyApiInstance()

    expect(mockShopifyApi).toHaveBeenCalledWith(
      expect.objectContaining({
        hostName: 'app.wearon.com',
      }),
    )
  })
})
