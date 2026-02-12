import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock ioredis with pipeline support
const mockExpire = vi.fn()
const mockQuit = vi.fn()
const mockExec = vi.fn()
const mockPipelineIncr = vi.fn()

const mockPipeline = vi.fn().mockImplementation(() => ({
  incr: mockPipelineIncr,
  exec: mockExec,
}))

vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      status: 'ready',
      pipeline: mockPipeline,
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
    // Pipeline.exec() returns [[err, minuteCount], [err, hourCount]]
    mockExec.mockResolvedValue([
      [null, 3], // minute count
      [null, 3], // hour count
    ])
    mockPipelineIncr.mockReturnThis()

    const result = await checkRateLimit('store_123', 'starter')

    expect(result.allowed).toBe(true)
    if (result.allowed) {
      expect(result.headers.limit).toBe(10) // starter maxRequestsPerMinute
      expect(result.headers.remaining).toBe(7) // 10 - 3
      expect(result.headers.reset).toBeGreaterThan(0)
    }
  })

  it('sets TTL on first increment (count === 1)', async () => {
    mockExec.mockResolvedValue([
      [null, 1], // minute count = 1 (first request)
      [null, 1], // hour count = 1 (first request)
    ])
    mockPipelineIncr.mockReturnThis()

    await checkRateLimit('store_123', 'growth')

    // Should set TTL for both minute and hour windows
    expect(mockExpire).toHaveBeenCalledTimes(2)
    expect(mockExpire).toHaveBeenCalledWith(expect.stringContaining('minute'), 120)
    expect(mockExpire).toHaveBeenCalledWith(expect.stringContaining('hour'), 7200)
  })

  it('does not set TTL on subsequent increments', async () => {
    mockExec.mockResolvedValue([
      [null, 5], // minute count > 1
      [null, 5], // hour count > 1
    ])
    mockPipelineIncr.mockReturnThis()

    await checkRateLimit('store_123', 'growth')

    // TTL not set because count > 1
    expect(mockExpire).not.toHaveBeenCalled()
  })

  it('returns 429 when over minute limit', async () => {
    mockExec.mockResolvedValue([
      [null, 11], // minute count exceeds starter limit of 10
      [null, 11], // hour count still under limit of 100
    ])
    mockPipelineIncr.mockReturnThis()

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
    mockExec.mockResolvedValue([
      [null, 3],
      [null, 3],
    ])
    mockPipelineIncr.mockReturnThis()

    const result = await checkRateLimit('store_123', 'unknown_tier')

    expect(result.allowed).toBe(true)
    if (result.allowed) {
      expect(result.headers.limit).toBe(5) // default maxRequestsPerMinute
    }
  })

  it('uses default tier for null subscription tier', async () => {
    mockExec.mockResolvedValue([
      [null, 1],
      [null, 1],
    ])
    mockPipelineIncr.mockReturnThis()

    const result = await checkRateLimit('store_123', null)

    expect(result.allowed).toBe(true)
    if (result.allowed) {
      expect(result.headers.limit).toBe(5) // default maxRequestsPerMinute
    }
  })

  it('allows request through when Redis fails (fail-open)', async () => {
    mockExec.mockRejectedValue(new Error('Redis connection failed'))
    mockPipelineIncr.mockReturnThis()

    const result = await checkRateLimit('store_123', 'starter')

    expect(result.allowed).toBe(true)
    if (result.allowed) {
      expect(result.headers.limit).toBe(10) // starter limit
      expect(result.headers.remaining).toBe(10) // full limit available
    }
  })

  it('different tiers have different limits', async () => {
    mockExec.mockResolvedValue([
      [null, 1],
      [null, 1],
    ])
    mockPipelineIncr.mockReturnThis()

    const starterResult = await checkRateLimit('store_1', 'starter')
    const enterpriseResult = await checkRateLimit('store_2', 'enterprise')

    expect(starterResult.allowed).toBe(true)
    expect(enterpriseResult.allowed).toBe(true)

    if (starterResult.allowed && enterpriseResult.allowed) {
      expect(starterResult.headers.limit).toBe(10)
      expect(enterpriseResult.headers.limit).toBe(500)
    }
  })

  it('returns 429 when hour limit exceeded even if minute limit OK', async () => {
    mockExec.mockResolvedValue([
      [null, 5], // minute count under starter limit of 10
      [null, 101], // hour count exceeds starter limit of 100
    ])
    mockPipelineIncr.mockReturnThis()

    const result = await checkRateLimit('store_123', 'starter')

    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      const body = await result.response.json()
      expect(result.response.status).toBe(429)
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(body.error.message).toContain('Hourly')
    }
  })
})
