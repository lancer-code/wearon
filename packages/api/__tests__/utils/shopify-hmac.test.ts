import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { verifyShopifyHmac } from '../../src/utils/shopify-hmac'

describe('verifyShopifyHmac', () => {
  const secret = 'test-shopify-secret'

  function createSignedRequest(body: string, secret: string): Request {
    const hmac = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64')
    return new Request('https://example.com/webhook', {
      method: 'POST',
      headers: {
        'X-Shopify-Hmac-Sha256': hmac,
        'Content-Type': 'application/json',
      },
      body,
    })
  }

  it('accepts valid HMAC signature', async () => {
    const body = JSON.stringify({ shop: 'test.myshopify.com' })
    const request = createSignedRequest(body, secret)

    const isValid = await verifyShopifyHmac(request, secret)
    expect(isValid).toBe(true)
  })

  it('rejects invalid HMAC signature', async () => {
    const body = JSON.stringify({ shop: 'test.myshopify.com' })
    const request = createSignedRequest(body, 'wrong-secret')

    const isValid = await verifyShopifyHmac(request, secret)
    expect(isValid).toBe(false)
  })

  it('rejects request with missing HMAC header', async () => {
    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      body: '{}',
    })

    const isValid = await verifyShopifyHmac(request, secret)
    expect(isValid).toBe(false)
  })

  it('rejects request with tampered body', async () => {
    const originalBody = JSON.stringify({ shop: 'test.myshopify.com' })
    const hmac = crypto.createHmac('sha256', secret).update(originalBody, 'utf8').digest('base64')

    const tamperedBody = JSON.stringify({ shop: 'evil.myshopify.com' })
    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      headers: { 'X-Shopify-Hmac-Sha256': hmac },
      body: tamperedBody,
    })

    const isValid = await verifyShopifyHmac(request, secret)
    expect(isValid).toBe(false)
  })
})
