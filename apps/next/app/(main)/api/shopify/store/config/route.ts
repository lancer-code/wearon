import { withShopifySession } from '@api/middleware/shopify-session'
import type { ShopifySessionContext } from '@api/middleware/shopify-session'
import { getStoreConfig, updateStoreConfig } from '@api/services/merchant-ops'
import { NextResponse } from 'next/server'

async function handleGet(_request: Request, context: ShopifySessionContext) {
  const config = await getStoreConfig(context.storeId)
  return NextResponse.json(config)
}

async function handlePatch(request: Request, context: ShopifySessionContext) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Request body must be a JSON object' } },
      { status: 400 }
    )
  }

  const payload = body as Record<string, unknown>
  const billingMode = payload.billing_mode as string
  const retailCreditPrice = payload.retail_credit_price as number | null

  if (billingMode !== 'absorb_mode' && billingMode !== 'resell_mode') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'billing_mode must be absorb_mode or resell_mode' } },
      { status: 400 }
    )
  }

  if (billingMode === 'resell_mode') {
    if (
      typeof retailCreditPrice !== 'number' ||
      !Number.isFinite(retailCreditPrice) ||
      retailCreditPrice <= 0 ||
      retailCreditPrice > 100
    ) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'retail_credit_price must be a positive number up to $100 when billing_mode is resell_mode' } },
        { status: 400 }
      )
    }
  }

  const config = await updateStoreConfig(context.storeId, billingMode, retailCreditPrice)
  return NextResponse.json(config)
}

export const GET = withShopifySession(handleGet)
export const PATCH = withShopifySession(handlePatch)
