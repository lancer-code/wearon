import { withShopifySession } from '@api/middleware/shopify-session'
import type { ShopifySessionContext } from '@api/middleware/shopify-session'
import { getApiKeyPreview } from '@api/services/merchant-ops'
import { toSnakeCase } from '@api/utils/snake-case'
import { NextResponse } from 'next/server'

async function handleGet(_request: Request, context: ShopifySessionContext) {
  const result = await getApiKeyPreview(context.storeId)
  return NextResponse.json({ data: toSnakeCase(result), error: null })
}

export const GET = withShopifySession(handleGet)
