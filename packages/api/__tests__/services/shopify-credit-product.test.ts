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
          productVariantsBulkUpdate: {
            productVariants: [{ id: 'gid://shopify/ProductVariant/444555666' }],
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
    expect(mockClientRequest.mock.calls[1]?.[0]).toContain('mutation productVariantsBulkUpdate')
    expect(mockClientRequest.mock.calls[2]?.[0]).toContain('query publications')
    expect(mockClientRequest.mock.calls[3]?.[0]).toContain('mutation publishableUnpublish')
  })

  it('updates existing variant price without creating a new product', async () => {
    mockClientRequest.mockResolvedValueOnce({
      data: {
        productVariantsBulkUpdate: {
          productVariants: [{ id: 'gid://shopify/ProductVariant/999888777' }],
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
    expect(mockClientRequest.mock.calls[0]?.[0]).toContain('mutation productVariantsBulkUpdate')
    expect(mockClientRequest.mock.calls[0]?.[1]).toEqual({
      variables: {
        productId: 'gid://shopify/Product/333222111',
        variants: [
          {
            id: 'gid://shopify/ProductVariant/999888777',
            price: '0.75',
          },
        ],
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
          productVariantsBulkUpdate: {
            productVariants: [{ id: 'gid://shopify/ProductVariant/444555666' }],
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
    ).rejects.toThrow('Shopify Online Store publication not found')
  })

  it('reconciles partial state by querying shopify when productId exists but variantId is missing', async () => {
    mockClientRequest
      .mockResolvedValueOnce({
        data: {
          product: {
            id: 'gid://shopify/Product/333222111',
            variants: {
              nodes: [{ id: 'gid://shopify/ProductVariant/999888777' }],
            },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          productVariantsBulkUpdate: {
            productVariants: [{ id: 'gid://shopify/ProductVariant/999888777' }],
            userErrors: [],
          },
        },
      })

    const { ensureHiddenTryOnCreditProduct } = await import('../../src/services/shopify-credit-product')
    const result = await ensureHiddenTryOnCreditProduct({
      accessTokenEncrypted: 'encrypted-token',
      existingProductId: '333222111',
      existingVariantId: null,
      requestId: 'req_test_partial',
      retailCreditPrice: 0.6,
      shopDomain: 'shop.myshopify.com',
    })

    expect(result).toEqual({
      shopifyProductId: '333222111',
      shopifyVariantId: '999888777',
    })
    expect(mockClientRequest).toHaveBeenCalledTimes(2)
    expect(mockClientRequest.mock.calls[0]?.[0]).toContain('query getProduct')
    expect(mockClientRequest.mock.calls[1]?.[0]).toContain('mutation productVariantsBulkUpdate')
  })

  it('creates new product when partial state cannot be reconciled', async () => {
    mockClientRequest
      .mockResolvedValueOnce({
        data: {
          product: null,
        },
      })
      .mockResolvedValueOnce({
        data: {
          productCreate: {
            product: {
              id: 'gid://shopify/Product/555666777',
              variants: {
                nodes: [{ id: 'gid://shopify/ProductVariant/888999000' }],
              },
            },
            userErrors: [],
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          productVariantsBulkUpdate: {
            productVariants: [{ id: 'gid://shopify/ProductVariant/888999000' }],
            userErrors: [],
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          publications: {
            nodes: [{ id: 'gid://shopify/Publication/123', name: 'Online Store' }],
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
      existingProductId: '999999999',
      existingVariantId: null,
      requestId: 'req_test_fallback',
      retailCreditPrice: 0.8,
      shopDomain: 'shop.myshopify.com',
    })

    expect(result).toEqual({
      shopifyProductId: '555666777',
      shopifyVariantId: '888999000',
    })
    expect(mockClientRequest).toHaveBeenCalledTimes(5)
  })

  it('supports localized online store publication names', async () => {
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
          productVariantsBulkUpdate: {
            productVariants: [{ id: 'gid://shopify/ProductVariant/444555666' }],
            userErrors: [],
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          publications: {
            nodes: [
              { id: 'gid://shopify/Publication/123', name: 'Boutique en ligne' },
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
      requestId: 'req_test_fr',
      retailCreditPrice: 0.5,
      shopDomain: 'shop.myshopify.com',
    })

    expect(result.shopifyProductId).toBe('111222333')
    expect(mockClientRequest.mock.calls[3]?.[1]).toEqual({
      variables: {
        id: 'gid://shopify/Product/111222333',
        input: {
          publicationId: 'gid://shopify/Publication/123',
        },
      },
    })
  })
})
