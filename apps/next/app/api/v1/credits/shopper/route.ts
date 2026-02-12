import { withB2BAuth } from '../../../../../../../packages/api/src/middleware/b2b'
import { getStoreShopperBalance } from '../../../../../../../packages/api/src/services/b2b-credits'
import { errorResponse, successResponse } from '../../../../../../../packages/api/src/utils/b2b-response'

function extractShopperEmail(request: Request): string | null {
  const raw = request.headers.get('x-shopper-email')
  if (!raw) {
    return null
  }

  const normalized = raw.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailPattern.test(normalized)) {
    return null
  }

  return normalized
}

export async function handleShopperCreditsGet(
  request: Request,
  context: {
    storeId: string
  }
) {
  const shopperEmail = extractShopperEmail(request)
  if (!shopperEmail) {
    return errorResponse('VALIDATION_ERROR', 'x-shopper-email header is required', 400)
  }

  try {
    const balance = await getStoreShopperBalance(context.storeId, shopperEmail)

    return successResponse({
      balance: balance.balance,
      totalPurchased: balance.totalPurchased,
      totalSpent: balance.totalSpent,
    })
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to retrieve shopper credit balance', 500)
  }
}

export const GET = withB2BAuth(handleShopperCreditsGet)
