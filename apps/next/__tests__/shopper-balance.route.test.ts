import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetStoreShopperBalance = vi.fn()

vi.mock('../../../packages/api/src/middleware/b2b', () => ({
  withB2BAuth: (handler: unknown) => handler,
}))

vi.mock('../../../packages/api/src/services/b2b-credits', () => ({
  getStoreShopperBalance: (...args: unknown[]) => mockGetStoreShopperBalance(...args),
}))

const { handleShopperCreditsGet } = await import('../app/api/v1/credits/shopper/route')

const testContext = {
  storeId: 'store_123',
  requestId: 'req_test_123',
}

describe('GET /api/v1/credits/shopper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns shopper balance for existing shopper', async () => {
    mockGetStoreShopperBalance.mockResolvedValue({
      balance: 3,
      totalPurchased: 5,
      totalSpent: 2,
    })

    const request = new Request('http://localhost/api/v1/credits/shopper', {
      headers: {
        'x-shopper-email': 'shopper@example.com',
      },
    })
    const response = await handleShopperCreditsGet(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mockGetStoreShopperBalance).toHaveBeenCalledWith('store_123', 'shopper@example.com')
    expect(payload).toEqual({
      data: {
        balance: 3,
        total_purchased: 5,
        total_spent: 2,
      },
      error: null,
    })
  })

  it('returns 0 balance for new shopper with no credit row', async () => {
    mockGetStoreShopperBalance.mockResolvedValue({
      balance: 0,
      totalPurchased: 0,
      totalSpent: 0,
    })

    const request = new Request('http://localhost/api/v1/credits/shopper', {
      headers: {
        'x-shopper-email': 'new-shopper@example.com',
      },
    })
    const response = await handleShopperCreditsGet(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      data: {
        balance: 0,
        total_purchased: 0,
        total_spent: 0,
      },
      error: null,
    })
  })

  it('rejects missing shopper email header', async () => {
    const request = new Request('http://localhost/api/v1/credits/shopper')
    const response = await handleShopperCreditsGet(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'x-shopper-email header is required',
      },
    })
    expect(mockGetStoreShopperBalance).not.toHaveBeenCalled()
  })
})
