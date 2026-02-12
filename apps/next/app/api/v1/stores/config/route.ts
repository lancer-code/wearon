import { createClient } from '@supabase/supabase-js'
import { withB2BAuth } from '../../../../../../packages/api/src/middleware/b2b'
import { createChildLogger } from '../../../../../../packages/api/src/logger'
import { errorResponse, successResponse } from '../../../../../../packages/api/src/utils/b2b-response'

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

export const GET = withB2BAuth(async (_request, context) => {
  const log = createChildLogger(context.requestId)
  const supabase = getServiceClient()

  const { data: store, error } = await supabase
    .from('stores')
    .select('id, shop_domain, billing_mode, retail_credit_price, subscription_tier, status')
    .eq('id', context.storeId)
    .single()

  if (error || !store) {
    log.error({ err: error?.message, storeId: context.storeId }, '[B2B Stores Config] GET failed')
    return errorResponse('NOT_FOUND', 'Store configuration not found', 404)
  }

  return successResponse({
    storeId: store.id,
    shopDomain: store.shop_domain,
    billingMode: store.billing_mode,
    retailCreditPrice: store.retail_credit_price,
    subscriptionTier: store.subscription_tier,
    status: store.status,
  })
})

export const PATCH = withB2BAuth(async (request, context) => {
  const log = createChildLogger(context.requestId)
  const supabase = getServiceClient()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  if (!body || typeof body !== 'object') {
    return errorResponse('VALIDATION_ERROR', 'Request body must be a JSON object', 400)
  }

  const payload = body as Record<string, unknown>
  const billingMode = payload.billing_mode
  const retailCreditPrice = payload.retail_credit_price

  if (billingMode !== 'absorb_mode' && billingMode !== 'resell_mode') {
    return errorResponse('VALIDATION_ERROR', 'billing_mode must be absorb_mode or resell_mode', 400)
  }

  if (billingMode === 'resell_mode') {
    if (typeof retailCreditPrice !== 'number' || !Number.isFinite(retailCreditPrice) || retailCreditPrice <= 0) {
      return errorResponse(
        'VALIDATION_ERROR',
        'retail_credit_price must be a positive number when billing_mode is resell_mode',
        400,
      )
    }
  }

  const updatePayload: Record<string, unknown> = {
    billing_mode: billingMode,
    retail_credit_price: billingMode === 'resell_mode' ? retailCreditPrice : null,
  }

  const { data: updated, error: updateError } = await supabase
    .from('stores')
    .update(updatePayload)
    .eq('id', context.storeId)
    .select('id, shop_domain, billing_mode, retail_credit_price, subscription_tier, status')
    .single()

  if (updateError || !updated) {
    log.error({ err: updateError?.message, storeId: context.storeId }, '[B2B Stores Config] PATCH failed')
    return errorResponse('INTERNAL_ERROR', 'Failed to update store configuration', 500)
  }

  return successResponse({
    storeId: updated.id,
    shopDomain: updated.shop_domain,
    billingMode: updated.billing_mode,
    retailCreditPrice: updated.retail_credit_price,
    subscriptionTier: updated.subscription_tier,
    status: updated.status,
  })
})
