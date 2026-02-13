import { NextResponse } from 'next/server'
import { beginAuth } from '@api/services/shopify'
import { logger } from '@api/logger'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const shop = url.searchParams.get('shop')

  if (!shop) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Missing shop parameter' } },
      { status: 400 },
    )
  }

  try {
    return await beginAuth(request, shop)
  } catch (error) {
    logger.error({ err: error instanceof Error ? error.message : 'Unknown error' }, '[Shopify OAuth] Begin failed')
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'Failed to initiate OAuth' } },
      { status: 500 },
    )
  }
}
