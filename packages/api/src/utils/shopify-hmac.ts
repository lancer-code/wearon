import crypto from 'node:crypto'

export async function verifyShopifyHmac(request: Request, secret: string): Promise<boolean> {
  const hmacHeader = request.headers.get('X-Shopify-Hmac-Sha256')
  if (!hmacHeader) {
    return false
  }

  const rawBody = await request.text()
  const computedHmac = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64')

  return crypto.timingSafeEqual(
    Buffer.from(hmacHeader, 'base64'),
    Buffer.from(computedHmac, 'base64'),
  )
}
