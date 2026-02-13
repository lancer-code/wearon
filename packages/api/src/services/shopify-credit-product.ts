import { createChildLogger } from '../logger'
import { decrypt } from '../utils/encryption'
import { createShopifyClient } from './shopify'

const CREDIT_PRODUCT_TITLE = 'Try-On Credit'
const CREDIT_PRODUCT_TYPE = 'digital'
const ONLINE_STORE_PUBLICATION_NAMES = [
  'Online Store', // English
  'Boutique en ligne', // French
  'Tienda online', // Spanish
  'Online-Shop', // German
  'Loja online', // Portuguese
  'Negozio online', // Italian
  'Онлайн-магазин', // Russian
  'オンラインストア', // Japanese
]

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
  mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`

const GET_PRODUCT_VARIANT_QUERY = `
  query getProduct($id: ID!) {
    product(id: $id) {
      id
      variants(first: 1) {
        nodes {
          id
        }
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

  await updateVariantPrice(client, productGid, variantGid, retailCreditPrice)

  return {
    productId: extractNumericId(productGid),
    productGid,
    variantId: extractNumericId(variantGid),
  }
}

async function updateVariantPrice(
  client: ReturnType<typeof createShopifyClient>,
  productId: string,
  variantId: string,
  retailCreditPrice: number,
): Promise<void> {
  type ProductVariantsBulkUpdateResponse = {
    productVariantsBulkUpdate?: {
      productVariants?: Array<{ id: string }> | null
      userErrors?: ShopifyUserError[] | null
    } | null
  }

  const response = await client.request<ProductVariantsBulkUpdateResponse>(UPDATE_VARIANT_PRICE_MUTATION, {
    variables: {
      productId: toProductGid(productId),
      variants: [
        {
          id: toVariantGid(variantId),
          price: formatPrice(retailCreditPrice),
        },
      ],
    },
  })
  const payload = response.data
  const bulkUpdate = payload?.productVariantsBulkUpdate
  throwOnUserErrors('productVariantsBulkUpdate', bulkUpdate?.userErrors)

  if (!bulkUpdate?.productVariants?.length) {
    throw new Error('Shopify productVariantsBulkUpdate did not return variant ids')
  }
}

async function getProductVariant(
  client: ReturnType<typeof createShopifyClient>,
  productId: string,
): Promise<string | null> {
  type GetProductResponse = {
    product?: {
      id: string
      variants?: {
        nodes?: Array<{
          id: string
        }>
      }
    } | null
  }

  const response = await client.request<GetProductResponse>(GET_PRODUCT_VARIANT_QUERY, {
    variables: {
      id: toProductGid(productId),
    },
  })

  const variantGid = response.data?.product?.variants?.nodes?.[0]?.id

  if (!variantGid) {
    return null
  }

  return extractNumericId(variantGid)
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
  const onlineStorePublication = publicationNodes.find((publication) =>
    ONLINE_STORE_PUBLICATION_NAMES.includes(publication.name),
  )

  if (!onlineStorePublication?.id) {
    throw new Error(
      `Shopify Online Store publication not found. Available: ${publicationNodes.map((p) => p.name).join(', ')}`,
    )
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
    log.info(
      { shopDomain: params.shopDomain, productId: existingProductId },
      '[Shopify Credit Product] Updating existing product price',
    )
    await updateVariantPrice(shopifyClient, existingProductId, existingVariantId, params.retailCreditPrice)
    return {
      shopifyProductId: existingProductId,
      shopifyVariantId: existingVariantId,
    }
  }

  if (existingProductId && !existingVariantId) {
    log.warn(
      { shopDomain: params.shopDomain, productId: existingProductId },
      '[Shopify Credit Product] Partial state detected - querying Shopify for variant',
    )
    const reconciledVariantId = await getProductVariant(shopifyClient, existingProductId)
    if (reconciledVariantId) {
      await updateVariantPrice(shopifyClient, existingProductId, reconciledVariantId, params.retailCreditPrice)
      return {
        shopifyProductId: existingProductId,
        shopifyVariantId: reconciledVariantId,
      }
    }
    log.warn(
      { shopDomain: params.shopDomain, productId: existingProductId },
      '[Shopify Credit Product] Failed to reconcile variant - creating new product',
    )
  }

  log.info({ shopDomain: params.shopDomain }, '[Shopify Credit Product] Creating hidden Try-On Credit product')
  const createdProduct = await createCreditProduct(shopifyClient, params.retailCreditPrice)
  await removeFromOnlineStoreChannel(shopifyClient, createdProduct.productGid)

  return {
    shopifyProductId: createdProduct.productId,
    shopifyVariantId: createdProduct.variantId,
  }
}
