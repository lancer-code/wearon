import { withShopifySession } from '@api/middleware/shopify-session'
import type { ShopifySessionContext } from '@api/middleware/shopify-session'
import { getStoreById } from '@api/services/merchant-ops'
import { NextResponse } from 'next/server'

async function handleGet(_request: Request, context: ShopifySessionContext) {
  const store = await getStoreById(context.storeId)
  return NextResponse.json({
    id: store.id,
    shopDomain: store.shopDomain,
    billingMode: store.billingMode,
    subscriptionTier: store.subscriptionTier,
    subscriptionStatus: store.subscriptionStatus,
    status: store.status,
    onboardingCompleted: store.onboardingCompleted,
  })
}

export const GET = withShopifySession(handleGet)
