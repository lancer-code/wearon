import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { data: null, error: { code: 'NOT_IMPLEMENTED', message: 'Endpoint coming in a future release' } },
    { status: 501 },
  )
}
