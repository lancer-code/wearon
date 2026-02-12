import { withB2BAuth } from '../../../../../../packages/api/src/middleware/b2b'
import { successResponse, errorResponse } from '../../../../../../packages/api/src/utils/b2b-response'
import { getStoreBalance } from '../../../../../../packages/api/src/services/b2b-credits'

export const GET = withB2BAuth(async (_request, context) => {
  try {
    const balance = await getStoreBalance(context.storeId)

    return successResponse({
      balance: balance.balance,
      totalPurchased: balance.totalPurchased,
      totalSpent: balance.totalSpent,
    })
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to retrieve credit balance', 500)
  }
})
