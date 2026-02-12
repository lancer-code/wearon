import crypto from 'node:crypto'

export async function verifyShopifyHmac(request: Request, secret: string): Promise<boolean> {
  const hmacHeader = request.headers.get('X-Shopify-Hmac-Sha256')
  if (!hmacHeader) {
    return false
  }

  try {
    const rawBody = await request.text()
    const computedHmac = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('base64')

    const hmacBuffer = Buffer.from(hmacHeader, 'base64')
    const computedBuffer = Buffer.from(computedHmac, 'base64')

    // timingSafeEqual requires equal-length buffers
    if (hmacBuffer.length !== computedBuffer.length) {
      return false
    }

    return crypto.timingSafeEqual(hmacBuffer, computedBuffer)
  } catch (error) {
    // Malformed input (invalid base64, etc.) - reject
    return false
  }
}
