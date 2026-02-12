import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { logger } from '@api/logger'
import { completeAuth, getShopOwnerEmail } from '@api/services/shopify'
import { encrypt } from '@api/utils/encryption'

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceKey)
}

async function linkSupabaseUser(
  supabase: ReturnType<typeof createClient>,
  shopDomain: string,
  accessToken: string,
  storeId: string,
) {
  const ownerEmail = await getShopOwnerEmail(shopDomain, accessToken)
  if (!ownerEmail) {
    logger.warn({ shop: shopDomain }, '[Shopify OAuth] Could not fetch shop owner email, skipping auth linkage')
    return
  }

  // Check if Supabase auth user already exists with this email (use getUsersByEmail for scalability)
  const { data: { users: existingUsers } = { users: [] }, error: lookupError } =
    await supabase.auth.admin.listUsers({ filters: `email eq "${ownerEmail}"` })

  if (lookupError) {
    logger.error({ err: lookupError.message, shop: shopDomain }, '[Shopify OAuth] User lookup failed')
    return
  }

  const existingUser = existingUsers?.[0]

  let userId: string

  if (existingUser) {
    userId = existingUser.id
  } else {
    // Create a new Supabase Auth user for the store owner
    const tempPassword = crypto.randomBytes(32).toString('hex')
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: ownerEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { shop_domain: shopDomain, store_id: storeId },
    })

    if (createError || !newUser?.user) {
      logger.error({ err: createError?.message, shop: shopDomain }, '[Shopify OAuth] Supabase user creation failed')
      return
    }

    userId = newUser.user.id
  }

  // Link store to Supabase user
  const { error: linkError } = await supabase
    .from('stores')
    .update({ owner_user_id: userId })
    .eq('id', storeId)

  if (linkError) {
    logger.error({ err: linkError.message, storeId, userId }, '[Shopify OAuth] Failed to link user to store')
    return
  }

  logger.info({ storeId, userId, shop: shopDomain }, '[Shopify OAuth] Supabase user linked to store')
}

function generateApiKey(): { plaintext: string; hash: string; prefix: string } {
  const randomHex = crypto.randomBytes(16).toString('hex')
  const plaintext = `wk_${randomHex}`
  const hash = crypto.createHash('sha256').update(plaintext).digest('hex')
  const prefix = plaintext.substring(0, 16) // First 16 chars for masked display
  return { plaintext, hash, prefix }
}

export async function GET(request: Request) {
  try {
    const callbackResult = await completeAuth(request)
    const { session } = callbackResult

    if (!session?.accessToken || !session?.shop) {
      logger.error('[Shopify OAuth] Callback missing session data')
      return NextResponse.json(
        { data: null, error: { code: 'INTERNAL_ERROR', message: 'OAuth callback failed' } },
        { status: 500 },
      )
    }

    const shopDomain = session.shop
    const accessToken = session.accessToken

    logger.info({ shop: shopDomain }, '[Shopify OAuth] Callback received')

    const supabase = getAdminSupabase()

    // Check if store already exists (re-installation case — handled in Task 4)
    const { data: existingStore } = await supabase
      .from('stores')
      .select('id')
      .eq('shop_domain', shopDomain)
      .single()

    const encryptedToken = encrypt(accessToken)

    let storeId: string

    if (existingStore) {
      // Re-installation: update existing store
      const { error: updateError } = await supabase
        .from('stores')
        .update({
          access_token_encrypted: encryptedToken,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingStore.id)

      if (updateError) {
        logger.error({ err: updateError.message, shop: shopDomain }, '[Shopify OAuth] Store update failed')
        return NextResponse.json(
          { data: null, error: { code: 'INTERNAL_ERROR', message: 'Store update failed' } },
          { status: 500 },
        )
      }

      // Re-activate API keys
      await supabase
        .from('store_api_keys')
        .update({ is_active: true })
        .eq('store_id', existingStore.id)

      // Backfill missing API key if none exist (fixes partial-failure installations)
      const { data: existingKeys } = await supabase
        .from('store_api_keys')
        .select('id')
        .eq('store_id', existingStore.id)
        .limit(1)

      if (!existingKeys || existingKeys.length === 0) {
        const apiKey = generateApiKey()
        await supabase.from('store_api_keys').insert({
          store_id: existingStore.id,
          key_hash: apiKey.hash,
          key_prefix: apiKey.prefix,
          allowed_domains: [`https://${shopDomain}`],
          is_active: true,
        })
        logger.info({ storeId: existingStore.id }, '[Shopify OAuth] Backfilled missing API key on re-install')
      }

      storeId = existingStore.id
      logger.info({ storeId, shop: shopDomain }, '[Shopify OAuth] Store re-activated')

      // Re-link Supabase Auth user on re-installation
      await linkSupabaseUser(supabase, shopDomain, accessToken, storeId)
    } else {
      // New store registration
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .insert({
          shop_domain: shopDomain,
          access_token_encrypted: encryptedToken,
          status: 'active',
          billing_mode: 'absorb_mode',
          onboarding_completed: false,
        })
        .select('id')
        .single()

      if (storeError || !storeData) {
        logger.error({ err: storeError?.message, shop: shopDomain }, '[Shopify OAuth] Store creation failed')
        return NextResponse.json(
          { data: null, error: { code: 'INTERNAL_ERROR', message: 'Store registration failed' } },
          { status: 500 },
        )
      }

      storeId = storeData.id

      // Generate API key
      const apiKey = generateApiKey()
      const { error: keyError } = await supabase.from('store_api_keys').insert({
        store_id: storeId,
        key_hash: apiKey.hash,
        key_prefix: apiKey.prefix,
        allowed_domains: [`https://${shopDomain}`], // CORS origin format with scheme
        is_active: true,
      })

      if (keyError) {
        logger.error({ err: keyError.message, storeId }, '[Shopify OAuth] API key creation failed')
        // CRITICAL: API key is required for store to function - fail the OAuth flow
        return NextResponse.json(
          { data: null, error: { code: 'INTERNAL_ERROR', message: 'API key creation failed' } },
          { status: 500 },
        )
      }

      // store_credits row auto-created by database trigger (Story 1.1)

      logger.info({ storeId, shop: shopDomain }, '[Shopify OAuth] New store registered')

      // Link Supabase Auth user to store
      await linkSupabaseUser(supabase, shopDomain, accessToken, storeId)

      // SECURITY: Never pass API key in URL (exposes via browser history, logs, referrers)
      // Merchant can regenerate API key from dashboard if needed
      const redirectUrl = new URL('/merchant/onboarding', process.env.SHOPIFY_APP_URL || request.url)
      redirectUrl.searchParams.set('store_id', storeId)
      redirectUrl.searchParams.set('new_install', 'true')

      return NextResponse.redirect(redirectUrl.toString())
    }

    // Re-installation redirect (no new API key shown)
    const redirectUrl = new URL('/merchant/onboarding', process.env.SHOPIFY_APP_URL || request.url)
    redirectUrl.searchParams.set('store_id', storeId)

    return NextResponse.redirect(redirectUrl.toString())
  } catch (error) {
    logger.error({ err: error instanceof Error ? error.message : 'Unknown error' }, '[Shopify OAuth] Callback error')
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'OAuth callback failed' } },
      { status: 500 },
    )
  }
}
