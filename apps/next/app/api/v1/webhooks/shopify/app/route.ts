import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { logger } from '../../../../../../../../packages/api/src/logger'
import { extractRequestId } from '../../../../../../../../packages/api/src/middleware/request-id'
import { cleanupStore } from '../../../../../../../../packages/api/src/services/store-cleanup'
import { verifyShopifyHmac } from '../../../../../../../../packages/api/src/utils/shopify-hmac'

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceKey)
}

export async function POST(request: Request) {
  const requestId = extractRequestId(request)

  // Verify HMAC signature
  const shopifySecret = process.env.SHOPIFY_API_SECRET
  if (!shopifySecret) {
    logger.error({ request_id: requestId }, '[Webhook] SHOPIFY_API_SECRET not configured')
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'Webhook verification not configured' } },
      { status: 500 },
    )
  }

  // Clone request since body can only be read once
  const clonedRequest = request.clone()
  const isValid = await verifyShopifyHmac(clonedRequest, shopifySecret)
  if (!isValid) {
    logger.warn({ request_id: requestId }, '[Webhook] HMAC verification failed')
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_API_KEY', message: 'Invalid webhook signature' } },
      { status: 401 },
    )
  }

  // Parse webhook topic
  const topic = request.headers.get('X-Shopify-Topic')
  if (topic !== 'app/uninstalled') {
    logger.info({ request_id: requestId, topic }, '[Webhook] Unhandled topic')
    return NextResponse.json({ data: { acknowledged: true }, error: null })
  }

  // Parse shop domain from body
  const body = await request.json()
  const shopDomain = body?.myshopify_domain || body?.domain

  if (!shopDomain) {
    logger.error({ request_id: requestId }, '[Webhook] Missing shop domain in payload')
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Missing shop domain' } },
      { status: 400 },
    )
  }

  logger.info({ request_id: requestId, shop: shopDomain, topic }, '[Webhook] Processing app/uninstalled')

  // Look up store by shop domain
  const supabase = getAdminSupabase()
  const { data: store } = await supabase
    .from('stores')
    .select('id, status')
    .eq('shop_domain', shopDomain)
    .single()

  if (!store) {
    logger.warn({ request_id: requestId, shop: shopDomain }, '[Webhook] Store not found for domain')
    return NextResponse.json({ data: { acknowledged: true }, error: null })
  }

  // Run cleanup
  const result = await cleanupStore(store.id, requestId)

  logger.info({ request_id: requestId, result }, '[Webhook] Uninstall cleanup complete')

  return NextResponse.json({ data: { acknowledged: true, cleanup: result }, error: null })
}
