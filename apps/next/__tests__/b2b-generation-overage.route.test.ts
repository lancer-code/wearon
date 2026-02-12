import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDeductStoreCredit = vi.fn()
const mockRefundStoreCredit = vi.fn()
const mockGetStoreBillingProfile = vi.fn()
const mockLogStoreOverage = vi.fn()
const mockCreateOverageCharge = vi.fn()
const mockRefundOverageCharge = vi.fn()
const mockGetTierOverageCents = vi.fn(() => 14)
const mockPushGenerationTask = vi.fn()
const mockCreateChildLogger = vi.fn(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

const mockSessionInsertSingle = vi.fn()
const mockSessionUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null })
const mockStoreSelectSingle = vi.fn()

vi.mock('../../../packages/api/src/middleware/b2b', () => ({
  withB2BAuth: (handler: unknown) => handler,
}))

vi.mock('../../../packages/api/src/logger', () => ({
  createChildLogger: (...args: unknown[]) => mockCreateChildLogger(...args),
}))

vi.mock('../../../packages/api/src/services/b2b-credits', () => ({
  deductStoreCredit: (...args: unknown[]) => mockDeductStoreCredit(...args),
  refundStoreCredit: (...args: unknown[]) => mockRefundStoreCredit(...args),
  getStoreBillingProfile: (...args: unknown[]) => mockGetStoreBillingProfile(...args),
  logStoreOverage: (...args: unknown[]) => mockLogStoreOverage(...args),
}))

vi.mock('../../../packages/api/src/services/paddle', () => ({
  createOverageCharge: (...args: unknown[]) => mockCreateOverageCharge(...args),
  refundOverageCharge: (...args: unknown[]) => mockRefundOverageCharge(...args),
  getTierOverageCents: (...args: unknown[]) => mockGetTierOverageCents(...args),
}))

vi.mock('../../../packages/api/src/services/redis-queue', () => ({
  pushGenerationTask: (...args: unknown[]) => mockPushGenerationTask(...args),
}))

vi.mock('../../../packages/api/src/services/store-analytics', () => ({
  logStoreAnalyticsEvent: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'stores') {
        return {
          select: () => ({
            eq: () => ({
              single: () => mockStoreSelectSingle(),
            }),
          }),
        }
      }

      if (table !== 'store_generation_sessions') {
        throw new Error(`Unexpected table in generation overage tests: ${table}`)
      }

      return {
        insert: () => ({
          select: () => ({
            single: () => mockSessionInsertSingle(),
          }),
        }),
        update: (payload: Record<string, unknown>) => ({
          eq: (field: string, value: string) => mockSessionUpdateEq(payload, field, value),
        }),
      }
    },
  }),
}))

const { handleGenerationCreatePost } = await import('../app/api/v1/generation/create/route')

const testContext = {
  storeId: 'store_123',
  requestId: 'req_test_overage_123',
}

describe('B2B generation overage flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

    mockSessionInsertSingle.mockResolvedValue({
      data: { id: 'session_123' },
      error: null,
    })
    mockStoreSelectSingle.mockResolvedValue({
      data: {
        billing_mode: 'absorb_mode',
      },
      error: null,
    })

    mockDeductStoreCredit.mockResolvedValue(false)
    mockGetStoreBillingProfile.mockResolvedValue({
      subscriptionTier: 'growth',
      subscriptionId: 'sub_123',
      subscriptionStatus: 'active',
    })
    mockCreateOverageCharge.mockResolvedValue('chg_123')
    mockLogStoreOverage.mockResolvedValue(undefined)
    mockPushGenerationTask.mockResolvedValue(undefined)
    mockRefundStoreCredit.mockResolvedValue(undefined)
  })

  it('overage happy path bills one unit and queues generation', async () => {
    const request = new Request('http://localhost/api/v1/generation/create', {
      method: 'POST',
      body: JSON.stringify({
        image_urls: [
          'https://cdn.test/stores/store_123/uploads/model.jpg',
          'https://cdn.test/stores/store_123/uploads/outfit.jpg',
        ],
        age_verified: true,
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

    expect(mockCreateOverageCharge).toHaveBeenCalledWith({
      subscriptionId: 'sub_123',
      tier: 'growth',
      storeId: 'store_123',
      sessionId: 'session_123',
      requestId: 'req_test_overage_123',
    })

    expect(mockLogStoreOverage).toHaveBeenCalledWith(
      'store_123',
      'req_test_overage_123',
      expect.stringContaining('chg_123')
    )

    expect(mockPushGenerationTask).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'b2b',
        storeId: 'store_123',
        sessionId: 'session_123',
      })
    )
  })

  it('does not bill overage when subscription status is unknown', async () => {
    mockGetStoreBillingProfile.mockResolvedValue({
      subscriptionTier: 'growth',
      subscriptionId: 'sub_123',
      subscriptionStatus: null,
    })

    const request = new Request('http://localhost/api/v1/generation/create', {
      method: 'POST',
      body: JSON.stringify({
        image_urls: ['https://cdn.test/stores/store_123/uploads/model.jpg'],
        age_verified: true,
      }),
    })

    const response = await handleGenerationCreatePost(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(402)
    expect(payload).toEqual({
      data: null,
      error: {
        code: 'INSUFFICIENT_CREDITS',
        message: 'Insufficient credits to create generation',
      },
    })

    expect(mockCreateOverageCharge).not.toHaveBeenCalled()
    expect(mockSessionInsertSingle).not.toHaveBeenCalled()
  })

  it('overage billing failure marks session failed and returns 503', async () => {
    mockCreateOverageCharge.mockRejectedValue(new Error('Paddle charge failed'))

    const request = new Request('http://localhost/api/v1/generation/create', {
      method: 'POST',
      body: JSON.stringify({
        image_urls: ['https://cdn.test/stores/store_123/uploads/model.jpg'],
        age_verified: true,
      }),
    })

    const response = await handleGenerationCreatePost(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload).toEqual({
      data: null,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Overage billing temporarily unavailable',
      },
    })

    expect(mockSessionUpdateEq).toHaveBeenCalledWith(
      {
        status: 'failed',
        error_message: 'Failed to bill overage for generation request',
      },
      'id',
      'session_123'
    )

    expect(mockPushGenerationTask).not.toHaveBeenCalled()
    expect(mockRefundStoreCredit).not.toHaveBeenCalled()
  })

  it('continues generation when overage transaction logging fails after successful charge', async () => {
    mockLogStoreOverage.mockRejectedValue(new Error('log insert failed'))

    const request = new Request('http://localhost/api/v1/generation/create', {
      method: 'POST',
      body: JSON.stringify({
        image_urls: ['https://cdn.test/stores/store_123/uploads/model.jpg'],
        age_verified: true,
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
    expect(mockCreateOverageCharge).toHaveBeenCalled()
    expect(mockPushGenerationTask).toHaveBeenCalled()

    // MEDIUM #8 FIX: Metadata update is called to store charge ID as backup audit trail
    expect(mockSessionUpdateEq).toHaveBeenCalledWith(
      {
        metadata: {
          overage_charge_id: 'chg_123',
          overage_tier: 'growth',
        },
      },
      'id',
      'session_123'
    )
  })

  it('refunds overage when queue fails after successful charge (MEDIUM #6)', async () => {
    mockCreateOverageCharge.mockResolvedValue('chg_abc123')
    mockPushGenerationTask.mockRejectedValue(new Error('Redis connection failed'))
    mockRefundOverageCharge.mockResolvedValue(undefined)

    const request = new Request('http://localhost/api/v1/generation/create', {
      method: 'POST',
      body: JSON.stringify({
        image_urls: ['https://cdn.test/stores/store_123/uploads/model.jpg'],
        age_verified: true,
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

    expect(mockCreateOverageCharge).toHaveBeenCalled()
    expect(mockRefundOverageCharge).toHaveBeenCalledWith({
      chargeId: 'chg_abc123',
      requestId: 'req_test_overage_123',
      reason: 'Queue failure after successful overage billing - service not delivered',
    })

    expect(mockSessionUpdateEq).toHaveBeenCalledWith(
      {
        status: 'failed',
        error_message: 'Failed to queue generation task',
      },
      'id',
      'session_123'
    )
  })
})
