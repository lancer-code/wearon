import { NextResponse } from 'next/server'
import { forbiddenResponse } from '../utils/b2b-response'

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Request-Id',
  'Access-Control-Max-Age': '86400',
}

function isOriginAllowed(origin: string, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) {
    return true
  }
  return allowedDomains.includes(origin)
}

export function checkCors(request: Request, allowedDomains: string[]): NextResponse | null {
  const origin = request.headers.get('origin')

  // No Origin header = server-to-server call (e.g., Shopify app proxy) — allow
  if (!origin) {
    return null
  }

  if (!isOriginAllowed(origin, allowedDomains)) {
    return forbiddenResponse('Origin not allowed for this API key')
  }

  // Origin is valid — CORS headers will be added by the composite middleware
  return null
}

export function handlePreflight(request: Request, allowedDomains: string[]): NextResponse | null {
  if (request.method !== 'OPTIONS') {
    return null
  }

  const origin = request.headers.get('origin')

  if (!origin) {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
  }

  if (!isOriginAllowed(origin, allowedDomains)) {
    return forbiddenResponse('Origin not allowed for this API key')
  }

  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      'Access-Control-Allow-Origin': origin,
    },
  })
}

export function addCorsHeaders(response: NextResponse, origin: string | null): NextResponse {
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  }
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value)
  }
  return response
}
