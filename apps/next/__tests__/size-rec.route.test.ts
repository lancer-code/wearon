import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAxiosPost = vi.fn()
const mockLoggerError = vi.fn()
const mockLoggerInfo = vi.fn()
const mockDeductStoreCredit = vi.fn()
const mockRefundStoreCredit = vi.fn()

vi.mock('axios', () => ({
  default: {
    post: (...args: unknown[]) => mockAxiosPost(...args),
    isAxiosError: (err: unknown) => {
      return Boolean(err && typeof err === 'object' && 'isAxiosError' in err)
    },
  },
}))

vi.mock('../../../packages/api/src/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  createChildLogger: () => ({
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: vi.fn(),
  }),
}))

vi.mock('../../../packages/api/src/services/b2b-credits', () => ({
  deductStoreCredit: (...args: unknown[]) => mockDeductStoreCredit(...args),
  refundStoreCredit: (...args: unknown[]) => mockRefundStoreCredit(...args),
}))

const { handleSizeRecPost } = await import('../app/api/v1/size-rec/route')

const testContext = {
  storeId: 'store_123',
  shopDomain: 'store.myshopify.com',
  allowedDomains: ['https://store.myshopify.com'],
  subscriptionTier: 'starter',
  isActive: true,
  requestId: 'req_test_123',
}

describe('POST /api/v1/size-rec', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.WORKER_API_URL = 'https://worker.example'
  })

  it('proxies valid request to FastAPI and returns size recommendation', async () => {
    mockAxiosPost.mockResolvedValue({
      data: {
        recommended_size: 'M',
        measurements: { chest_cm: 96, waist_cm: 82 },
        confidence: 0.85,
        body_type: 'athletic',
      },
    })

    const request = new Request('http://localhost/api/v1/size-rec', {
      method: 'POST',
      body: JSON.stringify({
        image_url: 'https://cdn.example.com/image.jpg',
        height_cm: 175,
      }),
    })

    const response = await handleSizeRecPost(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mockAxiosPost).toHaveBeenCalledWith(
      'https://worker.example/estimate-body',
      { image_url: 'https://cdn.example.com/image.jpg', height_cm: 175 },
      {
        timeout: 5000,
        headers: { 'X-Request-Id': 'req_test_123' },
      }
    )

    expect(payload).toEqual({
      data: {
        recommended_size: 'M',
        measurements: { chest_cm: 96, waist_cm: 82 },
        confidence: 0.85,
        body_type: 'athletic',
      },
      error: null,
    })
  })

  it('returns 503 when worker times out and logs sanitized error details', async () => {
    mockAxiosPost.mockRejectedValue({
      isAxiosError: true,
      code: 'ECONNABORTED',
      message: 'timeout of 5000ms exceeded',
    })

    const request = new Request('http://localhost/api/v1/size-rec', {
      method: 'POST',
      body: JSON.stringify({
        image_url: 'https://cdn.example.com/signed-image?token=secret-token',
        height_cm: 180,
      }),
    })

    const response = await handleSizeRecPost(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload).toEqual({
      data: null,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Size recommendation temporarily unavailable',
      },
    })

    expect(mockLoggerError).toHaveBeenCalled()
    const [logMeta] = mockLoggerError.mock.calls[0] as [Record<string, unknown>, string]
    expect(logMeta.worker_url).toBe('https://worker.example')
    expect(logMeta.request_id).toBeUndefined()
    expect(JSON.stringify(logMeta)).not.toContain('image_url')
    expect(JSON.stringify(logMeta)).not.toContain('secret-token')
  })

  it('does not deduct credits for size recommendation requests', async () => {
    mockAxiosPost.mockResolvedValue({
      data: {
        recommended_size: 'L',
        measurements: { chest_cm: 102 },
        confidence: 0.74,
        body_type: 'regular',
      },
    })

    const request = new Request('http://localhost/api/v1/size-rec', {
      method: 'POST',
      body: JSON.stringify({
        image_url: 'https://cdn.example.com/image.jpg',
        height_cm: 182,
      }),
    })

    const response = await handleSizeRecPost(request, testContext)

    expect(response.status).toBe(200)
    expect(mockDeductStoreCredit).not.toHaveBeenCalled()
    expect(mockRefundStoreCredit).not.toHaveBeenCalled()
  })

  it('rejects invalid height_cm values', async () => {
    const invalidBodies = [
      { image_url: 'https://cdn.example.com/image.jpg', height_cm: 99 },
      { image_url: 'https://cdn.example.com/image.jpg', height_cm: 251 },
    ]

    for (const body of invalidBodies) {
      const request = new Request('http://localhost/api/v1/size-rec', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const response = await handleSizeRecPost(request, testContext)
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.error.code).toBe('VALIDATION_ERROR')
    }

    expect(mockAxiosPost).not.toHaveBeenCalled()
  })
})
