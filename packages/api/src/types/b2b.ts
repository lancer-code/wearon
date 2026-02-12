export interface B2BContext {
  storeId: string
  shopDomain: string
  allowedDomains: string[]
  subscriptionTier: string | null
  isActive: boolean
  requestId: string
}

export type B2BErrorCode =
  | 'INVALID_API_KEY'
  | 'DOMAIN_MISMATCH'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INSUFFICIENT_CREDITS'
  | 'MODERATION_BLOCKED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'NOT_IMPLEMENTED'

export interface B2BResponse<T> {
  data: T | null
  error: { code: B2BErrorCode; message: string } | null
}

export interface RateLimitTier {
  maxRequestsPerHour: number
  maxRequestsPerMinute: number
}

export interface RateLimitHeaders {
  limit: number
  remaining: number
  reset: number
}

export const RATE_LIMIT_TIERS: Record<string, RateLimitTier> = {
  starter: { maxRequestsPerHour: 100, maxRequestsPerMinute: 10 },
  growth: { maxRequestsPerHour: 500, maxRequestsPerMinute: 30 },
  scale: { maxRequestsPerHour: 2000, maxRequestsPerMinute: 100 },
  enterprise: { maxRequestsPerHour: 10000, maxRequestsPerMinute: 500 },
  default: { maxRequestsPerHour: 50, maxRequestsPerMinute: 5 },
}
