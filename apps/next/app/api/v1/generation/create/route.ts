import { NextResponse } from 'next/server'
import { withB2BAuth } from '../../../../../../packages/api/src/middleware/b2b'

export const POST = withB2BAuth(async () => {
  return NextResponse.json(
    { data: null, error: { code: 'NOT_IMPLEMENTED', message: 'Endpoint coming in a future release' } },
    { status: 501 },
  )
})
