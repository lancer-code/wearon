import { withShopifySession } from '@api/middleware/shopify-session'
import type { ShopifySessionContext } from '@api/middleware/shopify-session'
import { changePlan, getStoreById } from '@api/services/merchant-ops'
import type { SubscriptionTier } from '@api/services/paddle'
import { NextResponse } from 'next/server'

async function handlePost(request: Request, context: ShopifySessionContext) {
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
  const targetTier = payload.targetTier as string

  if (!targetTier || !['starter', 'growth', 'scale'].includes(targetTier)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'targetTier must be starter, growth, or scale' } },
      { status: 400 }
    )
  }

  const store = await getStoreById(context.storeId)
  const result = await changePlan(store, targetTier as SubscriptionTier)
  return NextResponse.json(result)
}

export const POST = withShopifySession(handlePost)
