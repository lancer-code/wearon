import crypto from 'node:crypto'
import { withB2BAuth } from '../../../../../../../packages/api/src/middleware/b2b'
import { createChildLogger } from '../../../../../../../packages/api/src/logger'
import {
  deductStoreCredit,
  deductStoreShopperCredit,
  getStoreBillingProfile,
  logStoreOverage,
  refundStoreCredit,
  refundStoreShopperCredit,
} from '../../../../../../../packages/api/src/services/b2b-credits'
import {
  createOverageCharge,
  getTierOverageCents,
} from '../../../../../../../packages/api/src/services/paddle'
import { pushGenerationTask } from '../../../../../../../packages/api/src/services/redis-queue'
import { getStoreUploadPath } from '../../../../../../../packages/api/src/services/b2b-storage'
import {
  successResponse,
  errorResponse,
} from '../../../../../../../packages/api/src/utils/b2b-response'
import { TASK_PAYLOAD_VERSION } from '../../../../../../../packages/api/src/types/queue'
import type { GenerationTaskPayload } from '../../../../../../../packages/api/src/types/queue'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_B2B_PROMPT = `Virtual try-on: Using the provided images:
- First image: Model (person to dress)
- Second image (if provided): Outfit/clothes
- Additional images (if provided): Accessories

Generate a single portrait photo of the model wearing all provided items.

Requirements:
- Preserve the model's exact face, skin tone, hair, body
- Natural clothing fit with realistic draping
- Place accessories correctly (watch→wrist, necklace→neck, hat→head)
- Professional fashion photography, natural lighting
- Output ONE portrait (3:4 ratio)`

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

function canDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function isStoreScopedUploadUrl(imageUrl: string, storeId: string): boolean {
  const expectedPrefix = `${getStoreUploadPath(storeId)}/`
  const candidates = [imageUrl, canDecode(imageUrl)]

  try {
    const parsed = new URL(imageUrl)
    candidates.push(parsed.pathname)
    candidates.push(canDecode(parsed.pathname))
    for (const paramValue of parsed.searchParams.values()) {
      candidates.push(paramValue)
      candidates.push(canDecode(paramValue))
    }
  } catch {
    // Non-URL inputs are still checked via the raw/decoded candidates above.
  }

  return candidates.some((candidate) => candidate.includes(expectedPrefix))
}

function extractShopperEmail(request: Request): string | null {
  const raw = request.headers.get('x-shopper-email')
  if (!raw) {
    return null
  }

  const normalized = raw.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailPattern.test(normalized)) {
    return null
  }

  return normalized
}

export async function handleGenerationCreatePost(
  request: Request,
  context: {
    storeId: string
    requestId: string
  }
) {
  const log = createChildLogger(context.requestId)

  // Parse and validate input
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  if (!body || typeof body !== 'object') {
    return errorResponse('VALIDATION_ERROR', 'Request body must be a JSON object', 400)
  }

  const { image_urls, prompt } = body as Record<string, unknown>

  if (!Array.isArray(image_urls) || image_urls.length === 0) {
    return errorResponse('VALIDATION_ERROR', 'image_urls must be a non-empty array of URLs', 400)
  }

  if (image_urls.length > 10) {
    return errorResponse('VALIDATION_ERROR', 'image_urls must contain at most 10 URLs', 400)
  }

  for (const url of image_urls) {
    if (typeof url !== 'string') {
      return errorResponse('VALIDATION_ERROR', 'Each image_urls entry must be a string URL', 400)
    }

    if (!isStoreScopedUploadUrl(url, context.storeId)) {
      return errorResponse(
        'VALIDATION_ERROR',
        `image_urls must use store-scoped paths under ${getStoreUploadPath(context.storeId)}/`,
        400
      )
    }
  }

  const resolvedPrompt =
    typeof prompt === 'string' && prompt.trim() ? prompt.trim() : DEFAULT_B2B_PROMPT

  const supabase = getServiceClient()
  const { data: storeConfig, error: storeConfigError } = await supabase
    .from('stores')
    .select('billing_mode')
    .eq('id', context.storeId)
    .single()

  if (storeConfigError || !storeConfig) {
    log.error({ err: storeConfigError?.message, storeId: context.storeId }, '[B2B Generation] Store load failed')
    return errorResponse('NOT_FOUND', 'Store configuration not found', 404)
  }

  const billingMode = storeConfig.billing_mode === 'resell_mode' ? 'resell_mode' : 'absorb_mode'
  const shopperEmail = extractShopperEmail(request)
  if (billingMode === 'resell_mode' && !shopperEmail) {
    return errorResponse('VALIDATION_ERROR', 'x-shopper-email header is required for resell mode', 400)
  }

  // Deduct 1 credit (store-level for absorb mode, shopper-level for resell mode)
  let creditDeducted = false
  let shopperCreditDeducted = false
  let overagePlan: {
    subscriptionId: string
    tier: 'starter' | 'growth' | 'scale'
  } | null = null
  let overageChargeId: string | null = null

  try {
    if (billingMode === 'resell_mode') {
      const success = await deductStoreShopperCredit(
        context.storeId,
        shopperEmail as string,
        context.requestId,
        'B2B shopper generation'
      )
      if (success) {
        shopperCreditDeducted = true
      } else {
        return errorResponse(
          'INSUFFICIENT_CREDITS',
          'Insufficient shopper credits to create generation',
          402
        )
      }
    } else {
      const success = await deductStoreCredit(context.storeId, context.requestId, 'B2B generation')
      if (success) {
        creditDeducted = true
      } else {
        const billingProfile = await getStoreBillingProfile(context.storeId)
        const hasActiveSubscription =
          billingProfile.subscriptionStatus === 'active' ||
          billingProfile.subscriptionStatus === 'trialing'

        if (
          billingProfile.subscriptionTier &&
          billingProfile.subscriptionId &&
          hasActiveSubscription
        ) {
          overagePlan = {
            subscriptionId: billingProfile.subscriptionId,
            tier: billingProfile.subscriptionTier,
          }
        } else {
          return errorResponse(
            'INSUFFICIENT_CREDITS',
            'Insufficient credits to create generation',
            402
          )
        }
      }
    }
  } catch (err) {
    log.error({ err }, '[B2B Generation] Credit deduction failed')
    return errorResponse('INTERNAL_ERROR', 'Failed to process credit deduction', 500)
  }

  // Create store_generation_sessions record
  const { data: session, error: sessionError } = await supabase
    .from('store_generation_sessions')
    .insert({
      store_id: context.storeId,
      shopper_email: shopperEmail,
      status: 'queued',
      model_image_url: image_urls[0] as string,
      outfit_image_url: (image_urls[1] as string) ?? null,
      prompt_system: resolvedPrompt,
      credits_used: 1,
      request_id: context.requestId,
    })
    .select('id')
    .single()

  if (sessionError || !session) {
    log.error({ err: sessionError?.message }, '[B2B Generation] Session creation failed')
    // Refund credit on session creation failure
    if (shopperCreditDeducted) {
      try {
        await refundStoreShopperCredit(
          context.storeId,
          shopperEmail as string,
          context.requestId,
          'Session creation failed - shopper refund'
        )
      } catch (refundErr) {
        log.error({ err: refundErr }, '[B2B Generation] Shopper refund after session failure also failed')
      }
    } else if (creditDeducted) {
      try {
        await refundStoreCredit(
          context.storeId,
          context.requestId,
          'Session creation failed - refund'
        )
      } catch (refundErr) {
        log.error({ err: refundErr }, '[B2B Generation] Refund after session failure also failed')
      }
    }
    return errorResponse('INTERNAL_ERROR', 'Failed to create generation session', 500)
  }

  // For subscribed stores with 0 credits, bill one overage unit before queueing.
  if (overagePlan) {
    try {
      overageChargeId = await createOverageCharge({
        subscriptionId: overagePlan.subscriptionId,
        tier: overagePlan.tier,
        storeId: context.storeId,
        sessionId: session.id as string,
        requestId: context.requestId,
      })
    } catch (overageErr) {
      log.error(
        { err: overageErr, storeId: context.storeId, sessionId: session.id },
        '[B2B Generation] Overage billing failed'
      )

      await supabase
        .from('store_generation_sessions')
        .update({
          status: 'failed',
          error_message: 'Failed to bill overage for generation request',
        })
        .eq('id', session.id)

      return errorResponse('SERVICE_UNAVAILABLE', 'Overage billing temporarily unavailable', 503)
    }

    const overageCents = getTierOverageCents(overagePlan.tier)
    try {
      await logStoreOverage(
        context.storeId,
        context.requestId,
        `Overage charge (${overagePlan.tier}) billed at ${overageCents} cents via Paddle charge ${overageChargeId}`
      )
    } catch (overageLogErr) {
      log.warn(
        { err: overageLogErr, overageChargeId, sessionId: session.id, storeId: context.storeId },
        '[B2B Generation] Overage charge succeeded but transaction logging failed'
      )
    }
  }

  // Push to Redis queue
  const taskPayload: GenerationTaskPayload = {
    taskId: crypto.randomUUID(),
    channel: 'b2b',
    storeId: context.storeId,
    sessionId: session.id as string,
    imageUrls: image_urls as string[],
    prompt: resolvedPrompt,
    requestId: context.requestId,
    version: TASK_PAYLOAD_VERSION,
    createdAt: new Date().toISOString(),
  }

  try {
    await pushGenerationTask(taskPayload)
  } catch (queueErr) {
    log.error({ err: queueErr }, '[B2B Generation] Queue push failed')

    // Refund credit and mark session failed
    if (shopperCreditDeducted) {
      try {
        await refundStoreShopperCredit(
          context.storeId,
          shopperEmail as string,
          context.requestId,
          'Queue failure - shopper refund'
        )
      } catch (refundErr) {
        log.error({ err: refundErr }, '[B2B Generation] Shopper refund after queue failure also failed')
      }
    } else if (creditDeducted) {
      try {
        await refundStoreCredit(context.storeId, context.requestId, 'Queue failure - refund')
      } catch (refundErr) {
        log.error({ err: refundErr }, '[B2B Generation] Refund after queue failure also failed')
      }
    } else if (overageChargeId) {
      log.warn(
        { overageChargeId, sessionId: session.id },
        '[B2B Generation] Queue failed after overage charge. Manual reconciliation may be required'
      )
    }

    await supabase
      .from('store_generation_sessions')
      .update({ status: 'failed', error_message: 'Failed to queue generation task' })
      .eq('id', session.id)

    return errorResponse('SERVICE_UNAVAILABLE', 'Generation service temporarily unavailable', 503)
  }

  log.info(
    { storeId: context.storeId, sessionId: session.id },
    '[B2B Generation] Task queued successfully'
  )

  return successResponse({ sessionId: session.id, status: 'queued' }, 201)
}

export const POST = withB2BAuth(handleGenerationCreatePost)
