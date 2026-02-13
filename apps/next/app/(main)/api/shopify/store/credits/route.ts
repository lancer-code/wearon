import { withShopifySession } from '@api/middleware/shopify-session'
import type { ShopifySessionContext } from '@api/middleware/shopify-session'
import { getStoreCreditBalance } from '@api/services/merchant-ops'
import { NextResponse } from 'next/server'

async function handleGet(_request: Request, context: ShopifySessionContext) {
  const credits = await getStoreCreditBalance(context.storeId)
  return NextResponse.json(credits)
}

export const GET = withShopifySession(handleGet)
