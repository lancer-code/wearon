import { withShopifySession } from '@api/middleware/shopify-session'
import type { ShopifySessionContext } from '@api/middleware/shopify-session'
import { getApiKeyPreview } from '@api/services/merchant-ops'
import { NextResponse } from 'next/server'

async function handleGet(_request: Request, context: ShopifySessionContext) {
  const result = await getApiKeyPreview(context.storeId)
  return NextResponse.json(result)
}

export const GET = withShopifySession(handleGet)
