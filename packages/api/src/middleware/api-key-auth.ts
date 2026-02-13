import { createHash } from 'node:crypto'
import type { NextResponse } from 'next/server'
import { getAdminClient } from '../lib/supabase-admin'
import { logger } from '../logger'
import type { B2BContext } from '../types/b2b'
import { unauthorizedResponse } from '../utils/b2b-response'

const API_KEY_PREFIX = 'wk_'

export async function authenticateApiKey(
  request: Request,
  requestId: string,
): Promise<{ context: B2BContext } | { error: NextResponse }> {
  const authHeader = request.headers.get('authorization')

  if (!authHeader) {
    return { error: unauthorizedResponse() }
  }

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return { error: unauthorizedResponse() }
  }

  const apiKey = parts[1]!
  if (!apiKey.startsWith(API_KEY_PREFIX)) {
    return { error: unauthorizedResponse() }
  }

  const keyHash = createHash('sha256').update(apiKey).digest('hex')

  try {
    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('store_api_keys')
      .select('store_id, allowed_domains, stores!inner(shop_domain, subscription_tier, status)')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      return { error: unauthorizedResponse() }
    }

    const store = (data as Record<string, unknown>).stores as {
      shop_domain: string
      subscription_tier: string | null
      status: string
    }

    if (store.status !== 'active') {
      return { error: unauthorizedResponse() }
    }

    const context: B2BContext = {
      storeId: data.store_id as string,
      shopDomain: store.shop_domain,
      allowedDomains: (data.allowed_domains as string[]) ?? [],
      subscriptionTier: store.subscription_tier,
      isActive: true,
      requestId,
    }

    return { context }
  } catch (err) {
    logger.error({ request_id: requestId, err }, 'API key authentication failed')
    return { error: unauthorizedResponse() }
  }
}
