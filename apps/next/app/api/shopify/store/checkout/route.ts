import { withShopifySession } from '@api/middleware/shopify-session'
import type { ShopifySessionContext } from '@api/middleware/shopify-session'
import { createCheckout, getStoreById } from '@api/services/merchant-ops'
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
  const mode = payload.mode as string

  if (mode === 'subscription') {
    const tier = payload.tier as string
    if (!tier || !['starter', 'growth', 'scale'].includes(tier)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'tier must be starter, growth, or scale' } },
        { status: 400 }
      )
    }

    const store = await getStoreById(context.storeId)
    const result = await createCheckout(store, { mode: 'subscription', tier: tier as 'starter' | 'growth' | 'scale' })
    return NextResponse.json(result)
  }

  if (mode === 'payg') {
    const credits = payload.credits as number
    if (!credits || !Number.isInteger(credits) || credits < 1 || credits > 5000) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'credits must be an integer between 1 and 5000' } },
        { status: 400 }
      )
    }

    const store = await getStoreById(context.storeId)
    const result = await createCheckout(store, { mode: 'payg', credits })
    return NextResponse.json(result)
  }

  return NextResponse.json(
    { error: { code: 'VALIDATION_ERROR', message: 'mode must be subscription or payg' } },
    { status: 400 }
  )
}

export const POST = withShopifySession(handlePost)
