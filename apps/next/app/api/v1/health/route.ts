import { withB2BAuth } from '../../../../../packages/api/src/middleware/b2b'
import { successResponse } from '../../../../../packages/api/src/utils/b2b-response'

export const GET = withB2BAuth(async (_request, context) => {
  return successResponse({
    status: 'ok',
    storeId: context.storeId,
    timestamp: new Date().toISOString(),
  })
})
