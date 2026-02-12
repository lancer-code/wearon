import { randomUUID } from 'node:crypto'

export const REQUEST_ID_HEADER = 'X-Request-Id'

export function extractRequestId(request: Request): string {
  const existing = request.headers.get(REQUEST_ID_HEADER)
  if (existing) {
    return existing
  }
  return `req_${randomUUID()}`
}
