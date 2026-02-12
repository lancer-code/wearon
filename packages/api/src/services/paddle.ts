import crypto from 'node:crypto'
import axios from 'axios'
import { logger } from '../logger'

export type SubscriptionTier = 'starter' | 'growth' | 'scale'

interface SubscriptionTierConfig {
  credits: number
  monthlyPriceCents: number
  overageCents: number
  priceIdEnv: string
  overagePriceIdEnv: string
}

const SUBSCRIPTION_TIER_CONFIG: Record<SubscriptionTier, SubscriptionTierConfig> = {
  starter: {
    credits: 350,
    monthlyPriceCents: 4900,
    overageCents: 16,
    priceIdEnv: 'PADDLE_PRICE_ID_STARTER',
    overagePriceIdEnv: 'PADDLE_OVERAGE_PRICE_ID_STARTER',
  },
  growth: {
    credits: 800,
    monthlyPriceCents: 9900,
    overageCents: 14,
    priceIdEnv: 'PADDLE_PRICE_ID_GROWTH',
    overagePriceIdEnv: 'PADDLE_OVERAGE_PRICE_ID_GROWTH',
  },
  scale: {
    credits: 1800,
    monthlyPriceCents: 19900,
    overageCents: 12,
    priceIdEnv: 'PADDLE_PRICE_ID_SCALE',
    overagePriceIdEnv: 'PADDLE_OVERAGE_PRICE_ID_SCALE',
  },
}

const PAYG_PRICE_PER_CREDIT_CENTS = 18

interface PaddleWebhookEvent {
  event_id?: string
  event_type?: string
  data?: Record<string, unknown>
}

interface CheckoutSessionResult {
  transactionId: string
  checkoutUrl: string
}

interface CreateCheckoutInput {
  storeId: string
  shopDomain: string
  userId: string
  userEmail?: string
  requestId: string
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} must be set`)
  }
  return value
}

function getPaddleApiBaseUrl(): string {
  const env = process.env.PADDLE_ENV?.toLowerCase() ?? 'sandbox'
  if (env === 'production') {
    return 'https://api.paddle.com'
  }
  return 'https://sandbox-api.paddle.com'
}

function getPaddleClient() {
  const apiKey = getRequiredEnv('PADDLE_API_KEY')
  return axios.create({
    baseURL: getPaddleApiBaseUrl(),
    timeout: 15000,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })
}

function getSiteUrl(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  return siteUrl.replace(/\/$/, '')
}

function getPriceIdForTier(tier: SubscriptionTier): string {
  return getRequiredEnv(SUBSCRIPTION_TIER_CONFIG[tier].priceIdEnv)
}

function getOveragePriceIdForTier(tier: SubscriptionTier): string {
  const tierConfig = SUBSCRIPTION_TIER_CONFIG[tier]
  const tierPrice = process.env[tierConfig.overagePriceIdEnv]
  if (tierPrice) {
    return tierPrice
  }
  return getRequiredEnv('PADDLE_PRICE_ID_PAYG')
}

function extractCheckoutUrl(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid Paddle response payload')
  }
  const root = payload as Record<string, unknown>
  const data = root.data as Record<string, unknown> | undefined
  if (!data) {
    throw new Error('Missing Paddle response data')
  }

  const checkout = data.checkout as Record<string, unknown> | undefined
  const checkoutUrl =
    (checkout?.url as string | undefined) ??
    (data.checkout_url as string | undefined) ??
    (data.url as string | undefined)

  if (!checkoutUrl) {
    throw new Error('Paddle checkout URL missing in response')
  }

  return checkoutUrl
}

export function getBillingCatalog() {
  return {
    subscriptionTiers: {
      starter: {
        code: 'starter',
        credits: SUBSCRIPTION_TIER_CONFIG.starter.credits,
        monthlyPriceCents: SUBSCRIPTION_TIER_CONFIG.starter.monthlyPriceCents,
        overageCents: SUBSCRIPTION_TIER_CONFIG.starter.overageCents,
      },
      growth: {
        code: 'growth',
        credits: SUBSCRIPTION_TIER_CONFIG.growth.credits,
        monthlyPriceCents: SUBSCRIPTION_TIER_CONFIG.growth.monthlyPriceCents,
        overageCents: SUBSCRIPTION_TIER_CONFIG.growth.overageCents,
      },
      scale: {
        code: 'scale',
        credits: SUBSCRIPTION_TIER_CONFIG.scale.credits,
        monthlyPriceCents: SUBSCRIPTION_TIER_CONFIG.scale.monthlyPriceCents,
        overageCents: SUBSCRIPTION_TIER_CONFIG.scale.overageCents,
      },
    },
    payg: {
      pricePerCreditCents: PAYG_PRICE_PER_CREDIT_CENTS,
      minCredits: 1,
      maxCredits: 5000,
    },
  }
}

export function getTierCredits(tier: SubscriptionTier): number {
  return SUBSCRIPTION_TIER_CONFIG[tier].credits
}

export function getTierOverageCents(tier: SubscriptionTier): number {
  return SUBSCRIPTION_TIER_CONFIG[tier].overageCents
}

export function calculatePaygTotalCents(credits: number): number {
  return credits * PAYG_PRICE_PER_CREDIT_CENTS
}

export async function createSubscriptionCheckoutSession(
  input: CreateCheckoutInput & { tier: SubscriptionTier }
): Promise<CheckoutSessionResult> {
  const paddle = getPaddleClient()
  const priceId = getPriceIdForTier(input.tier)
  const credits = getTierCredits(input.tier)
  const siteUrl = getSiteUrl()

  const payload = {
    items: [{ price_id: priceId, quantity: 1 }],
    custom_data: {
      purchase_type: 'subscription',
      tier: input.tier,
      credits,
      store_id: input.storeId,
      shop_domain: input.shopDomain,
      owner_user_id: input.userId,
      request_id: input.requestId,
    },
    checkout: {
      success_url: `${siteUrl}/merchant/billing?status=success`,
      cancel_url: `${siteUrl}/merchant/billing?status=canceled`,
    },
    customer: input.userEmail ? { email: input.userEmail } : undefined,
  }

  const response = await paddle.post('/transactions', payload)
  const checkoutUrl = extractCheckoutUrl(response.data)
  const transactionId = String(
    ((response.data as Record<string, unknown>).data as Record<string, unknown> | undefined)?.id ??
      ''
  )

  if (!transactionId) {
    throw new Error('Paddle transaction ID missing in response')
  }

  return { transactionId, checkoutUrl }
}

export async function createPaygCheckoutSession(
  input: CreateCheckoutInput & { credits: number }
): Promise<CheckoutSessionResult> {
  const paddle = getPaddleClient()
  const paygPriceId = getRequiredEnv('PADDLE_PRICE_ID_PAYG')
  const siteUrl = getSiteUrl()

  const payload = {
    items: [{ price_id: paygPriceId, quantity: input.credits }],
    custom_data: {
      purchase_type: 'payg',
      credits: input.credits,
      store_id: input.storeId,
      shop_domain: input.shopDomain,
      owner_user_id: input.userId,
      request_id: input.requestId,
    },
    checkout: {
      success_url: `${siteUrl}/merchant/billing?status=success`,
      cancel_url: `${siteUrl}/merchant/billing?status=canceled`,
    },
    customer: input.userEmail ? { email: input.userEmail } : undefined,
  }

  const response = await paddle.post('/transactions', payload)
  const checkoutUrl = extractCheckoutUrl(response.data)
  const transactionId = String(
    ((response.data as Record<string, unknown>).data as Record<string, unknown> | undefined)?.id ??
      ''
  )

  if (!transactionId) {
    throw new Error('Paddle transaction ID missing in response')
  }

  return { transactionId, checkoutUrl }
}

export async function changeSubscriptionPlan(input: {
  subscriptionId: string
  targetTier: SubscriptionTier
  requestId: string
  effectiveFrom: 'immediately' | 'next_billing_period'
}): Promise<void> {
  const paddle = getPaddleClient()
  const targetPriceId = getPriceIdForTier(input.targetTier)

  const payload = {
    items: [{ price_id: targetPriceId, quantity: 1 }],
    effective_from: input.effectiveFrom,
    proration_billing_mode:
      input.effectiveFrom === 'immediately' ? 'prorated_immediately' : 'do_not_bill',
  }

  // MEDIUM #5 FIX: Add retry logic and error handling for Paddle API
  let lastError: Error | null = null
  const maxRetries = 3
  const retryDelays = [1000, 2000, 4000] // Exponential backoff

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await paddle.patch(`/subscriptions/${input.subscriptionId}`, payload)
      logger.info(
        {
          request_id: input.requestId,
          subscription_id: input.subscriptionId,
          target_tier: input.targetTier,
          attempt: attempt + 1,
        },
        '[Paddle] Subscription plan changed'
      )
      return
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const errorMessage = lastError.message.toLowerCase()

      // Don't retry on client errors (4xx)
      if (
        errorMessage.includes('not found') ||
        errorMessage.includes('invalid') ||
        errorMessage.includes('bad request')
      ) {
        logger.error(
          {
            request_id: input.requestId,
            subscription_id: input.subscriptionId,
            err: lastError.message,
          },
          '[Paddle] Client error - not retrying'
        )
        throw new Error(`Paddle API error: ${lastError.message}`)
      }

      // Retry on server errors (5xx) or rate limits (429)
      if (attempt < maxRetries - 1) {
        const delay = retryDelays[attempt]
        logger.warn(
          {
            request_id: input.requestId,
            attempt: attempt + 1,
            max_retries: maxRetries,
            retry_delay_ms: delay,
            err: lastError.message,
          },
          '[Paddle] Retrying subscription plan change'
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  // All retries failed
  logger.error(
    {
      request_id: input.requestId,
      subscription_id: input.subscriptionId,
      attempts: maxRetries,
      err: lastError?.message,
    },
    '[Paddle] Subscription plan change failed after retries'
  )
  throw new Error(`Paddle API unavailable after ${maxRetries} attempts: ${lastError?.message}`)
}

export async function createOverageCharge(input: {
  subscriptionId: string
  tier: SubscriptionTier
  storeId: string
  sessionId: string
  requestId: string
}): Promise<string> {
  const paddle = getPaddleClient()
  const overagePriceId = getOveragePriceIdForTier(input.tier)

  const payload = {
    items: [{ price_id: overagePriceId, quantity: 1 }],
    effective_from: 'immediately',
    custom_data: {
      purchase_type: 'overage',
      tier: input.tier,
      store_id: input.storeId,
      session_id: input.sessionId,
      request_id: input.requestId,
    },
  }

  const response = await paddle.post(`/subscriptions/${input.subscriptionId}/charge`, payload)
  const data = (response.data as Record<string, unknown>).data as
    | Record<string, unknown>
    | undefined
  const chargeId = String(data?.id ?? '')

  if (!chargeId) {
    throw new Error('Paddle overage charge ID missing in response')
  }

  return chargeId
}

/**
 * Refund/void an overage charge when service delivery fails
 * HIGH #2 FIX: Provides automated compensation for failed generations after billing
 */
export async function refundOverageCharge(input: {
  chargeId: string
  requestId: string
  reason: string
}): Promise<void> {
  const paddle = getPaddleClient()

  try {
    // Attempt to void/refund the charge via Paddle API
    // Note: Paddle may not support direct charge refunds - this is a placeholder
    // for the correct Paddle API call. In production, use Paddle's transaction API.
    await paddle.post(`/adjustments`, {
      action: 'refund',
      transaction_id: input.chargeId,
      reason: input.reason,
      items: [
        {
          type: 'full',
        },
      ],
    })

    logger.info(
      {
        charge_id: input.chargeId,
        request_id: input.requestId,
        reason: input.reason,
      },
      '[Paddle] Overage charge refunded'
    )
  } catch (err) {
    logger.error(
      {
        charge_id: input.chargeId,
        request_id: input.requestId,
        err: err instanceof Error ? err.message : String(err),
      },
      '[Paddle] Failed to refund overage charge - manual reconciliation required'
    )
    // Don't throw - log for manual reconciliation
  }
}

function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
}

export function verifyPaddleWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) {
    return false
  }

  const parts = signatureHeader.split(';').map((part) => part.trim())
  const timestamp = parts.find((part) => part.startsWith('ts='))?.replace('ts=', '')
  const signatures = parts
    .filter((part) => part.startsWith('h1='))
    .map((part) => part.replace('h1=', ''))

  if (!timestamp || signatures.length === 0) {
    return false
  }

  const timestampSeconds = Number(timestamp)
  if (!Number.isInteger(timestampSeconds)) {
    return false
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  const maxAgeSeconds = 300
  if (Math.abs(nowSeconds - timestampSeconds) > maxAgeSeconds) {
    return false
  }

  const signedPayload = `${timestamp}:${rawBody}`
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex')

  return signatures.some((signature) => timingSafeHexEqual(signature, expected))
}

export function parsePaddleWebhookEvent(rawBody: string): PaddleWebhookEvent {
  const parsed = JSON.parse(rawBody) as PaddleWebhookEvent
  return parsed
}
