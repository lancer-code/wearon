import { createChildLogger } from '../logger'
import { decrypt } from '../utils/encryption'
import { createShopifyClient } from './shopify'

const CREDIT_PRODUCT_TITLE = 'Try-On Credit'
const CREDIT_PRODUCT_TYPE = 'digital'
const ONLINE_STORE_PUBLICATION_NAME = 'Online Store'

interface ShopifyUserError {
  field?: string[] | null
  message: string
}

interface EnsureHiddenCreditProductParams {
  accessTokenEncrypted: string
  existingProductId?: string | null
  existingVariantId?: string | null
  requestId: string
  retailCreditPrice: number
  shopDomain: string
}

interface EnsureHiddenCreditProductResult {
  shopifyProductId: string
  shopifyVariantId: string
}

const CREATE_CREDIT_PRODUCT_MUTATION = `
  mutation productCreate($input: ProductCreateInput!) {
    productCreate(product: $input) {
      product {
        id
        variants(first: 1) {
          nodes {
            id
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`

const UPDATE_VARIANT_PRICE_MUTATION = `
  mutation productVariantUpdate($input: ProductVariantInput!) {
    productVariantUpdate(input: $input) {
      productVariant {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`

const LIST_PUBLICATIONS_QUERY = `
  query publications {
    publications(first: 30) {
      nodes {
        id
        name
      }
    }
  }
`

const UNPUBLISH_FROM_ONLINE_STORE_MUTATION = `
  mutation publishableUnpublish($id: ID!, $input: PublicationInput!) {
    publishableUnpublish(id: $id, input: $input) {
      userErrors {
        field
        message
      }
    }
  }
`

function formatPrice(price: number): string {
  return price.toFixed(2)
}

function toProductGid(productId: string): string {
  if (productId.startsWith('gid://')) {
    return productId
  }

  return `gid://shopify/Product/${productId}`
}

function toVariantGid(variantId: string): string {
  if (variantId.startsWith('gid://')) {
    return variantId
  }

  return `gid://shopify/ProductVariant/${variantId}`
}

function extractNumericId(id: string): string {
  const match = id.match(/\/(\d+)$/)
  if (!match || !match[1]) {
    return id
  }

  return match[1]
}

function throwOnUserErrors(operationName: string, errors?: ShopifyUserError[] | null): void {
  if (!errors?.length) {
    return
  }

  const messages = errors.map((error) => error.message).join('; ')
  throw new Error(`${operationName} failed: ${messages}`)
}

async function createCreditProduct(
  client: ReturnType<typeof createShopifyClient>,
  retailCreditPrice: number,
): Promise<{ productId: string; productGid: string; variantId: string }> {
  type ProductCreateResponse = {
    productCreate?: {
      product?: {
        id: string
        variants?: {
          nodes?: Array<{
            id: string
          }>
        }
      } | null
      userErrors?: ShopifyUserError[] | null
    } | null
  }

  const response = await client.request<ProductCreateResponse>(CREATE_CREDIT_PRODUCT_MUTATION, {
    variables: {
      input: {
        title: CREDIT_PRODUCT_TITLE,
        productType: CREDIT_PRODUCT_TYPE,
      },
    },
  })
  const payload = response.data
  const productCreate = payload?.productCreate
  throwOnUserErrors('productCreate', productCreate?.userErrors)

  const productGid = productCreate?.product?.id
  const variantGid = productCreate?.product?.variants?.nodes?.[0]?.id

  if (!productGid || !variantGid) {
    throw new Error('Shopify productCreate did not return product or variant id')
  }

  await updateVariantPrice(client, variantGid, retailCreditPrice)

  return {
    productId: extractNumericId(productGid),
    productGid,
    variantId: extractNumericId(variantGid),
  }
}

async function updateVariantPrice(
  client: ReturnType<typeof createShopifyClient>,
  variantId: string,
  retailCreditPrice: number,
): Promise<void> {
  type ProductVariantUpdateResponse = {
    productVariantUpdate?: {
      productVariant?: { id: string } | null
      userErrors?: ShopifyUserError[] | null
    } | null
  }

  const response = await client.request<ProductVariantUpdateResponse>(UPDATE_VARIANT_PRICE_MUTATION, {
    variables: {
      input: {
        id: toVariantGid(variantId),
        price: formatPrice(retailCreditPrice),
      },
    },
  })
  const payload = response.data
  const productVariantUpdate = payload?.productVariantUpdate
  throwOnUserErrors('productVariantUpdate', productVariantUpdate?.userErrors)

  if (!productVariantUpdate?.productVariant?.id) {
    throw new Error('Shopify productVariantUpdate did not return variant id')
  }
}

async function removeFromOnlineStoreChannel(
  client: ReturnType<typeof createShopifyClient>,
  productId: string,
): Promise<void> {
  type PublicationsQueryResponse = {
    publications?: {
      nodes?: Array<{
        id: string
        name: string
      }>
    }
  }

  const publicationsResponse = await client.request<PublicationsQueryResponse>(LIST_PUBLICATIONS_QUERY)
  const publicationNodes = publicationsResponse.data?.publications?.nodes || []
  const onlineStorePublication = publicationNodes.find(
    (publication) => publication.name === ONLINE_STORE_PUBLICATION_NAME,
  )

  if (!onlineStorePublication?.id) {
    throw new Error(`Shopify publication "${ONLINE_STORE_PUBLICATION_NAME}" not found`)
  }

  type PublishableUnpublishResponse = {
    publishableUnpublish?: {
      userErrors?: ShopifyUserError[] | null
    } | null
  }

  const unpublishResponse = await client.request<PublishableUnpublishResponse>(
    UNPUBLISH_FROM_ONLINE_STORE_MUTATION,
    {
      variables: {
        id: toProductGid(productId),
        input: {
          publicationId: onlineStorePublication.id,
        },
      },
    },
  )

  throwOnUserErrors('publishableUnpublish', unpublishResponse.data?.publishableUnpublish?.userErrors)
}

export async function ensureHiddenTryOnCreditProduct(
  params: EnsureHiddenCreditProductParams,
): Promise<EnsureHiddenCreditProductResult> {
  const log = createChildLogger(params.requestId)
  const accessToken = decrypt(params.accessTokenEncrypted)
  const shopifyClient = createShopifyClient(params.shopDomain, accessToken)

  const existingProductId = params.existingProductId?.trim() || null
  const existingVariantId = params.existingVariantId?.trim() || null

  if (existingProductId && existingVariantId) {
    await updateVariantPrice(shopifyClient, existingVariantId, params.retailCreditPrice)
    return {
      shopifyProductId: existingProductId,
      shopifyVariantId: existingVariantId,
    }
  }

  log.info({ shopDomain: params.shopDomain }, '[Shopify Credit Product] Creating hidden Try-On Credit product')
  const createdProduct = await createCreditProduct(shopifyClient, params.retailCreditPrice)
  await removeFromOnlineStoreChannel(shopifyClient, createdProduct.productGid)

  return {
    shopifyProductId: createdProduct.productId,
    shopifyVariantId: createdProduct.variantId,
  }
}
