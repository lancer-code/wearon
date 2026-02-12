import { withB2BAuth } from '../../../../../../packages/api/src/middleware/b2b'
import { successResponse, errorResponse } from '../../../../../../packages/api/src/utils/b2b-response'
import { getStoreBalance } from '../../../../../../packages/api/src/services/b2b-credits'
import { logger } from '../../../../../../packages/api/src/logger'

export const GET = withB2BAuth(async (_request, context) => {
  try {
    const balance = await getStoreBalance(context.storeId)

    return successResponse({
      balance: balance.balance,
      totalPurchased: balance.totalPurchased,
      totalSpent: balance.totalSpent,
    })
  } catch (err) {
    // Log error with store/request context for observability
    logger.error(
      {
        store_id: context.storeId,
        request_id: context.requestId,
        err: err instanceof Error ? err.message : 'Unknown error',
      },
      '[Credits Balance] Failed to retrieve balance',
    )
    return errorResponse('INTERNAL_ERROR', 'Failed to retrieve credit balance', 500)
  }
})
