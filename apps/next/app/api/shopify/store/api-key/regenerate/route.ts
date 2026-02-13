import { withShopifySession } from '@api/middleware/shopify-session'
import type { ShopifySessionContext } from '@api/middleware/shopify-session'
import { regenerateApiKey } from '@api/services/merchant-ops'
import { toSnakeCase } from '@api/utils/snake-case'
import { NextResponse } from 'next/server'

async function handlePost(_request: Request, context: ShopifySessionContext) {
  const result = await regenerateApiKey(context.storeId, context.shopDomain)
  return NextResponse.json({ data: toSnakeCase(result), error: null })
}

export const POST = withShopifySession(handlePost)
