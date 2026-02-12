import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextResponse } from 'next/server'
import { logger } from '../logger'
import type { B2BContext } from '../types/b2b'
import { unauthorizedResponse } from '../utils/b2b-response'

const API_KEY_PREFIX = 'wk_'

let serviceClient: SupabaseClient | null = null

function getServiceClient(): SupabaseClient {
  if (!serviceClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
    }

    serviceClient = createClient(supabaseUrl, supabaseServiceKey)
  }
  return serviceClient
}

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
    const supabase = getServiceClient()
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
