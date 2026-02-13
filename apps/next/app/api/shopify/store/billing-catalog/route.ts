import { withShopifySession } from '@api/middleware/shopify-session'
import type { ShopifySessionContext } from '@api/middleware/shopify-session'
import { getStoreById, getStoreBillingCatalog } from '@api/services/merchant-ops'
import { toSnakeCase } from '@api/utils/snake-case'
import { NextResponse } from 'next/server'

async function handleGet(_request: Request, context: ShopifySessionContext) {
  const store = await getStoreById(context.storeId)
  const catalog = getStoreBillingCatalog(store)
  return NextResponse.json({ data: toSnakeCase(catalog), error: null })
}

export const GET = withShopifySession(handleGet)
