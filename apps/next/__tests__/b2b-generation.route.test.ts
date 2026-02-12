import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDeductStoreCredit = vi.fn()
const mockDeductStoreShopperCredit = vi.fn()
const mockRefundStoreCredit = vi.fn()
const mockRefundStoreShopperCredit = vi.fn()
const mockGetStoreBillingProfile = vi.fn()
const mockLogStoreOverage = vi.fn()
const mockCreateOverageCharge = vi.fn()
const mockGetTierOverageCents = vi.fn(() => 14)
const mockPushGenerationTask = vi.fn()
const mockCreateChildLogger = vi.fn(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

const mockInsert = vi.fn()
const mockInsertSingle = vi.fn()
const mockStoreSelectFilters = vi.fn()
const mockStoreSelectSingle = vi.fn()
const mockSelectFilters = vi.fn()
const mockSelectSingle = vi.fn()
const mockUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null })

vi.mock('../../../packages/api/src/middleware/b2b', () => ({
  withB2BAuth: (handler: unknown) => handler,
}))

vi.mock('../../../packages/api/src/logger', () => ({
  createChildLogger: (...args: unknown[]) => mockCreateChildLogger(...args),
}))

vi.mock('../../../packages/api/src/services/b2b-credits', () => ({
  deductStoreCredit: (...args: unknown[]) => mockDeductStoreCredit(...args),
  deductStoreShopperCredit: (...args: unknown[]) => mockDeductStoreShopperCredit(...args),
  refundStoreCredit: (...args: unknown[]) => mockRefundStoreCredit(...args),
  refundStoreShopperCredit: (...args: unknown[]) => mockRefundStoreShopperCredit(...args),
  getStoreBillingProfile: (...args: unknown[]) => mockGetStoreBillingProfile(...args),
  logStoreOverage: (...args: unknown[]) => mockLogStoreOverage(...args),
}))

vi.mock('../../../packages/api/src/services/paddle', () => ({
  createOverageCharge: (...args: unknown[]) => mockCreateOverageCharge(...args),
  getTierOverageCents: (...args: unknown[]) => mockGetTierOverageCents(...args),
}))

vi.mock('../../../packages/api/src/services/redis-queue', () => ({
  pushGenerationTask: (...args: unknown[]) => mockPushGenerationTask(...args),
}))

const mockLogStoreAnalyticsEvent = vi.fn()
vi.mock('../../../packages/api/src/services/store-analytics', () => ({
  logStoreAnalyticsEvent: (...args: unknown[]) => mockLogStoreAnalyticsEvent(...args),
}))

vi.mock('../../../packages/api/src/services/b2b-storage', () => ({
  getStoreUploadPath: (storeId: string) => `stores/${storeId}/uploads`,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'stores') {
        return {
          select: (...args: unknown[]) => ({
            eq: (field: string, value: string) => {
              mockStoreSelectFilters(args, field, value)
              return {
                single: () => mockStoreSelectSingle(),
              }
            },
          }),
        }
      }

      if (table !== 'store_generation_sessions') {
        throw new Error(`Unexpected table in generation route tests: ${table}`)
      }

      return {
        insert: (...args: unknown[]) => {
          mockInsert(...args)
          return {
            select: () => ({
              single: () => mockInsertSingle(),
            }),
          }
        },
        select: () => ({
          eq: (field: string, value: string) => {
            mockSelectFilters(field, value)
            return {
              eq: (field2: string, value2: string) => {
                mockSelectFilters(field2, value2)
                return {
                  single: () => mockSelectSingle(),
                }
              },
            }
          },
        }),
        update: (payload: Record<string, unknown>) => ({
          eq: (field: string, value: string) => mockUpdateEq(payload, field, value),
        }),
      }
    },
  }),
}))

const { handleGenerationCreatePost } = await import('../app/api/v1/generation/create/route')
const { handleGenerationStatusGet } = await import('../app/api/v1/generation/[id]/route')

const testContext = {
  storeId: 'store_123',
  requestId: 'req_test_123',
}

describe('B2B generation REST routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

    mockDeductStoreCredit.mockResolvedValue(true)
    mockDeductStoreShopperCredit.mockResolvedValue(true)
    mockRefundStoreCredit.mockResolvedValue(undefined)
    mockRefundStoreShopperCredit.mockResolvedValue(undefined)
    mockGetStoreBillingProfile.mockResolvedValue({
      subscriptionTier: null,
      subscriptionId: null,
      subscriptionStatus: null,
    })
    mockLogStoreOverage.mockResolvedValue(undefined)
    mockCreateOverageCharge.mockResolvedValue('chg_123')
    mockPushGenerationTask.mockResolvedValue(undefined)

    mockInsertSingle.mockResolvedValue({
      data: { id: 'session_123' },
      error: null,
    })
    mockStoreSelectSingle.mockResolvedValue({
      data: {
        billing_mode: 'absorb_mode',
      },
      error: null,
    })
    mockSelectSingle.mockResolvedValue({
      data: {
        id: 'f4b4f879-2757-4138-88c2-af6b743327fd',
        store_id: 'store_123',
        status: 'completed',
        model_image_url: 'https://cdn.test/model.jpg',
        outfit_image_url: 'https://cdn.test/outfit.jpg',
        generated_image_url: 'https://cdn.test/generated.jpg',
        error_message: null,
        credits_used: 1,
        request_id: 'req_test_123',
        created_at: '2026-02-12T00:00:00Z',
        completed_at: '2026-02-12T00:01:00Z',
      },
      error: null,
    })
  })

  it('POST /create enqueues a b2b task and returns 201', async () => {
    const request = new Request('http://localhost/api/v1/generation/create', {
      method: 'POST',
      body: JSON.stringify({
        image_urls: ['https://cdn.test/stores/store_123/uploads/model.jpg'],
      }),
    })

    const response = await handleGenerationCreatePost(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload).toEqual({
      data: {
        session_id: 'session_123',
        status: 'queued',
      },
      error: null,
    })
    expect(mockDeductStoreCredit).toHaveBeenCalledWith(
      'store_123',
      'req_test_123',
      'B2B generation'
    )
    expect(mockDeductStoreShopperCredit).not.toHaveBeenCalled()
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        store_id: 'store_123',
        status: 'queued',
        credits_used: 1,
      })
    )
    expect(mockPushGenerationTask).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'b2b',
        storeId: 'store_123',
        sessionId: 'session_123',
      })
    )
    expect(mockLogStoreAnalyticsEvent).toHaveBeenCalledWith(
      'store_123',
      'generation_queued',
      expect.objectContaining({
        request_id: 'req_test_123',
        session_id: 'session_123',
      })
    )
  })

  it('POST /create in resell_mode deducts shopper credits', async () => {
    mockStoreSelectSingle.mockResolvedValue({
      data: {
        billing_mode: 'resell_mode',
      },
      error: null,
    })

    const request = new Request('http://localhost/api/v1/generation/create', {
      method: 'POST',
      headers: {
        'x-shopper-email': 'shopper@example.com',
      },
      body: JSON.stringify({
        image_urls: ['https://cdn.test/stores/store_123/uploads/model.jpg'],
      }),
    })

    const response = await handleGenerationCreatePost(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload).toEqual({
      data: {
        session_id: 'session_123',
        status: 'queued',
      },
      error: null,
    })
    expect(mockDeductStoreShopperCredit).toHaveBeenCalledWith(
      'store_123',
      'shopper@example.com',
      'req_test_123',
      'B2B shopper generation'
    )
    expect(mockDeductStoreCredit).not.toHaveBeenCalled()
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        shopper_email: 'shopper@example.com',
      })
    )
  })

  it('POST /create in resell_mode returns 402 when shopper credits are insufficient', async () => {
    mockStoreSelectSingle.mockResolvedValue({
      data: {
        billing_mode: 'resell_mode',
      },
      error: null,
    })
    mockDeductStoreShopperCredit.mockResolvedValue(false)

    const request = new Request('http://localhost/api/v1/generation/create', {
      method: 'POST',
      headers: {
        'x-shopper-email': 'shopper@example.com',
      },
      body: JSON.stringify({
        image_urls: ['https://cdn.test/stores/store_123/uploads/model.jpg'],
      }),
    })

    const response = await handleGenerationCreatePost(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(402)
    expect(payload).toEqual({
      data: null,
      error: {
        code: 'INSUFFICIENT_CREDITS',
        message: 'Insufficient shopper credits to create generation',
      },
    })
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockPushGenerationTask).not.toHaveBeenCalled()
  })

  it('POST /create in absorb_mode with zero credits but active subscription uses overage billing', async () => {
    mockDeductStoreCredit.mockResolvedValue(false) // Zero credits
    mockGetStoreBillingProfile.mockResolvedValue({
      subscriptionTier: 'growth',
      subscriptionId: 'sub_active_123',
      subscriptionStatus: 'active',
    })

    const request = new Request('http://localhost/api/v1/generation/create', {
      method: 'POST',
      body: JSON.stringify({
        image_urls: ['https://cdn.test/stores/store_123/uploads/model.jpg'],
      }),
    })

    const response = await handleGenerationCreatePost(request, testContext)
    const payload = await response.json()

    // AC #4: Subscribed stores with zero credits use overage, NOT 402
    expect(response.status).toBe(201)
    expect(payload).toEqual({
      data: {
        session_id: 'session_123',
        status: 'queued',
      },
      error: null,
    })

    // Verify overage billing was triggered
    expect(mockLogStoreOverage).toHaveBeenCalledWith({
      storeId: 'store_123',
      amount: 1,
      overageCents: 14, // mockGetTierOverageCents returns 14
      requestId: 'req_test_123',
    })
    expect(mockCreateOverageCharge).toHaveBeenCalledWith({
      storeId: 'store_123',
      subscriptionId: 'sub_active_123',
      amount: 1,
      requestId: 'req_test_123',
    })
  })

  it('POST /create in absorb_mode with zero credits and no subscription returns 402', async () => {
    mockDeductStoreCredit.mockResolvedValue(false) // Zero credits
    mockGetStoreBillingProfile.mockResolvedValue({
      subscriptionTier: null,
      subscriptionId: null,
      subscriptionStatus: null,
    })

    const request = new Request('http://localhost/api/v1/generation/create', {
      method: 'POST',
      body: JSON.stringify({
        image_urls: ['https://cdn.test/stores/store_123/uploads/model.jpg'],
      }),
    })

    const response = await handleGenerationCreatePost(request, testContext)
    const payload = await response.json()

    // AC #4: Non-subscribed stores with zero credits get 402
    expect(response.status).toBe(402)
    expect(payload).toEqual({
      data: null,
      error: {
        code: 'INSUFFICIENT_CREDITS',
        message: 'Insufficient store credits to create generation',
      },
    })

    // Verify overage billing was NOT triggered
    expect(mockLogStoreOverage).not.toHaveBeenCalled()
    expect(mockCreateOverageCharge).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('POST /create rejects non-store-scoped image URLs', async () => {
    const request = new Request('http://localhost/api/v1/generation/create', {
      method: 'POST',
      body: JSON.stringify({
        image_urls: ['https://cdn.test/stores/store_other/uploads/model.jpg'],
      }),
    })

    const response = await handleGenerationCreatePost(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'image_urls must use store-scoped paths under stores/store_123/uploads/',
      },
    })
    expect(mockDeductStoreCredit).not.toHaveBeenCalled()
  })

  it('POST /create blocks query parameter path injection bypass (HIGH #1 security fix)', async () => {
    // Security test: Attacker tries to bypass store-scoping by injecting path in query param
    const maliciousUrls = [
      // Path in query parameter
      'https://evil.com/malware.jpg?fake=stores/store_123/uploads/trojan',
      // Path in query parameter (URL encoded)
      'https://evil.com/steal.php?redirect=https://cdn.supabase.co/stores/store_123/uploads/fake',
      // Path in fragment
      'https://attacker.io/exfil#stores/store_123/uploads/data',
    ]

    for (const maliciousUrl of maliciousUrls) {
      const request = new Request('http://localhost/api/v1/generation/create', {
        method: 'POST',
        body: JSON.stringify({
          image_urls: [maliciousUrl],
        }),
      })

      const response = await handleGenerationCreatePost(request, testContext)
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.error.code).toBe('VALIDATION_ERROR')
      expect(mockDeductStoreCredit).not.toHaveBeenCalled()
    }
  })

  it('POST /create refunds and marks failed when queue push fails', async () => {
    mockPushGenerationTask.mockRejectedValue(new Error('redis unavailable'))

    const request = new Request('http://localhost/api/v1/generation/create', {
      method: 'POST',
      body: JSON.stringify({
        image_urls: ['https://cdn.test/stores/store_123/uploads/model.jpg'],
      }),
    })

    const response = await handleGenerationCreatePost(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload).toEqual({
      data: null,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Generation service temporarily unavailable',
      },
    })
    expect(mockRefundStoreCredit).toHaveBeenCalledWith(
      'store_123',
      'req_test_123',
      'Queue failure - refund'
    )
    expect(mockUpdateEq).toHaveBeenCalledWith(
      { status: 'failed', error_message: 'Failed to queue generation task' },
      'id',
      'session_123'
    )
  })

  it('GET /[id] returns store-scoped session details', async () => {
    const sessionId = 'f4b4f879-2757-4138-88c2-af6b743327fd'
    const request = new Request(`http://localhost/api/v1/generation/${sessionId}`)

    const response = await handleGenerationStatusGet(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      data: {
        session_id: sessionId,
        status: 'completed',
        model_image_url: 'https://cdn.test/model.jpg',
        outfit_image_url: 'https://cdn.test/outfit.jpg',
        generated_image_url: 'https://cdn.test/generated.jpg',
        error_message: null,
        credits_used: 1,
        request_id: 'req_test_123',
        created_at: '2026-02-12T00:00:00Z',
        completed_at: '2026-02-12T00:01:00Z',
      },
      error: null,
    })
    expect(mockSelectFilters).toHaveBeenNthCalledWith(1, 'id', sessionId)
    expect(mockSelectFilters).toHaveBeenNthCalledWith(2, 'store_id', 'store_123')
  })

  it('GET /[id] returns 500 on query failures', async () => {
    mockSelectSingle.mockResolvedValue({
      data: null,
      error: { code: '57014', message: 'statement timeout' },
    })
    const request = new Request(
      'http://localhost/api/v1/generation/f4b4f879-2757-4138-88c2-af6b743327fd'
    )

    const response = await handleGenerationStatusGet(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload).toEqual({
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to load generation session',
      },
    })
  })

  it('GET /[id] returns 404 when session does not exist for store', async () => {
    mockSelectSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
    })
    const request = new Request(
      'http://localhost/api/v1/generation/f4b4f879-2757-4138-88c2-af6b743327fd'
    )

    const response = await handleGenerationStatusGet(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload).toEqual({
      data: null,
      error: {
        code: 'NOT_FOUND',
        message: 'Generation session not found',
      },
    })
  })
})
