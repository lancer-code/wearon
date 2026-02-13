import { withShopifySession } from '@api/middleware/shopify-session'
import type { ShopifySessionContext } from '@api/middleware/shopify-session'
import { getOverageUsage } from '@api/services/merchant-ops'
import { toSnakeCase } from '@api/utils/snake-case'
import { NextResponse } from 'next/server'

async function handleGet(_request: Request, context: ShopifySessionContext) {
  const overage = await getOverageUsage(context.storeId)
  return NextResponse.json({ data: toSnakeCase(overage), error: null })
}

export const GET = withShopifySession(handleGet)
