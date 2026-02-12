import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEnsureHiddenTryOnCreditProduct = vi.fn()
const mockLoggerError = vi.fn()
const mockSelectSingle = vi.fn()
const mockUpdateSingle = vi.fn()
const mockUpdatePayload = vi.fn()
const mockSelectFields = vi.fn()

vi.mock('../../../packages/api/src/middleware/b2b', () => ({
  withB2BAuth: (handler: unknown) => handler,
}))

vi.mock('../../../packages/api/src/logger', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: (...args: unknown[]) => mockLoggerError(...args),
  }),
}))

vi.mock('../../../packages/api/src/services/shopify-credit-product', () => ({
  ensureHiddenTryOnCreditProduct: (...args: unknown[]) =>
    mockEnsureHiddenTryOnCreditProduct(...args),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table !== 'stores') {
        throw new Error(`Unexpected table in stores config tests: ${table}`)
      }

      return {
        select: (fields: string) => ({
          eq: (field: string, value: string) => {
            mockSelectFields(fields, field, value)
            return {
              single: () => mockSelectSingle(),
            }
          },
        }),
        update: (payload: Record<string, unknown>) => {
          mockUpdatePayload(payload)
          return {
            eq: (field: string, value: string) => ({
              select: (fields: string) => {
                mockSelectFields(fields, field, value)
                return {
                  single: () => mockUpdateSingle(),
                }
              },
            }),
          }
        },
      }
    },
  }),
}))

const { handleGetStoreConfig, handlePatchStoreConfig } = await import(
  '../app/api/v1/stores/config/route'
)

const testContext = {
  storeId: 'store_123',
  shopDomain: 'store.myshopify.com',
  allowedDomains: ['https://store.myshopify.com'],
  subscriptionTier: 'starter',
  isActive: true,
  requestId: 'req_test_123',
}

describe('stores config route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  })

  it('GET returns billing config with shopify variant id', async () => {
    mockSelectSingle.mockResolvedValueOnce({
      data: {
        id: 'store_123',
        shop_domain: 'store.myshopify.com',
        billing_mode: 'resell_mode',
        retail_credit_price: 0.5,
        shopify_variant_id: '444555666',
        subscription_tier: 'starter',
        status: 'active',
      },
      error: null,
    })

    const response = await handleGetStoreConfig(
      new Request('http://localhost/api/v1/stores/config'),
      testContext
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data).toEqual({
      store_id: 'store_123',
      shop_domain: 'store.myshopify.com',
      billing_mode: 'resell_mode',
      retail_credit_price: 0.5,
      shopify_variant_id: '444555666',
      subscription_tier: 'starter',
      status: 'active',
      privacy_disclosure: expect.any(String),
    })
  })

  it('PATCH creates hidden product when enabling resell mode', async () => {
    mockSelectSingle.mockResolvedValueOnce({
      data: {
        id: 'store_123',
        shop_domain: 'store.myshopify.com',
        billing_mode: 'absorb_mode',
        retail_credit_price: null,
        shopify_product_id: null,
        shopify_variant_id: null,
        subscription_tier: 'starter',
        status: 'active',
        access_token_encrypted: 'enc-token',
      },
      error: null,
    })

    mockEnsureHiddenTryOnCreditProduct.mockResolvedValueOnce({
      shopifyProductId: '111222333',
      shopifyVariantId: '444555666',
    })

    mockUpdateSingle.mockResolvedValueOnce({
      data: {
        id: 'store_123',
        shop_domain: 'store.myshopify.com',
        billing_mode: 'resell_mode',
        retail_credit_price: 0.5,
        shopify_product_id: '111222333',
        shopify_variant_id: '444555666',
        subscription_tier: 'starter',
        status: 'active',
      },
      error: null,
    })

    const request = new Request('http://localhost/api/v1/stores/config', {
      method: 'PATCH',
      body: JSON.stringify({
        billing_mode: 'resell_mode',
        retail_credit_price: 0.5,
      }),
    })

    const response = await handlePatchStoreConfig(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mockEnsureHiddenTryOnCreditProduct).toHaveBeenCalledWith({
      accessTokenEncrypted: 'enc-token',
      existingProductId: null,
      existingVariantId: null,
      requestId: 'req_test_123',
      retailCreditPrice: 0.5,
      shopDomain: 'store.myshopify.com',
    })
    expect(mockUpdatePayload).toHaveBeenCalledWith({
      billing_mode: 'resell_mode',
      retail_credit_price: 0.5,
      shopify_product_id: '111222333',
      shopify_variant_id: '444555666',
    })
    expect(payload.data.shopify_variant_id).toBe('444555666')
  })

  it('PATCH updates variant price for existing hidden product in resell mode', async () => {
    mockSelectSingle.mockResolvedValueOnce({
      data: {
        id: 'store_123',
        shop_domain: 'store.myshopify.com',
        billing_mode: 'resell_mode',
        retail_credit_price: 0.5,
        shopify_product_id: '111222333',
        shopify_variant_id: '444555666',
        subscription_tier: 'starter',
        status: 'active',
        access_token_encrypted: 'enc-token',
      },
      error: null,
    })

    mockEnsureHiddenTryOnCreditProduct.mockResolvedValueOnce({
      shopifyProductId: '111222333',
      shopifyVariantId: '444555666',
    })

    mockUpdateSingle.mockResolvedValueOnce({
      data: {
        id: 'store_123',
        shop_domain: 'store.myshopify.com',
        billing_mode: 'resell_mode',
        retail_credit_price: 0.75,
        shopify_product_id: '111222333',
        shopify_variant_id: '444555666',
        subscription_tier: 'starter',
        status: 'active',
      },
      error: null,
    })

    const request = new Request('http://localhost/api/v1/stores/config', {
      method: 'PATCH',
      body: JSON.stringify({
        billing_mode: 'resell_mode',
        retail_credit_price: 0.75,
      }),
    })

    const response = await handlePatchStoreConfig(request, testContext)

    expect(response.status).toBe(200)
    expect(mockEnsureHiddenTryOnCreditProduct).toHaveBeenCalledWith({
      accessTokenEncrypted: 'enc-token',
      existingProductId: '111222333',
      existingVariantId: '444555666',
      requestId: 'req_test_123',
      retailCreditPrice: 0.75,
      shopDomain: 'store.myshopify.com',
    })
  })

  it('PATCH rejects resell mode when retail_credit_price is missing or invalid', async () => {
    const invalidPayloads = [
      { billing_mode: 'resell_mode' },
      { billing_mode: 'resell_mode', retail_credit_price: 0 },
      { billing_mode: 'resell_mode', retail_credit_price: -1 },
    ]

    for (const body of invalidPayloads) {
      const request = new Request('http://localhost/api/v1/stores/config', {
        method: 'PATCH',
        body: JSON.stringify(body),
      })

      const response = await handlePatchStoreConfig(request, testContext)
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.error).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'retail_credit_price must be a positive number when billing_mode is resell_mode',
      })
    }

    expect(mockSelectSingle).not.toHaveBeenCalled()
    expect(mockEnsureHiddenTryOnCreditProduct).not.toHaveBeenCalled()
    expect(mockUpdatePayload).not.toHaveBeenCalled()
  })

  it('PATCH switches to absorb mode without touching shopper credits', async () => {
    mockSelectSingle.mockResolvedValueOnce({
      data: {
        id: 'store_123',
        shop_domain: 'store.myshopify.com',
        billing_mode: 'resell_mode',
        retail_credit_price: 0.75,
        shopify_product_id: '111222333',
        shopify_variant_id: '444555666',
        subscription_tier: 'starter',
        status: 'active',
        access_token_encrypted: 'enc-token',
      },
      error: null,
    })

    mockUpdateSingle.mockResolvedValueOnce({
      data: {
        id: 'store_123',
        shop_domain: 'store.myshopify.com',
        billing_mode: 'absorb_mode',
        retail_credit_price: null,
        shopify_product_id: '111222333',
        shopify_variant_id: '444555666',
        subscription_tier: 'starter',
        status: 'active',
      },
      error: null,
    })

    const request = new Request('http://localhost/api/v1/stores/config', {
      method: 'PATCH',
      body: JSON.stringify({
        billing_mode: 'absorb_mode',
      }),
    })

    const response = await handlePatchStoreConfig(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mockEnsureHiddenTryOnCreditProduct).not.toHaveBeenCalled()
    expect(mockUpdatePayload).toHaveBeenCalledWith({
      billing_mode: 'absorb_mode',
      retail_credit_price: null,
      shopify_product_id: '111222333',
      shopify_variant_id: '444555666',
    })
    expect(payload.data.billing_mode).toBe('absorb_mode')
  })
})
