import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { getAdminClient } from '../lib/supabase-admin'
import { createChildLogger, logger } from '../logger'
import { MerchantOpsError } from '../services/merchant-ops'
import { exchangeTokenForOfflineAccess } from '../services/shopify'
import { encrypt } from '../utils/encryption'
import { extractRequestId } from './request-id'

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

  // Verify issuer matches the shop destination
  const expectedIssPrefix = `${payload.dest}/admin`
  if (!payload.iss || !payload.iss.startsWith(expectedIssPrefix)) {
    throw new Error('JWT issuer does not match shop destination')
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
  shopDomain: string,
  requestId: string
): Promise<{ id: string; shop_domain: string; status: string } | null> {
  const supabase = getAdminClient()
  const log = createChildLogger(requestId)

  const { data, error } = await supabase
    .from('stores')
    .select('id, shop_domain, status')
    .eq('shop_domain', shopDomain)
    .single()

  if (error) {
    log.warn({ shop: shopDomain, code: error.code, err: error.message }, '[Shopify Session] Store lookup error')
    return null
  }

  if (!data) {
    return null
  }

  return data as { id: string; shop_domain: string; status: string }
}

async function provisionStore(
  shopDomain: string,
  sessionToken: string,
  requestId: string
): Promise<{ id: string; shop_domain: string; status: string } | null> {
  const log = createChildLogger(requestId)

  try {
    log.info({ shop: shopDomain }, '[Shopify Session] Starting token exchange')

    let accessToken: string
    try {
      const result = await exchangeTokenForOfflineAccess(shopDomain, sessionToken)
      accessToken = result.accessToken
      log.info({ shop: shopDomain }, '[Shopify Session] Token exchange succeeded')
    } catch (tokenErr) {
      log.error(
        { shop: shopDomain, err: tokenErr instanceof Error ? tokenErr.message : String(tokenErr) },
        '[Shopify Session] Token exchange failed'
      )
      return null
    }

    const encryptedToken = encrypt(accessToken)
    const supabase = getAdminClient()

    log.info({ shop: shopDomain }, '[Shopify Session] Upserting store into DB')
    const { data: store, error } = await supabase
      .from('stores')
      .upsert(
        {
          shop_domain: shopDomain,
          access_token_encrypted: encryptedToken,
          status: 'active',
          billing_mode: 'absorb_mode',
        },
        { onConflict: 'shop_domain' }
      )
      .select('id, shop_domain, status')
      .single()

    if (error || !store) {
      log.error(
        { shop: shopDomain, err: error?.message, code: error?.code },
        '[Shopify Session] DB upsert failed'
      )
      return null
    }

    log.info({ shop: shopDomain, store_id: store.id }, '[Shopify Session] Store upserted, ensuring API key')

    // Check if API key already exists (re-install case)
    const { data: existingKeys } = await supabase
      .from('store_api_keys')
      .select('id')
      .eq('store_id', store.id)
      .limit(1)

    if (!existingKeys || existingKeys.length === 0) {
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
      log.info({ store_id: store.id }, '[Shopify Session] API key created')
    } else {
      // Re-activate existing keys on re-install
      await supabase
        .from('store_api_keys')
        .update({ is_active: true })
        .eq('store_id', store.id)
      log.info({ store_id: store.id }, '[Shopify Session] Existing API keys re-activated')
    }

    log.info({ store_id: store.id, shop: shopDomain }, '[Shopify Session] Provisioning complete')
    return store as { id: string; shop_domain: string; status: string }
  } catch (err) {
    log.error(
      { shop: shopDomain, err: err instanceof Error ? err.message : String(err) },
      '[Shopify Session] Unexpected provisioning error'
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
  const requestId = extractRequestId(request)
  const log = createChildLogger(requestId)
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
    log.warn(
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
  log.info({ shop: shopDomain }, '[Shopify Session] Shop domain from JWT')

  let store = await lookupStoreByDomain(shopDomain, requestId)

  // Auto-provision or re-activate: with managed installation, Shopify doesn't call
  // an OAuth callback. The store is created/updated on first authenticated request.
  if (!store || store.status !== 'active') {
    if (!store) {
      log.info({ shop: shopDomain }, '[Shopify Session] Store not found, provisioning')
    } else {
      log.info({ shop: shopDomain }, '[Shopify Session] Store inactive, re-provisioning')
    }
    store = await provisionStore(shopDomain, token, requestId)
  }

  if (!store) {
    log.error({ shop: shopDomain }, '[Shopify Session] Store not found and provisioning failed')
    return {
      error: NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Store not found' } },
        { status: 404 }
      ),
    }
  }

  log.info({ shop: shopDomain, store_id: store.id }, '[Shopify Session] Authenticated')

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
      if (err instanceof MerchantOpsError) {
        const statusMap: Record<string, number> = {
          NOT_FOUND: 404,
          BAD_REQUEST: 400,
          INTERNAL_ERROR: 500,
        }
        return NextResponse.json(
          { data: null, error: { code: err.code, message: err.message } },
          { status: statusMap[err.code] ?? 500 }
        )
      }

      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        '[Shopify Session] Unhandled error in handler'
      )
      return NextResponse.json(
        { data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
        { status: 500 }
      )
    }
  }
}
