import { withShopifySession } from '@api/middleware/shopify-session'
import type { ShopifySessionContext } from '@api/middleware/shopify-session'
import { regenerateApiKey } from '@api/services/merchant-ops'
import { NextResponse } from 'next/server'

async function handlePost(_request: Request, context: ShopifySessionContext) {
  const result = await regenerateApiKey(context.storeId, context.shopDomain)
  return NextResponse.json(result)
}

export const POST = withShopifySession(handlePost)
