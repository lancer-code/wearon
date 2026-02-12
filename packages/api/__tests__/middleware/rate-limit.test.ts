import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock ioredis
const mockIncr = vi.fn()
const mockExpire = vi.fn()
const mockQuit = vi.fn()

vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      status: 'ready',
      incr: mockIncr,
      expire: mockExpire,
      quit: mockQuit,
      disconnect: vi.fn(),
    })),
  }
})

// Set env before import
process.env.REDIS_URL = 'redis://localhost:6379'

import { checkRateLimit } from '../../src/middleware/rate-limit'

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows request under the limit with correct headers', async () => {
    mockIncr.mockResolvedValue(3)

    const result = await checkRateLimit('store_123', 'starter')

    expect(result.allowed).toBe(true)
    if (result.allowed) {
      expect(result.headers.limit).toBe(10) // starter maxRequestsPerMinute
      expect(result.headers.remaining).toBe(7) // 10 - 3
      expect(result.headers.reset).toBeGreaterThan(0)
    }
  })

  it('sets TTL on first increment (count === 1)', async () => {
    mockIncr.mockResolvedValue(1)

    await checkRateLimit('store_123', 'growth')

    expect(mockExpire).toHaveBeenCalledOnce()
    expect(mockExpire).toHaveBeenCalledWith(expect.any(String), 120)
  })

  it('does not set TTL on subsequent increments', async () => {
    mockIncr.mockResolvedValue(5)

    await checkRateLimit('store_123', 'growth')

    expect(mockExpire).not.toHaveBeenCalled()
  })

  it('returns 429 when over limit', async () => {
    mockIncr.mockResolvedValue(11) // starter limit is 10

    const result = await checkRateLimit('store_123', 'starter')

    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      const body = await result.response.json()
      expect(result.response.status).toBe(429)
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(result.response.headers.get('X-RateLimit-Limit')).toBe('10')
      expect(result.response.headers.get('X-RateLimit-Remaining')).toBe('0')
    }
  })

  it('uses default tier for unknown subscription tier', async () => {
    mockIncr.mockResolvedValue(3)

    const result = await checkRateLimit('store_123', 'unknown_tier')

    expect(result.allowed).toBe(true)
    if (result.allowed) {
      expect(result.headers.limit).toBe(5) // default maxRequestsPerMinute
    }
  })

  it('uses default tier for null subscription tier', async () => {
    mockIncr.mockResolvedValue(1)

    const result = await checkRateLimit('store_123', null)

    expect(result.allowed).toBe(true)
    if (result.allowed) {
      expect(result.headers.limit).toBe(5) // default maxRequestsPerMinute
    }
  })

  it('allows request through when Redis fails (fail-open)', async () => {
    mockIncr.mockRejectedValue(new Error('Redis connection failed'))

    const result = await checkRateLimit('store_123', 'starter')

    expect(result.allowed).toBe(true)
    if (result.allowed) {
      expect(result.headers.limit).toBe(10) // starter limit
      expect(result.headers.remaining).toBe(10) // full limit available
    }
  })

  it('different tiers have different limits', async () => {
    mockIncr.mockResolvedValue(1)

    const starterResult = await checkRateLimit('store_1', 'starter')
    const enterpriseResult = await checkRateLimit('store_2', 'enterprise')

    expect(starterResult.allowed).toBe(true)
    expect(enterpriseResult.allowed).toBe(true)

    if (starterResult.allowed && enterpriseResult.allowed) {
      expect(starterResult.headers.limit).toBe(10)
      expect(enterpriseResult.headers.limit).toBe(500)
    }
  })
})
