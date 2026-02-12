import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockClientRequest = vi.fn()
const mockDecrypt = vi.fn(() => 'decrypted-access-token')
const mockCreateShopifyClient = vi.fn(() => ({
  request: (...args: unknown[]) => mockClientRequest(...args),
}))

vi.mock('../../src/logger', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('../../src/utils/encryption', () => ({
  decrypt: (...args: unknown[]) => mockDecrypt(...args),
}))

vi.mock('../../src/services/shopify', () => ({
  createShopifyClient: (...args: unknown[]) => mockCreateShopifyClient(...args),
}))

describe('shopify credit product service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates hidden credit product and returns numeric ids when no existing ids are stored', async () => {
    mockClientRequest
      .mockResolvedValueOnce({
        data: {
          productCreate: {
            product: {
              id: 'gid://shopify/Product/111222333',
              variants: {
                nodes: [{ id: 'gid://shopify/ProductVariant/444555666' }],
              },
            },
            userErrors: [],
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          productVariantUpdate: {
            productVariant: { id: 'gid://shopify/ProductVariant/444555666' },
            userErrors: [],
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          publications: {
            nodes: [
              { id: 'gid://shopify/Publication/123', name: 'Online Store' },
              { id: 'gid://shopify/Publication/456', name: 'Point of Sale' },
            ],
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          publishableUnpublish: {
            userErrors: [],
          },
        },
      })

    const { ensureHiddenTryOnCreditProduct } = await import('../../src/services/shopify-credit-product')
    const result = await ensureHiddenTryOnCreditProduct({
      accessTokenEncrypted: 'encrypted-token',
      existingProductId: null,
      existingVariantId: null,
      requestId: 'req_test_123',
      retailCreditPrice: 0.5,
      shopDomain: 'shop.myshopify.com',
    })

    expect(result).toEqual({
      shopifyProductId: '111222333',
      shopifyVariantId: '444555666',
    })
    expect(mockDecrypt).toHaveBeenCalledWith('encrypted-token')
    expect(mockCreateShopifyClient).toHaveBeenCalledWith('shop.myshopify.com', 'decrypted-access-token')
    expect(mockClientRequest).toHaveBeenCalledTimes(4)
    expect(mockClientRequest.mock.calls[0]?.[0]).toContain('mutation productCreate')
    expect(mockClientRequest.mock.calls[1]?.[0]).toContain('mutation productVariantUpdate')
    expect(mockClientRequest.mock.calls[2]?.[0]).toContain('query publications')
    expect(mockClientRequest.mock.calls[3]?.[0]).toContain('mutation publishableUnpublish')
  })

  it('updates existing variant price without creating a new product', async () => {
    mockClientRequest.mockResolvedValueOnce({
      data: {
        productVariantUpdate: {
          productVariant: { id: 'gid://shopify/ProductVariant/999888777' },
          userErrors: [],
        },
      },
    })

    const { ensureHiddenTryOnCreditProduct } = await import('../../src/services/shopify-credit-product')
    const result = await ensureHiddenTryOnCreditProduct({
      accessTokenEncrypted: 'encrypted-token',
      existingProductId: '333222111',
      existingVariantId: '999888777',
      requestId: 'req_test_456',
      retailCreditPrice: 0.75,
      shopDomain: 'shop.myshopify.com',
    })

    expect(result).toEqual({
      shopifyProductId: '333222111',
      shopifyVariantId: '999888777',
    })
    expect(mockClientRequest).toHaveBeenCalledTimes(1)
    expect(mockClientRequest.mock.calls[0]?.[0]).toContain('mutation productVariantUpdate')
    expect(mockClientRequest.mock.calls[0]?.[1]).toEqual({
      variables: {
        input: {
          id: 'gid://shopify/ProductVariant/999888777',
          price: '0.75',
        },
      },
    })
  })

  it('throws when online store publication cannot be resolved', async () => {
    mockClientRequest
      .mockResolvedValueOnce({
        data: {
          productCreate: {
            product: {
              id: 'gid://shopify/Product/111222333',
              variants: {
                nodes: [{ id: 'gid://shopify/ProductVariant/444555666' }],
              },
            },
            userErrors: [],
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          productVariantUpdate: {
            productVariant: { id: 'gid://shopify/ProductVariant/444555666' },
            userErrors: [],
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          publications: {
            nodes: [{ id: 'gid://shopify/Publication/456', name: 'Point of Sale' }],
          },
        },
      })

    const { ensureHiddenTryOnCreditProduct } = await import('../../src/services/shopify-credit-product')

    await expect(
      ensureHiddenTryOnCreditProduct({
        accessTokenEncrypted: 'encrypted-token',
        requestId: 'req_test_789',
        retailCreditPrice: 1,
        shopDomain: 'shop.myshopify.com',
      }),
    ).rejects.toThrow('Shopify publication "Online Store" not found')
  })
})
