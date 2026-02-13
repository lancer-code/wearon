import { withShopifySession } from '@api/middleware/shopify-session'
import type { ShopifySessionContext } from '@api/middleware/shopify-session'
import { getStoreById } from '@api/services/merchant-ops'
import { NextResponse } from 'next/server'

async function handleGet(_request: Request, context: ShopifySessionContext) {
  const store = await getStoreById(context.storeId)
  return NextResponse.json(store)
}

export const GET = withShopifySession(handleGet)
