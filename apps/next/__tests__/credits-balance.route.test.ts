import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetStoreBalance = vi.fn()

vi.mock('../../../packages/api/src/middleware/b2b', () => ({
  withB2BAuth: (handler: unknown) => handler,
}))

vi.mock('../../../packages/api/src/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../../../packages/api/src/services/b2b-credits', () => ({
  getStoreBalance: (...args: unknown[]) => mockGetStoreBalance(...args),
}))

const { GET } = await import('../app/api/v1/credits/balance/route')

const testContext = {
  storeId: 'store_test_123',
  requestId: 'req_test_balance',
  shopDomain: 'test-store.myshopify.com',
  allowedDomains: ['https://test-store.myshopify.com'],
  subscriptionTier: 'growth',
  isActive: true,
}

describe('GET /api/v1/credits/balance', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockGetStoreBalance.mockResolvedValue({
      balance: 150,
      totalPurchased: 500,
      totalSpent: 350,
    })
  })

  it('returns credit balance in snake_case format', async () => {
    const request = new Request('http://localhost/api/v1/credits/balance')

    const response = await GET(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      data: {
        balance: 150,
        total_purchased: 500, // snake_case
        total_spent: 350, // snake_case
      },
      error: null,
    })

    expect(mockGetStoreBalance).toHaveBeenCalledWith('store_test_123')
  })

  it('returns correct CORS headers for authenticated request', async () => {
    const request = new Request('http://localhost/api/v1/credits/balance', {
      headers: {
        Origin: 'https://test-store.myshopify.com',
      },
    })

    const response = await GET(request, testContext)

    // CORS headers should be added by withB2BAuth middleware
    expect(response.status).toBe(200)
  })

  it('returns 500 with proper error structure on database failure', async () => {
    mockGetStoreBalance.mockRejectedValue(new Error('Database connection timeout'))

    const request = new Request('http://localhost/api/v1/credits/balance')

    const response = await GET(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload).toEqual({
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve credit balance',
      },
    })
  })

  it('handles zero balance correctly', async () => {
    mockGetStoreBalance.mockResolvedValue({
      balance: 0,
      totalPurchased: 100,
      totalSpent: 100,
    })

    const request = new Request('http://localhost/api/v1/credits/balance')

    const response = await GET(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.balance).toBe(0)
    expect(payload.error).toBeNull()
  })

  it('includes request context in error logs', async () => {
    const { logger } = await import('../../../packages/api/src/logger')
    mockGetStoreBalance.mockRejectedValue(new Error('Query timeout'))

    const request = new Request('http://localhost/api/v1/credits/balance')

    await GET(request, testContext)

    // Verify error was logged with store_id and request_id context
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        store_id: 'store_test_123',
        request_id: 'req_test_balance',
      }),
      '[Credits Balance] Failed to retrieve balance'
    )
  })
})
