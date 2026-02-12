import crypto from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAddStoreCredits = vi.fn()
const mockInsertBillingWebhookEvent = vi.fn()
const mockStoreSelectSingle = vi.fn()
const mockStoreUpdateEq = vi.fn()
const mockExtractRequestId = vi.fn(() => 'req_test_paddle_webhook')

vi.mock('../../../packages/api/src/services/b2b-credits', () => ({
  addStoreCredits: (...args: unknown[]) => mockAddStoreCredits(...args),
}))

vi.mock('../../../packages/api/src/middleware/request-id', () => ({
  REQUEST_ID_HEADER: 'X-Request-Id',
  extractRequestId: (...args: unknown[]) => mockExtractRequestId(...args),
}))

vi.mock('../../../packages/api/src/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'billing_webhook_events') {
        return {
          insert: (...args: unknown[]) => mockInsertBillingWebhookEvent(...args),
        }
      }

      if (table === 'stores') {
        return {
          select: () => ({
            eq: () => ({
              single: () => mockStoreSelectSingle(),
            }),
          }),
          update: () => ({
            eq: (...args: unknown[]) => mockStoreUpdateEq(...args),
          }),
        }
      }

      throw new Error(`Unexpected table access in test: ${table}`)
    },
  }),
}))

const { POST } = await import('../app/api/v1/webhooks/paddle/route')

function makePaddleSignature(rawBody: string, secret: string, timestamp = 1700000000): string {
  const digest = crypto.createHmac('sha256', secret).update(`${timestamp}:${rawBody}`).digest('hex')
  return `ts=${timestamp};h1=${digest}`
}

describe('POST /api/v1/webhooks/paddle', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    process.env.PADDLE_WEBHOOK_SECRET = 'test_paddle_webhook_secret'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

    vi.spyOn(Date, 'now').mockReturnValue(1700000000 * 1000)

    mockInsertBillingWebhookEvent.mockResolvedValue({ error: null })
    mockStoreSelectSingle.mockResolvedValue({ data: null, error: null })
    mockStoreUpdateEq.mockResolvedValue({ error: null })
    mockAddStoreCredits.mockResolvedValue(undefined)
  })

  it('returns 401 for invalid Paddle signature', async () => {
    const rawBody = JSON.stringify({
      event_id: 'evt_invalid_sig',
      event_type: 'transaction.completed',
      data: { custom_data: { purchase_type: 'payg', store_id: 'store_123', credits: 10 } },
    })

    const request = new Request('http://localhost/api/v1/webhooks/paddle', {
      method: 'POST',
      body: rawBody,
      headers: {
        'Paddle-Signature': 'ts=1700000000;h1=deadbeef',
      },
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({
      data: null,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid webhook signature',
      },
    })

    expect(mockInsertBillingWebhookEvent).not.toHaveBeenCalled()
    expect(mockAddStoreCredits).not.toHaveBeenCalled()
  })

  it('returns duplicate acknowledgement for repeated webhook event id', async () => {
    const rawBody = JSON.stringify({
      event_id: 'evt_duplicate',
      event_type: 'transaction.completed',
      data: {
        custom_data: {
          purchase_type: 'payg',
          store_id: 'store_123',
          credits: 10,
        },
      },
    })

    mockInsertBillingWebhookEvent.mockResolvedValue({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })

    const request = new Request('http://localhost/api/v1/webhooks/paddle', {
      method: 'POST',
      body: rawBody,
      headers: {
        'Paddle-Signature': makePaddleSignature(rawBody, process.env.PADDLE_WEBHOOK_SECRET!),
      },
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      data: { acknowledged: true, duplicate: true },
      error: null,
    })

    expect(mockAddStoreCredits).not.toHaveBeenCalled()
  })

  it('processes valid PAYG transaction.completed webhook and credits the store', async () => {
    const rawBody = JSON.stringify({
      event_id: 'evt_payg_completed',
      event_type: 'transaction.completed',
      data: {
        customer_id: 'ctm_123',
        custom_data: {
          purchase_type: 'payg',
          store_id: 'store_123',
          credits: 25,
        },
      },
    })

    const request = new Request('http://localhost/api/v1/webhooks/paddle', {
      method: 'POST',
      body: rawBody,
      headers: {
        'Paddle-Signature': makePaddleSignature(rawBody, process.env.PADDLE_WEBHOOK_SECRET!),
      },
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      data: { acknowledged: true },
      error: null,
    })

    expect(mockInsertBillingWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'paddle',
        event_id: 'evt_payg_completed',
        event_type: 'transaction.completed',
        request_id: 'req_test_paddle_webhook',
        store_id: 'store_123',
      })
    )

    expect(mockAddStoreCredits).toHaveBeenCalledWith(
      'store_123',
      25,
      'purchase',
      'req_test_paddle_webhook',
      'Paddle PAYG purchase (25 credits)'
    )
  })

  it('simulates sandbox checkout completion -> webhook -> credit grant flow', async () => {
    const checkoutMetadata = {
      purchase_type: 'subscription',
      tier: 'growth',
      credits: 800,
      store_id: 'store_growth_123',
    }

    const rawBody = JSON.stringify({
      event_id: 'evt_sandbox_checkout_complete',
      event_type: 'transaction.completed',
      data: {
        subscription_id: 'sub_123',
        customer_id: 'ctm_456',
        custom_data: checkoutMetadata,
      },
    })

    const request = new Request('http://localhost/api/v1/webhooks/paddle', {
      method: 'POST',
      body: rawBody,
      headers: {
        'Paddle-Signature': makePaddleSignature(rawBody, process.env.PADDLE_WEBHOOK_SECRET!),
      },
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      data: { acknowledged: true },
      error: null,
    })

    expect(mockAddStoreCredits).toHaveBeenCalledWith(
      'store_growth_123',
      800,
      'subscription',
      'req_test_paddle_webhook',
      'Paddle subscription top-up (growth)'
    )
  })
})
