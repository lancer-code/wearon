import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { getAdminClient } from '../lib/supabase-admin'
import { logger } from '../logger'
import { exchangeTokenForOfflineAccess } from '../services/shopify'
import { encrypt } from '../utils/encryption'

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


function base64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(padded, 'base64')
}

function verifySessionToken(token: string): ShopifySessionTokenPayload {
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET
  const clientId = process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID

  if (!clientSecret || !clientId) {
    throw new Error('SHOPIFY_CLIENT_SECRET and NEXT_PUBLIC_SHOPIFY_CLIENT_ID must be set')
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
    .createHmac('sha256', clientSecret)
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

  // Verify audience matches client ID
  if (payload.aud !== clientId) {
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
  const supabase = getAdminClient()

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

async function provisionStore(
  shopDomain: string,
  sessionToken: string
): Promise<{ id: string; shop_domain: string; status: string } | null> {
  try {
    console.log('[Shopify Session] Provisioning new store for domain:', shopDomain)

    const { accessToken } = await exchangeTokenForOfflineAccess(shopDomain, sessionToken)
    const encryptedToken = encrypt(accessToken)
    const supabase = getAdminClient()

    const { data: store, error } = await supabase
      .from('stores')
      .insert({
        shop_domain: shopDomain,
        access_token_encrypted: encryptedToken,
        status: 'active',
        billing_mode: 'absorb_mode',
        onboarding_completed: false,
      })
      .select('id, shop_domain, status')
      .single()

    if (error || !store) {
      console.error('[Shopify Session] Store provisioning failed:', error?.message)
      return null
    }

    // Generate API key
    const randomHex = crypto.randomBytes(16).toString('hex')
    const plaintext = `wk_${randomHex}`
    const keyHash = crypto.createHash('sha256').update(plaintext).digest('hex')
    const keyPrefix = plaintext.substring(0, 16)

    await supabase.from('store_api_keys').insert({
      store_id: store.id,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      allowed_domains: [`https://${shopDomain}`],
      is_active: true,
    })

    console.log('[Shopify Session] Store provisioned successfully:', store.id, shopDomain)
    return store as { id: string; shop_domain: string; status: string }
  } catch (err) {
    console.error(
      '[Shopify Session] Token exchange / provisioning error:',
      err instanceof Error ? err.message : String(err)
    )
    return null
  }
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
  console.log('[Shopify Session] Shop domain from JWT:', shopDomain)

  let store = await lookupStoreByDomain(shopDomain)

  // Auto-provision: with managed installation, Shopify doesn't call the OAuth callback.
  // The store must be created on first authenticated request via token exchange.
  if (!store) {
    console.log('[Shopify Session] Store not found, attempting auto-provision for:', shopDomain)
    store = await provisionStore(shopDomain, token)
  }

  if (!store) {
    console.error('[Shopify Session] Store not found and provisioning failed for:', shopDomain)
    return {
      error: NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Store not found' } },
        { status: 404 }
      ),
    }
  }

  if (store.status !== 'active') {
    console.log('[Shopify Session] Store is not active:', shopDomain, store.status)
    return {
      error: NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Store account is not active' } },
        { status: 403 }
      ),
    }
  }

  console.log('[Shopify Session] Authenticated:', shopDomain, 'storeId:', store.id)

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
