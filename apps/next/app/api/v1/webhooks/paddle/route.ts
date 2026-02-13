import { createClient } from '@supabase/supabase-js'
import { addStoreCredits } from '@api/services/b2b-credits'
import {
  getTierCredits,
  type SubscriptionTier,
  parsePaddleWebhookEvent,
  verifyPaddleWebhookSignature,
} from '@api/services/paddle'
import { logger } from '@api/logger'
import { extractRequestId } from '@api/middleware/request-id'

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

  // Update store subscription metadata
  if (Object.keys(updatePayload).length > 0) {
    const { error: updateError } = await supabase.from('stores').update(updatePayload).eq('id', storeId)

    if (updateError) {
      logger.error(
        { request_id: requestId, store_id: storeId, err: updateError.message },
        '[Paddle Webhook] Failed to update store subscription metadata',
      )
      throw new Error(`Store subscription update failed: ${updateError.message}`)
    }
  }

  // AC #3: Grant recurring tier credits on subscription renewal/activation
  // Renewal events: subscription.updated with status=active and subscription.activated
  const isRenewalEvent =
    (eventType === 'subscription.updated' && subscriptionStatus === 'active') ||
    eventType === 'subscription.activated'

  if (isRenewalEvent) {
    // Get store's subscription tier to determine credit amount
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('subscription_tier')
      .eq('id', storeId)
      .single()

    if (storeError || !store) {
      logger.error(
        { request_id: requestId, store_id: storeId, err: storeError?.message },
        '[Paddle Webhook] Failed to fetch store tier for renewal credit grant',
      )
      throw new Error('Store lookup failed for renewal crediting')
    }

    const tier = store.subscription_tier as SubscriptionTier | null
    if (tier) {
      const credits = getTierCredits(tier)
      const creditResult = await addStoreCredits({
        storeId,
        amount: credits,
        description: `Subscription renewal: ${tier} tier monthly credits`,
        requestId,
      })

      if (!creditResult.success) {
        logger.error(
          { request_id: requestId, store_id: storeId, tier, credits },
          '[Paddle Webhook] Failed to grant renewal credits',
        )
        throw new Error(`Renewal credit grant failed: ${creditResult.error}`)
      }

      logger.info(
        { request_id: requestId, store_id: storeId, tier, credits },
        '[Paddle Webhook] Renewal credits granted',
      )
    } else {
      logger.warn(
        { request_id: requestId, store_id: storeId },
        '[Paddle Webhook] Renewal event but no subscription tier found',
      )
    }
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
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid webhook signature' } },
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

  // CRITICAL FIX: Check for duplicate BEFORE processing (idempotency guard)
  const { data: existingEvent } = await supabase
    .from('billing_webhook_events')
    .select('event_id')
    .eq('event_id', eventId)
    .single()

  if (existingEvent) {
    logger.info({ request_id: requestId, event_id: eventId }, '[Paddle Webhook] Duplicate event ignored')
    return Response.json({ data: { acknowledged: true, duplicate: true }, error: null })
  }

  // Process business logic BEFORE persisting audit row
  try {
    if (eventType === 'transaction.completed') {
      await handleTransactionCompleted({ supabase, requestId, data })
    } else if (eventType.startsWith('subscription.')) {
      await handleSubscriptionEvent({ supabase, requestId, eventType, data })
    } else {
      logger.info({ request_id: requestId, event_type: eventType }, '[Paddle Webhook] Event acknowledged')
    }
  } catch (err) {
    // Processing failed - DO NOT insert audit row so webhook can be retried
    logger.error({ request_id: requestId, event_id: eventId, err }, '[Paddle Webhook] Processing failed, will retry')
    return Response.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'Webhook processing failed' } },
      { status: 500 },
    )
  }

  // Only persist audit row AFTER successful processing
  const { error: insertError } = await supabase.from('billing_webhook_events').insert({
    provider: 'paddle',
    event_id: eventId,
    event_type: eventType,
    request_id: requestId,
    store_id: candidateStoreId,
    payload: event,
  })

  if (insertError) {
    // Audit persistence failed but processing succeeded - log but acknowledge webhook
    // Next retry will be caught by duplicate check above
    logger.error(
      { request_id: requestId, event_id: eventId, err: insertError.message },
      '[Paddle Webhook] Audit insert failed after successful processing (non-fatal)',
    )
  }

  return Response.json({ data: { acknowledged: true }, error: null })
}
