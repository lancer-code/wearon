import { createClient } from '@supabase/supabase-js'
import { withB2BAuth } from '../../../../../../../packages/api/src/middleware/b2b'
import { createChildLogger } from '../../../../../../../packages/api/src/logger'
import { ensureHiddenTryOnCreditProduct } from '../../../../../../../packages/api/src/services/shopify-credit-product'
import type { B2BContext } from '../../../../../../../packages/api/src/types/b2b'
import {
  errorResponse,
  successResponse,
} from '../../../../../../../packages/api/src/utils/b2b-response'

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

const STORE_CONFIG_READ_SELECT_FIELDS =
  'id, shop_domain, billing_mode, retail_credit_price, subscription_tier, status, shopify_product_id, shopify_variant_id'
const STORE_CONFIG_PATCH_SELECT_FIELDS = `${STORE_CONFIG_READ_SELECT_FIELDS}, access_token_encrypted`

type StoreConfigReadRow = {
  id: string
  shop_domain: string
  billing_mode: string
  retail_credit_price: number | null
  subscription_tier: string | null
  status: string
  shopify_product_id: string | null
  shopify_variant_id: string | null
}

type StoreConfigPatchRow = StoreConfigReadRow & {
  access_token_encrypted: string | null
}

export async function handleGetStoreConfig(_request: Request, context: B2BContext) {
  const log = createChildLogger(context.requestId)
  const supabase = getServiceClient()

  const { data: store, error } = await supabase
    .from('stores')
    .select(STORE_CONFIG_READ_SELECT_FIELDS)
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
    shopifyVariantId: store.shopify_variant_id,
    subscriptionTier: store.subscription_tier,
    status: store.status,
  })
}

export async function handlePatchStoreConfig(request: Request, context: B2BContext) {
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
    if (
      typeof retailCreditPrice !== 'number' ||
      !Number.isFinite(retailCreditPrice) ||
      retailCreditPrice <= 0
    ) {
      return errorResponse(
        'VALIDATION_ERROR',
        'retail_credit_price must be a positive number when billing_mode is resell_mode',
        400
      )
    }
  }

  const { data: existingStore, error: existingStoreError } = await supabase
    .from('stores')
    .select(STORE_CONFIG_PATCH_SELECT_FIELDS)
    .eq('id', context.storeId)
    .single()

  if (existingStoreError || !existingStore) {
    log.error(
      { err: existingStoreError?.message, storeId: context.storeId },
      '[B2B Stores Config] PATCH load current store failed'
    )
    return errorResponse('NOT_FOUND', 'Store configuration not found', 404)
  }

  const currentStore = existingStore as StoreConfigPatchRow
  let shopifyProductId = currentStore.shopify_product_id
  let shopifyVariantId = currentStore.shopify_variant_id

  if (billingMode === 'resell_mode') {
    const retailPrice = retailCreditPrice as number
    if (!currentStore.access_token_encrypted) {
      log.error(
        { storeId: context.storeId, shopDomain: currentStore.shop_domain },
        '[B2B Stores Config] Missing Shopify access token for resell mode sync'
      )
      return errorResponse('SERVICE_UNAVAILABLE', 'Shopify store is not connected', 503)
    }

    try {
      const shopifyResult = await ensureHiddenTryOnCreditProduct({
        accessTokenEncrypted: currentStore.access_token_encrypted,
        existingProductId: currentStore.shopify_product_id,
        existingVariantId: currentStore.shopify_variant_id,
        requestId: context.requestId,
        retailCreditPrice: retailPrice,
        shopDomain: currentStore.shop_domain,
      })
      shopifyProductId = shopifyResult.shopifyProductId
      shopifyVariantId = shopifyResult.shopifyVariantId
    } catch (error) {
      log.error(
        { err: error instanceof Error ? error.message : 'Unknown error', storeId: context.storeId },
        '[B2B Stores Config] Failed to sync Shopify credit product'
      )
      return errorResponse('SERVICE_UNAVAILABLE', 'Failed to sync Shopify credit product', 503)
    }
  }

  const updatePayload: Record<string, unknown> = {
    billing_mode: billingMode,
    retail_credit_price: billingMode === 'resell_mode' ? retailCreditPrice : null,
    shopify_product_id: shopifyProductId,
    shopify_variant_id: shopifyVariantId,
  }

  const { data: updated, error: updateError } = await supabase
    .from('stores')
    .update(updatePayload)
    .eq('id', context.storeId)
    .select(STORE_CONFIG_READ_SELECT_FIELDS)
    .single()

  if (updateError || !updated) {
    log.error(
      { err: updateError?.message, storeId: context.storeId },
      '[B2B Stores Config] PATCH failed'
    )
    return errorResponse('INTERNAL_ERROR', 'Failed to update store configuration', 500)
  }

  return successResponse({
    storeId: updated.id,
    shopDomain: updated.shop_domain,
    billingMode: updated.billing_mode,
    retailCreditPrice: updated.retail_credit_price,
    shopifyVariantId: updated.shopify_variant_id,
    subscriptionTier: updated.subscription_tier,
    status: updated.status,
  })
}

export const GET = withB2BAuth(handleGetStoreConfig)
export const PATCH = withB2BAuth(handlePatchStoreConfig)
