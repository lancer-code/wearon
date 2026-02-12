import { NextResponse } from 'next/server'
import type { B2BErrorCode } from '../types/b2b'
import { toSnakeCase } from './snake-case'

export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data: toSnakeCase(data), error: null }, { status })
}

export function errorResponse(code: B2BErrorCode, message: string, status: number): NextResponse {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

export function rateLimitResponse(
  code: B2BErrorCode,
  message: string,
  headers: { limit: number; remaining: number; reset: number },
): NextResponse {
  return new NextResponse(JSON.stringify({ data: null, error: { code, message } }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(headers.limit),
      'X-RateLimit-Remaining': String(headers.remaining),
      'X-RateLimit-Reset': String(headers.reset),
    },
  })
}

export function unauthorizedResponse(message = 'Invalid or missing API key'): NextResponse {
  return errorResponse('INVALID_API_KEY', message, 401)
}

export function forbiddenResponse(message = 'Access denied'): NextResponse {
  return errorResponse('DOMAIN_MISMATCH', message, 403)
}

export function notFoundResponse(message = 'Resource not found'): NextResponse {
  return errorResponse('NOT_FOUND', message, 404)
}

export function serviceUnavailableResponse(message = 'Service temporarily unavailable'): NextResponse {
  return errorResponse('SERVICE_UNAVAILABLE', message, 503)
}
