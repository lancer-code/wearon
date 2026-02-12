import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { logger } from '../../../../../../../../packages/api/src/logger'
import { extractRequestId } from '../../../../../../../../packages/api/src/middleware/request-id'
import { verifyShopifyHmac } from '../../../../../../../../packages/api/src/utils/shopify-hmac'

const SHOPIFY_ORDER_TOPIC = 'orders/create'
const DEFAULT_CURRENCY = 'USD'

type TransferStatus = 'processed' | 'duplicate' | 'insufficient'

type TransferResultRow = {
  status: TransferStatus
  purchase_id: string | null
  store_id: string
  shopper_email: string
  shopify_order_id: string
  credits_purchased: number
  amount_paid: number
  currency: string
}

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }

  return createClient(supabaseUrl, serviceKey)
}

function safeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function normalizeShopifyNumericId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value))
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const match = trimmed.match(/(\d+)$/)
  return match?.[1] || null
}

function safePositiveInteger(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0
  }
  return Math.floor(parsed)
}

function safeNonNegativeNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }
  return parsed
}

function toShopperEmailHash(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase(), 'utf8').digest('hex').slice(0, 12)
}

function getShopDomain(headers: Headers, payload: Record<string, unknown>): string | null {
  const fromHeader =
    safeString(headers.get('X-Shopify-Shop-Domain')) ||
    safeString(headers.get('x-shopify-shop-domain'))

  if (fromHeader) {
    return fromHeader
  }

  return safeString(payload.myshopify_domain) || safeString(payload.domain)
}

function calculateCreditPurchase(input: {
  lineItems: unknown[]
  shopifyProductId: string
}): { creditsPurchased: number; amountPaid: number } {
  let creditsPurchased = 0
  let amountPaid = 0

  for (const lineItem of input.lineItems) {
    if (!lineItem || typeof lineItem !== 'object') {
      continue
    }

    const item = lineItem as Record<string, unknown>
    const lineProductId = normalizeShopifyNumericId(item.product_id)
    if (lineProductId !== input.shopifyProductId) {
      continue
    }

    const quantity = safePositiveInteger(item.quantity)
    if (quantity === 0) {
      continue
    }

    const unitPrice = safeNonNegativeNumber(item.price)
    creditsPurchased += quantity
    amountPaid += unitPrice * quantity
  }

  return {
    creditsPurchased,
    amountPaid: Number(amountPaid.toFixed(2)),
  }
}

function acknowledgedResponse(data: Record<string, unknown> = {}) {
  return Response.json({ data: { acknowledged: true, ...data }, error: null })
}

export async function POST(request: Request) {
  const requestId = extractRequestId(request)
  const shopifySecret = process.env.SHOPIFY_API_SECRET

  if (!shopifySecret) {
    logger.error({ request_id: requestId }, '[Shopify Orders Webhook] SHOPIFY_API_SECRET not configured')
    return Response.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'Webhook verification not configured' } },
      { status: 500 },
    )
  }

  const isValid = await verifyShopifyHmac(request.clone(), shopifySecret)
  if (!isValid) {
    logger.warn({ request_id: requestId }, '[Shopify Orders Webhook] HMAC verification failed')
    return Response.json(
      { data: null, error: { code: 'INVALID_API_KEY', message: 'Invalid webhook signature' } },
      { status: 401 },
    )
  }

  const topic = request.headers.get('X-Shopify-Topic')
  if (topic !== SHOPIFY_ORDER_TOPIC) {
    logger.info({ request_id: requestId, topic }, '[Shopify Orders Webhook] Ignoring unsupported topic')
    return acknowledgedResponse({ ignored: 'unsupported_topic' })
  }

  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch (error) {
    logger.error({ request_id: requestId, err: error }, '[Shopify Orders Webhook] Invalid JSON payload')
    return acknowledgedResponse({ ignored: 'invalid_payload' })
  }

  const shopDomain = getShopDomain(request.headers, payload)
  if (!shopDomain) {
    logger.warn({ request_id: requestId }, '[Shopify Orders Webhook] Missing shop domain')
    return acknowledgedResponse({ ignored: 'missing_shop_domain' })
  }

  const orderId = normalizeShopifyNumericId(payload.id)
  if (!orderId) {
    logger.warn({ request_id: requestId, shop: shopDomain }, '[Shopify Orders Webhook] Missing order id')
    return acknowledgedResponse({ ignored: 'missing_order_id' })
  }

  const customer = (payload.customer as Record<string, unknown> | undefined) ?? {}
  const shopperEmail = safeString(customer.email) || safeString(payload.email)
  if (!shopperEmail) {
    logger.warn(
      { request_id: requestId, shop: shopDomain, order_id: orderId },
      '[Shopify Orders Webhook] Missing shopper email',
    )
    return acknowledgedResponse({ ignored: 'missing_shopper_email' })
  }

  const shopperEmailHash = toShopperEmailHash(shopperEmail)
  const supabase = getAdminSupabase()

  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, shop_domain, billing_mode, shopify_product_id')
    .eq('shop_domain', shopDomain)
    .single()

  if (storeError || !store) {
    logger.warn(
      { request_id: requestId, shop: shopDomain, order_id: orderId, err: storeError?.message },
      '[Shopify Orders Webhook] Store not found',
    )
    return acknowledgedResponse({ ignored: 'unknown_store' })
  }

  if (store.billing_mode !== 'resell_mode') {
    logger.info(
      { request_id: requestId, store_id: store.id, order_id: orderId },
      '[Shopify Orders Webhook] Ignoring order for non-resell store',
    )
    return acknowledgedResponse({ ignored: 'store_not_in_resell_mode' })
  }

  const creditProductId = normalizeShopifyNumericId(store.shopify_product_id)
  if (!creditProductId) {
    logger.warn(
      { request_id: requestId, store_id: store.id, order_id: orderId },
      '[Shopify Orders Webhook] Store missing Shopify credit product id',
    )
    return acknowledgedResponse({ ignored: 'missing_credit_product_id' })
  }

  const lineItems = Array.isArray(payload.line_items) ? payload.line_items : []
  const creditPurchase = calculateCreditPurchase({
    lineItems,
    shopifyProductId: creditProductId,
  })

  if (creditPurchase.creditsPurchased === 0) {
    return acknowledgedResponse({ ignored: 'non_credit_order' })
  }

  const currency = safeString(payload.currency) || DEFAULT_CURRENCY

  const { data: existingPurchase, error: existingPurchaseError } = await supabase
    .from('store_shopper_purchases')
    .select('id, store_id, shopper_email, shopify_order_id, credits_purchased, amount_paid, currency')
    .eq('shopify_order_id', orderId)
    .single()

  if (existingPurchase) {
    logger.info(
      { request_id: requestId, store_id: store.id, order_id: orderId, shopper_email_hash: shopperEmailHash },
      '[Shopify Orders Webhook] Duplicate webhook ignored (existing purchase found)',
    )
    return acknowledgedResponse({
      duplicate: true,
      purchase: existingPurchase,
    })
  }

  if (existingPurchaseError && existingPurchaseError.code !== 'PGRST116') {
    logger.error(
      { request_id: requestId, store_id: store.id, order_id: orderId, err: existingPurchaseError.message },
      '[Shopify Orders Webhook] Failed to check idempotency',
    )
    return acknowledgedResponse({ processing_error: true })
  }

  const { data: transferRows, error: transferError } = await supabase.rpc('process_store_shopper_purchase', {
    p_store_id: store.id,
    p_shopper_email: shopperEmail,
    p_shopify_order_id: orderId,
    p_credits_purchased: creditPurchase.creditsPurchased,
    p_amount_paid: creditPurchase.amountPaid,
    p_currency: currency,
    p_request_id: requestId,
  })

  if (transferError) {
    logger.error(
      { request_id: requestId, store_id: store.id, order_id: orderId, err: transferError.message },
      '[Shopify Orders Webhook] Credit transfer RPC failed',
    )
    return acknowledgedResponse({ processing_error: true })
  }

  const transferRow = Array.isArray(transferRows) ? (transferRows[0] as TransferResultRow | undefined) : undefined
  if (!transferRow) {
    logger.error(
      { request_id: requestId, store_id: store.id, order_id: orderId },
      '[Shopify Orders Webhook] Credit transfer RPC returned no rows',
    )
    return acknowledgedResponse({ processing_error: true })
  }

  if (transferRow.status === 'insufficient') {
    const { error: analyticsError } = await supabase.from('store_analytics_events').insert({
      store_id: store.id,
      event_type: 'store_credit_insufficient',
      shopper_email: shopperEmail,
      metadata: {
        credits_required: creditPurchase.creditsPurchased,
        shopify_order_id: orderId,
        request_id: requestId,
      },
    })

    if (analyticsError) {
      logger.error(
        {
          request_id: requestId,
          store_id: store.id,
          order_id: orderId,
          err: analyticsError.message,
        },
        '[Shopify Orders Webhook] Failed to record insufficient-credit analytics event',
      )
    }

    logger.warn(
      { request_id: requestId, store_id: store.id, order_id: orderId, shopper_email_hash: shopperEmailHash },
      '[Shopify Orders Webhook] Insufficient store credits for shopper purchase',
    )

    return acknowledgedResponse({
      insufficient_credits: true,
      credits_required: creditPurchase.creditsPurchased,
    })
  }

  if (transferRow.status === 'duplicate') {
    return acknowledgedResponse({
      duplicate: true,
      purchase: transferRow,
    })
  }

  logger.info(
    {
      request_id: requestId,
      store_id: store.id,
      order_id: orderId,
      shopper_email_hash: shopperEmailHash,
      credits_purchased: transferRow.credits_purchased,
    },
    '[Shopify Orders Webhook] Shopper credits transferred',
  )

  return acknowledgedResponse({
    purchase: transferRow,
  })
}
