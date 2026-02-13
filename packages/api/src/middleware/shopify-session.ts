import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { logger } from '../logger'

export interface ShopifySessionContext {
  storeId: string
  shopDomain: string
  shopifyUserId: string
}

interface ShopifySessionTokenPayload {
  iss: string
  dest: string
  aud: string
  sub: string
  exp: number
  iat: number
  nbf: number
  jti: string
  sid: string
}

let serviceClient: ReturnType<typeof createClient> | null = null

function getServiceClient() {
  if (!serviceClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
    }

    serviceClient = createClient(supabaseUrl, supabaseServiceKey)
  }
  return serviceClient
}

function base64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(padded, 'base64')
}

function verifySessionToken(token: string): ShopifySessionTokenPayload {
  const apiSecret = process.env.SHOPIFY_API_SECRET
  const apiKey = process.env.SHOPIFY_API_KEY

  if (!apiSecret || !apiKey) {
    throw new Error('SHOPIFY_API_SECRET and SHOPIFY_API_KEY must be set')
  }

  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format')
  }

  const [headerB64, payloadB64, signatureB64] = parts

  // Verify header
  const header = JSON.parse(base64UrlDecode(headerB64!).toString('utf-8'))
  if (header.alg !== 'HS256') {
    throw new Error(`Unsupported JWT algorithm: ${header.alg}`)
  }

  // Verify signature using timing-safe comparison
  const signedContent = `${headerB64}.${payloadB64}`
  const expectedSignature = crypto
    .createHmac('sha256', apiSecret)
    .update(signedContent)
    .digest('base64url')

  const sigBuf = Buffer.from(signatureB64!, 'utf-8')
  const expectedBuf = Buffer.from(expectedSignature, 'utf-8')
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error('Invalid JWT signature')
  }

  // Parse payload
  const payload: ShopifySessionTokenPayload = JSON.parse(
    base64UrlDecode(payloadB64!).toString('utf-8')
  )

  // Verify audience matches API key
  if (payload.aud !== apiKey) {
    throw new Error('JWT audience mismatch')
  }

  const nowSeconds = Math.floor(Date.now() / 1000)

  // Verify not-before
  if (payload.nbf && payload.nbf > nowSeconds) {
    throw new Error('JWT is not yet valid (nbf)')
  }

  // Verify expiration
  if (payload.exp < nowSeconds) {
    throw new Error('JWT has expired')
  }

  return payload
}

function extractShopDomain(dest: string): string {
  // dest is like "https://store-name.myshopify.com"
  try {
    const url = new URL(dest)
    return url.hostname
  } catch {
    throw new Error(`Invalid dest URL in JWT: ${dest}`)
  }
}

async function lookupStoreByDomain(
  shopDomain: string
): Promise<{ id: string; shop_domain: string; status: string } | null> {
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('stores')
    .select('id, shop_domain, status')
    .eq('shop_domain', shopDomain)
    .single()

  if (error || !data) {
    return null
  }

  return data as { id: string; shop_domain: string; status: string }
}

export type ShopifySessionResult =
  | { context: ShopifySessionContext }
  | { error: NextResponse }

export async function authenticateShopifySession(
  request: Request
): Promise<ShopifySessionResult> {
  const authHeader = request.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      error: NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Missing session token' } },
        { status: 401 }
      ),
    }
  }

  const token = authHeader.slice(7)

  let payload: ShopifySessionTokenPayload
  try {
    payload = verifySessionToken(token)
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      '[Shopify Session] Token verification failed'
    )
    return {
      error: NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid session token' } },
        { status: 401 }
      ),
    }
  }

  const shopDomain = extractShopDomain(payload.dest)
  const store = await lookupStoreByDomain(shopDomain)

  if (!store) {
    logger.warn(
      { shopDomain },
      '[Shopify Session] Store not found for domain'
    )
    return {
      error: NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Store not found' } },
        { status: 404 }
      ),
    }
  }

  return {
    context: {
      storeId: store.id,
      shopDomain: store.shop_domain,
      shopifyUserId: payload.sub,
    },
  }
}

export function withShopifySession(
  handler: (request: Request, context: ShopifySessionContext) => Promise<NextResponse>
): (request: Request) => Promise<NextResponse> {
  return async (request: Request): Promise<NextResponse> => {
    const result = await authenticateShopifySession(request)

    if ('error' in result) {
      return result.error
    }

    try {
      return await handler(request, result.context)
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        '[Shopify Session] Unhandled error in handler'
      )
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
        { status: 500 }
      )
    }
  }
}
