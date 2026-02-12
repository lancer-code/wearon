import { createClient } from '@supabase/supabase-js'
import { addStoreCredits } from '../../../../../../../packages/api/src/services/b2b-credits'
import {
  getTierCredits,
  parsePaddleWebhookEvent,
  verifyPaddleWebhookSignature,
} from '../../../../../../../packages/api/src/services/paddle'
import { logger } from '../../../../../../../packages/api/src/logger'
import { extractRequestId } from '../../../../../../../packages/api/src/middleware/request-id'

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }

  return createClient(supabaseUrl, serviceKey)
}

function safeString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function resolveSubscriptionStatus(eventType: string, data: Record<string, unknown>): string | null {
  const explicitStatus = safeString(data.status)
  if (explicitStatus) {
    return explicitStatus
  }

  if (eventType === 'subscription.activated' || eventType === 'subscription.resumed') {
    return 'active'
  }
  if (eventType === 'subscription.past_due') {
    return 'past_due'
  }
  if (eventType === 'subscription.paused') {
    return 'paused'
  }
  if (eventType === 'subscription.canceled') {
    return 'canceled'
  }

  return null
}

async function resolveStoreIdForEvent(
  supabase: ReturnType<typeof getAdminSupabase>,
  data: Record<string, unknown>,
  customData: Record<string, unknown>,
): Promise<string | null> {
  const directStoreId = safeString(customData.store_id)
  if (directStoreId) {
    return directStoreId
  }

  const directSubscriptionId =
    safeString(data.subscription_id) ??
    safeString((data.subscription as Record<string, unknown> | undefined)?.id) ??
    safeString(data.id)

  if (!directSubscriptionId) {
    return null
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('subscription_id', directSubscriptionId)
    .single()

  return (store?.id as string | undefined) ?? null
}

async function handleTransactionCompleted(input: {
  supabase: ReturnType<typeof getAdminSupabase>
  requestId: string
  data: Record<string, unknown>
}): Promise<void> {
  const { supabase, requestId, data } = input
  const customData = (data.custom_data as Record<string, unknown> | undefined) ?? {}

  const purchaseType = safeString(customData.purchase_type)
  const storeId = await resolveStoreIdForEvent(supabase, data, customData)
  const subscriptionId =
    safeString(data.subscription_id) ??
    safeString((data.subscription as Record<string, unknown> | undefined)?.id)
  const paddleCustomerId =
    safeString(data.customer_id) ?? safeString((data.customer as Record<string, unknown> | undefined)?.id)

  if (!purchaseType) {
    logger.info({ request_id: requestId }, '[Paddle Webhook] transaction.completed without purchase_type')
    return
  }

  if (!storeId) {
    logger.warn(
      { request_id: requestId, purchase_type: purchaseType },
      '[Paddle Webhook] Could not resolve store_id',
    )
    return
  }

  if (purchaseType === 'subscription') {
    const rawTier = safeString(customData.tier)
    const tier = rawTier === 'starter' || rawTier === 'growth' || rawTier === 'scale' ? rawTier : null
    const creditsFromPayload = Number(customData.credits)
    const credits = Number.isFinite(creditsFromPayload) && creditsFromPayload > 0
      ? creditsFromPayload
      : tier
        ? getTierCredits(tier)
        : 0

    if (tier) {
      await supabase
        .from('stores')
        .update({
          subscription_tier: tier,
          subscription_id: subscriptionId,
          paddle_customer_id: paddleCustomerId,
          subscription_status: 'active',
        })
        .eq('id', storeId)
    }

    if (credits > 0) {
      await addStoreCredits(
        storeId,
        credits,
        'subscription',
        requestId,
        `Paddle subscription top-up (${tier ?? 'unknown_tier'})`,
      )
    }
    return
  }

  if (purchaseType === 'payg') {
    const creditsFromPayload = Number(customData.credits)
    if (!Number.isFinite(creditsFromPayload) || creditsFromPayload <= 0) {
      logger.warn(
        { request_id: requestId, store_id: storeId },
        '[Paddle Webhook] Invalid PAYG credits in payload',
      )
      return
    }

    await addStoreCredits(
      storeId,
      creditsFromPayload,
      'purchase',
      requestId,
      `Paddle PAYG purchase (${creditsFromPayload} credits)`,
    )
    return
  }

  if (purchaseType === 'overage') {
    logger.info({ request_id: requestId, store_id: storeId }, '[Paddle Webhook] Overage transaction acknowledged')
    return
  }

  logger.info(
    { request_id: requestId, purchase_type: purchaseType },
    '[Paddle Webhook] Unsupported purchase_type',
  )
}

async function handleSubscriptionEvent(input: {
  supabase: ReturnType<typeof getAdminSupabase>
  requestId: string
  eventType: string
  data: Record<string, unknown>
}): Promise<void> {
  const { supabase, requestId, eventType, data } = input
  const customData = (data.custom_data as Record<string, unknown> | undefined) ?? {}

  const storeId = await resolveStoreIdForEvent(supabase, data, customData)
  if (!storeId) {
    logger.warn({ request_id: requestId, event_type: eventType }, '[Paddle Webhook] Could not resolve store')
    return
  }

  const subscriptionStatus = resolveSubscriptionStatus(eventType, data)
  const currentPeriodEnd = safeString(
    (data.current_billing_period as Record<string, unknown> | undefined)?.ends_at,
  )

  const updatePayload: Record<string, unknown> = {}
  if (subscriptionStatus) {
    updatePayload.subscription_status = subscriptionStatus
  }
  if (currentPeriodEnd) {
    updatePayload.subscription_current_period_end = currentPeriodEnd
  }

  if (Object.keys(updatePayload).length > 0) {
    await supabase.from('stores').update(updatePayload).eq('id', storeId)
  }
}

export async function POST(request: Request) {
  const requestId = extractRequestId(request)
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET

  if (!webhookSecret) {
    logger.error({ request_id: requestId }, '[Paddle Webhook] Secret not configured')
    return Response.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'Webhook secret not configured' } },
      { status: 500 },
    )
  }

  const rawBody = await request.text()
  const signatureHeader = request.headers.get('Paddle-Signature')
  const isValid = verifyPaddleWebhookSignature(rawBody, signatureHeader, webhookSecret)

  if (!isValid) {
    logger.warn({ request_id: requestId }, '[Paddle Webhook] Signature verification failed')
    return Response.json(
      { data: null, error: { code: 'INVALID_API_KEY', message: 'Invalid webhook signature' } },
      { status: 401 },
    )
  }

  let event: { event_id?: string; event_type?: string; data?: Record<string, unknown> }
  try {
    event = parsePaddleWebhookEvent(rawBody)
  } catch (err) {
    logger.error({ request_id: requestId, err }, '[Paddle Webhook] Invalid JSON payload')
    return Response.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON payload' } },
      { status: 400 },
    )
  }

  const eventId = safeString(event.event_id)
  const eventType = safeString(event.event_type)
  const data = (event.data ?? {}) as Record<string, unknown>

  if (!eventId || !eventType) {
    return Response.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Missing event_id or event_type' } },
      { status: 400 },
    )
  }

  const supabase = getAdminSupabase()
  const customData = (data.custom_data as Record<string, unknown> | undefined) ?? {}
  const candidateStoreId = safeString(customData.store_id)

  const { error: insertError } = await supabase.from('billing_webhook_events').insert({
    provider: 'paddle',
    event_id: eventId,
    event_type: eventType,
    request_id: requestId,
    store_id: candidateStoreId,
    payload: event,
  })

  if (insertError) {
    const isDuplicate = (insertError as { code?: string }).code === '23505'
    if (isDuplicate) {
      logger.info({ request_id: requestId, event_id: eventId }, '[Paddle Webhook] Duplicate event ignored')
      return Response.json({ data: { acknowledged: true, duplicate: true }, error: null })
    }

    logger.error(
      { request_id: requestId, event_id: eventId, err: insertError.message },
      '[Paddle Webhook] Failed to persist event audit record',
    )
    return Response.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'Failed to persist webhook event' } },
      { status: 500 },
    )
  }

  try {
    if (eventType === 'transaction.completed') {
      await handleTransactionCompleted({ supabase, requestId, data })
    } else if (eventType.startsWith('subscription.')) {
      await handleSubscriptionEvent({ supabase, requestId, eventType, data })
    } else {
      logger.info({ request_id: requestId, event_type: eventType }, '[Paddle Webhook] Event acknowledged')
    }
  } catch (err) {
    logger.error({ request_id: requestId, event_id: eventId, err }, '[Paddle Webhook] Processing failed')
    return Response.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'Webhook processing failed' } },
      { status: 500 },
    )
  }

  return Response.json({ data: { acknowledged: true }, error: null })
}
