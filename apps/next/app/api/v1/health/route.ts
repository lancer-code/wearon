import { withB2BAuth } from '@api/middleware/b2b'
import { successResponse } from '@api/utils/b2b-response'

export const GET = withB2BAuth(async (_request, context) => {
  return successResponse({
    status: 'ok',
    storeId: context.storeId,
    timestamp: new Date().toISOString(),
  })
})
