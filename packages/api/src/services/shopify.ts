import '@shopify/shopify-api/adapters/web-api'
import { shopifyApi, ApiVersion, Session } from '@shopify/shopify-api'
import { logger } from '../logger'

let shopifyInstance: ReturnType<typeof shopifyApi> | null = null

function getShopifyApi() {
  if (!shopifyInstance) {
    const apiKey = process.env.SHOPIFY_API_KEY
    const apiSecretKey = process.env.SHOPIFY_API_SECRET
    const hostName = process.env.SHOPIFY_APP_URL
    const scopes = process.env.SHOPIFY_SCOPES

    if (!apiKey || !apiSecretKey || !hostName || !scopes) {
      throw new Error(
        'Missing Shopify environment variables: SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_APP_URL, SHOPIFY_SCOPES',
      )
    }

    const cleanHost = hostName.replace(/^https?:\/\//, '')

    shopifyInstance = shopifyApi({
      apiKey,
      apiSecretKey,
      scopes: scopes.split(',').map((s) => s.trim()),
      hostName: cleanHost,
      apiVersion: ApiVersion.January26,
      isEmbeddedApp: false,
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

export async function beginAuth(request: Request, shopDomain: string): Promise<Response> {
  const shopify = getShopifyApi()
  const sanitizedShop = shopify.utils.sanitizeShop(shopDomain, true)
  if (!sanitizedShop) {
    throw new Error('Invalid shop domain')
  }

  return shopify.auth.begin({
    shop: sanitizedShop,
    callbackPath: '/api/v1/auth/shopify/callback',
    isOnline: false,
    rawRequest: request,
  })
}

export async function completeAuth(request: Request) {
  const shopify = getShopifyApi()
  return shopify.auth.callback({ rawRequest: request })
}

export async function validateHmac(query: Record<string, string>): Promise<boolean> {
  const shopify = getShopifyApi()
  return shopify.utils.validateHmac(query)
}

export async function getShopOwnerEmail(shopDomain: string, accessToken: string): Promise<string | null> {
  try {
    const client = createShopifyClient(shopDomain, accessToken)
    const response = await client.request(`{ shop { email } }`)
    const data = response.data as { shop?: { email?: string } } | undefined
    return data?.shop?.email || null
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error.message : 'Unknown error', shop: shopDomain },
      '[Shopify] Failed to fetch shop owner email',
    )
    return null
  }
}
