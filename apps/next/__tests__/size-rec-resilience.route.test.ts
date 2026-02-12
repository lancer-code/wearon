import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAxiosPost = vi.fn()
const mockDeductStoreCredit = vi.fn()
const mockRefundStoreCredit = vi.fn()
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

const mockSessionInsertSingle = vi.fn()
const mockSessionUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null })

vi.mock('axios', () => ({
  default: {
    post: (...args: unknown[]) => mockAxiosPost(...args),
    isAxiosError: (err: unknown) =>
      Boolean(err && typeof err === 'object' && 'isAxiosError' in err),
  },
}))

vi.mock('../../../packages/api/src/middleware/b2b', () => ({
  withB2BAuth: (handler: unknown) => handler,
}))

vi.mock('../../../packages/api/src/logger', () => ({
  createChildLogger: (...args: unknown[]) => mockCreateChildLogger(...args),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../../../packages/api/src/services/b2b-credits', () => ({
  deductStoreCredit: (...args: unknown[]) => mockDeductStoreCredit(...args),
  refundStoreCredit: (...args: unknown[]) => mockRefundStoreCredit(...args),
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

vi.mock('../../../packages/api/src/services/b2b-storage', () => ({
  getStoreUploadPath: (storeId: string) => `stores/${storeId}/uploads`,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'store_generation_sessions') {
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
      }

      if (table === 'stores') {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { billing_mode: 'absorb_mode' },
                  error: null,
                }),
            }),
          }),
        }
      }

      return {
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: null,
                error: { code: 'PGRST116' },
              }),
          }),
        }),
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

const { handleSizeRecPost } = await import('../app/api/v1/size-rec/route')
const { handleGenerationCreatePost } = await import('../app/api/v1/generation/create/route')

const sizeRecContext = {
  storeId: 'store_123',
  shopDomain: 'store.myshopify.com',
  allowedDomains: ['https://store.myshopify.com'],
  subscriptionTier: 'starter',
  isActive: true,
  requestId: 'req_size_123',
}

const generationContext = {
  storeId: 'store_123',
  requestId: 'req_generation_123',
}

describe('size-rec graceful degradation resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    process.env.WORKER_API_URL = 'https://worker.example'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

    mockDeductStoreCredit.mockResolvedValue(true)
    mockRefundStoreCredit.mockResolvedValue(undefined)
    mockGetStoreBillingProfile.mockResolvedValue({
      subscriptionTier: null,
      subscriptionId: null,
      subscriptionStatus: null,
    })
    mockLogStoreOverage.mockResolvedValue(undefined)
    mockCreateOverageCharge.mockResolvedValue('chg_123')
    mockPushGenerationTask.mockResolvedValue(undefined)
    mockSessionInsertSingle.mockResolvedValue({
      data: { id: 'session_123' },
      error: null,
    })
  })

  it('size-rec outage returns 503 and does not impact generation endpoint availability', async () => {
    mockAxiosPost.mockRejectedValue({
      isAxiosError: true,
      code: 'ECONNABORTED',
      message: 'timeout of 5000ms exceeded',
    })

    const sizeRecRequest = new Request('http://localhost/api/v1/size-rec', {
      method: 'POST',
      body: JSON.stringify({
        image_url: 'https://test.supabase.co/storage/v1/object/image.jpg',
        height_cm: 176,
      }),
    })
    const sizeRecResponse = await handleSizeRecPost(sizeRecRequest, sizeRecContext)
    const sizeRecPayload = await sizeRecResponse.json()

    expect(sizeRecResponse.status).toBe(503)
    expect(sizeRecPayload).toEqual({
      data: null,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Size recommendation temporarily unavailable',
      },
    })

    const generationRequest = new Request('http://localhost/api/v1/generation/create', {
      method: 'POST',
      body: JSON.stringify({
        image_urls: ['https://cdn.test/stores/store_123/uploads/model.jpg'],
      }),
    })
    const generationResponse = await handleGenerationCreatePost(
      generationRequest,
      generationContext
    )
    const generationPayload = await generationResponse.json()

    expect(generationResponse.status).toBe(201)
    expect(generationPayload).toEqual({
      data: {
        session_id: 'session_123',
        status: 'queued',
      },
      error: null,
    })
    expect(mockPushGenerationTask).toHaveBeenCalled()
  })
})
