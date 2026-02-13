import '@shopify/shopify-api/adapters/web-api'
import { shopifyApi, ApiVersion, Session } from '@shopify/shopify-api'
import { logger } from '../logger'

let shopifyInstance: ReturnType<typeof shopifyApi> | null = null

function getShopifyApi() {
  if (!shopifyInstance) {
    const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID
    const apiSecretKey = process.env.SHOPIFY_CLIENT_SECRET
    const hostName = process.env.SHOPIFY_APP_URL
    const scopes = process.env.SHOPIFY_SCOPES

    if (!apiKey || !apiSecretKey || !hostName || !scopes) {
      throw new Error(
        'Missing Shopify environment variables: NEXT_PUBLIC_SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, SHOPIFY_APP_URL, SHOPIFY_SCOPES',
      )
    }

    const cleanHost = hostName.replace(/^https?:\/\//, '')

    shopifyInstance = shopifyApi({
      apiKey,
      apiSecretKey,
      scopes: scopes.split(',').map((s) => s.trim()),
      hostName: cleanHost,
      apiVersion: ApiVersion.January26,
      isEmbeddedApp: true,
    })

    logger.info('[Shopify] API client initialized')
  }

  return shopifyInstance
}

export function getShopifyApiInstance() {
  return getShopifyApi()
}

export function createShopifyClient(shopDomain: string, accessToken: string) {
  const shopify = getShopifyApi()

  const session = new Session({
    id: shopDomain,
    shop: shopDomain,
    state: '',
    isOnline: false,
  })
  session.accessToken = accessToken

  return new shopify.clients.Graphql({ session })
}


export async function exchangeTokenForOfflineAccess(
  shop: string,
  sessionToken: string
): Promise<{ accessToken: string; scope: string }> {
  const shopify = getShopifyApi()
  const { RequestedTokenType } = await import('@shopify/shopify-api')
  const { session } = await shopify.auth.tokenExchange({
    shop,
    sessionToken,
    requestedTokenType: RequestedTokenType.OfflineAccessToken,
  })
  if (!session.accessToken) {
    throw new Error('Token exchange returned no access token')
  }
  return { accessToken: session.accessToken, scope: session.scope || '' }
}

