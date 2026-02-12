import crypto from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockStoreSelectSingle = vi.fn()
const mockPurchaseSelectSingle = vi.fn()
const mockAnalyticsInsert = vi.fn()
const mockRpc = vi.fn()
const mockExtractRequestId = vi.fn(() => 'req_test_shopify_orders_webhook')

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
      if (table === 'stores') {
        return {
          select: () => ({
            eq: () => ({
              single: () => mockStoreSelectSingle(),
            }),
          }),
        }
      }

      if (table === 'store_shopper_purchases') {
        return {
          select: () => ({
            eq: () => ({
              single: () => mockPurchaseSelectSingle(),
            }),
          }),
        }
      }

      if (table === 'store_analytics_events') {
        return {
          insert: (...args: unknown[]) => mockAnalyticsInsert(...args),
        }
      }

      throw new Error(`Unexpected table access in test: ${table}`)
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}))

const { POST } = await import('../app/api/v1/webhooks/shopify/orders/route')

function makeShopifySignature(rawBody: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
}

function makeWebhookRequest(rawBody: string, headers?: Record<string, string>): Request {
  return new Request('http://localhost/api/v1/webhooks/shopify/orders', {
    method: 'POST',
    body: rawBody,
    headers: {
      'X-Shopify-Topic': 'orders/create',
      'X-Shopify-Shop-Domain': 'store.myshopify.com',
      ...headers,
    },
  })
}

describe('POST /api/v1/webhooks/shopify/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    process.env.SHOPIFY_API_SECRET = 'test_shopify_secret'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

    mockStoreSelectSingle.mockResolvedValue({
      data: {
        id: 'store_123',
        shop_domain: 'store.myshopify.com',
        billing_mode: 'resell_mode',
        shopify_product_id: '111222333',
      },
      error: null,
    })

    mockPurchaseSelectSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' },
    })

    mockAnalyticsInsert.mockResolvedValue({ error: null })
    mockRpc.mockResolvedValue({
      data: [
        {
          status: 'processed',
          purchase_id: 'purchase_123',
          store_id: 'store_123',
          shopper_email: 'shopper@example.com',
          shopify_order_id: '555666777',
          credits_purchased: 2,
          amount_paid: 1.5,
          currency: 'USD',
        },
      ],
      error: null,
    })
  })

  it('returns 401 for invalid Shopify signature', async () => {
    const rawBody = JSON.stringify({
      id: 555666777,
      email: 'shopper@example.com',
      currency: 'USD',
      line_items: [{ product_id: 111222333, quantity: 1, price: '0.75' }],
    })

    const request = makeWebhookRequest(rawBody, {
      'X-Shopify-Hmac-Sha256': makeShopifySignature(rawBody, 'wrong_secret'),
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

    expect(mockStoreSelectSingle).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('processes valid credit purchase webhook and transfers credits', async () => {
    const rawBody = JSON.stringify({
      id: 555666777,
      email: 'shopper@example.com',
      currency: 'USD',
      line_items: [{ product_id: 111222333, quantity: 2, price: '0.75' }],
    })

    const request = makeWebhookRequest(rawBody, {
      'X-Shopify-Hmac-Sha256': makeShopifySignature(rawBody, process.env.SHOPIFY_API_SECRET!),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      data: {
        acknowledged: true,
        purchase: {
          status: 'processed',
          purchase_id: 'purchase_123',
          store_id: 'store_123',
          shopper_email: 'shopper@example.com',
          shopify_order_id: '555666777',
          credits_purchased: 2,
          amount_paid: 1.5,
          currency: 'USD',
        },
      },
      error: null,
    })

    expect(mockRpc).toHaveBeenCalledWith('process_store_shopper_purchase', {
      p_store_id: 'store_123',
      p_shopper_email: 'shopper@example.com',
      p_shopify_order_id: '555666777',
      p_credits_purchased: 2,
      p_amount_paid: 1.5,
      p_currency: 'USD',
      p_request_id: 'req_test_shopify_orders_webhook',
    })
  })

  it('returns duplicate acknowledgement when purchase record already exists', async () => {
    const rawBody = JSON.stringify({
      id: 555666777,
      email: 'shopper@example.com',
      currency: 'USD',
      line_items: [{ product_id: 111222333, quantity: 1, price: '0.75' }],
    })

    mockPurchaseSelectSingle.mockResolvedValueOnce({
      data: {
        id: 'purchase_123',
        store_id: 'store_123',
        shopper_email: 'shopper@example.com',
        shopify_order_id: '555666777',
        credits_purchased: 1,
        amount_paid: 0.75,
        currency: 'USD',
      },
      error: null,
    })

    const request = makeWebhookRequest(rawBody, {
      'X-Shopify-Hmac-Sha256': makeShopifySignature(rawBody, process.env.SHOPIFY_API_SECRET!),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.acknowledged).toBe(true)
    expect(payload.data.duplicate).toBe(true)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('acknowledges insufficient store credits and logs analytics event', async () => {
    const rawBody = JSON.stringify({
      id: 555666777,
      email: 'shopper@example.com',
      currency: 'USD',
      line_items: [{ product_id: 111222333, quantity: 3, price: '0.5' }],
    })

    mockRpc.mockResolvedValueOnce({
      data: [
        {
          status: 'insufficient',
          purchase_id: null,
          store_id: 'store_123',
          shopper_email: 'shopper@example.com',
          shopify_order_id: '555666777',
          credits_purchased: 3,
          amount_paid: 1.5,
          currency: 'USD',
        },
      ],
      error: null,
    })

    const request = makeWebhookRequest(rawBody, {
      'X-Shopify-Hmac-Sha256': makeShopifySignature(rawBody, process.env.SHOPIFY_API_SECRET!),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      data: {
        acknowledged: true,
        insufficient_credits: true,
        credits_required: 3,
      },
      error: null,
    })

    expect(mockAnalyticsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        store_id: 'store_123',
        event_type: 'store_credit_insufficient',
        shopper_email: 'shopper@example.com',
      }),
    )
  })

  it('ignores non-credit orders', async () => {
    const rawBody = JSON.stringify({
      id: 555666777,
      email: 'shopper@example.com',
      currency: 'USD',
      line_items: [{ product_id: 999999999, quantity: 1, price: '99.99' }],
    })

    const request = makeWebhookRequest(rawBody, {
      'X-Shopify-Hmac-Sha256': makeShopifySignature(rawBody, process.env.SHOPIFY_API_SECRET!),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      data: {
        acknowledged: true,
        ignored: 'non_credit_order',
      },
      error: null,
    })

    expect(mockPurchaseSelectSingle).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })
})
