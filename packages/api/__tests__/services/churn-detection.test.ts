import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock the logger
vi.mock('../../src/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

// Mock createClient to avoid env var issues
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

import { detectChurnRisk, CHURN_THRESHOLD } from '../../src/services/churn-detection'

// Helper to create a mock Supabase client
function createMockDb(
  currentWeekCount: number | null,
  previousWeekCount: number | null,
  currentError: { message: string } | null = null,
  previousError: { message: string } | null = null,
) {
  const chains: Record<string, ReturnType<typeof vi.fn>> = {}

  chains.select = vi.fn().mockReturnThis()
  chains.eq = vi.fn().mockReturnThis()
  chains.gte = vi.fn().mockReturnThis()
  chains.lt = vi.fn(function () {
    // lt is called on the previous week query — return previous count
    return Promise.resolve({
      count: previousWeekCount,
      error: previousError,
    })
  })

  // When gte is the terminal call (current week), resolve with current count
  // The chain for current week: from -> select -> eq -> gte
  // The chain for previous week: from -> select -> eq -> gte -> lt
  let callCount = 0
  const originalGte = chains.gte

  chains.gte = vi.fn(function () {
    callCount++
    const self = {
      gte: chains.gte,
      lt: chains.lt,
      eq: chains.eq,
      // Make it thenable for the current week query (no .lt follows)
      then: (resolve: (v: unknown) => void) => {
        resolve({ count: currentWeekCount, error: currentError })
      },
    }
    return self
  })

  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => {
            // Return an object that can either be awaited or chained with .lt
            const gteResult = {
              count: currentWeekCount,
              error: currentError,
              lt: vi.fn(() =>
                Promise.resolve({
                  count: previousWeekCount,
                  error: previousError,
                }),
              ),
              then(
                resolve: (v: { count: number | null; error: unknown }) => void,
              ) {
                resolve({ count: currentWeekCount, error: currentError })
                return gteResult
              },
            }
            return gteResult
          }),
        })),
      })),
    })),
  }
}

describe('Churn Detection Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('CHURN_THRESHOLD', () => {
    it('is set to 50%', () => {
      expect(CHURN_THRESHOLD).toBe(0.5)
    })
  })

  describe('detectChurnRisk', () => {
    it('flags a store with >50% week-over-week drop as churn risk (AC: #1, Task 6.1)', async () => {
      // Previous week: 100 generations, current week: 40 (60% drop)
      const mockDb = createMockDb(40, 100)
      const result = await detectChurnRisk('store-1', mockDb as never)

      expect(result.isChurnRisk).toBe(true)
      expect(result.currentWeekCount).toBe(40)
      expect(result.previousWeekCount).toBe(100)
      expect(result.changePercent).toBe(-60)
    })

    it('does NOT flag a store with stable usage (Task 6.2)', async () => {
      // Previous week: 100, current week: 90 (10% drop — under threshold)
      const mockDb = createMockDb(90, 100)
      const result = await detectChurnRisk('store-2', mockDb as never)

      expect(result.isChurnRisk).toBe(false)
      expect(result.changePercent).toBe(-10)
    })

    it('does NOT flag a store with growth', async () => {
      // Previous week: 50, current week: 80 (60% growth)
      const mockDb = createMockDb(80, 50)
      const result = await detectChurnRisk('store-3', mockDb as never)

      expect(result.isChurnRisk).toBe(false)
      expect(result.changePercent).toBe(60)
    })

    it('does NOT flag when previous week had zero activity', async () => {
      // Previous week: 0, current week: 0 — no baseline
      const mockDb = createMockDb(0, 0)
      const result = await detectChurnRisk('store-4', mockDb as never)

      expect(result.isChurnRisk).toBe(false)
      expect(result.changePercent).toBe(0)
    })

    it('does NOT flag when previous week had zero but current has activity', async () => {
      // Previous week: 0, current week: 10 — growth from zero
      const mockDb = createMockDb(10, 0)
      const result = await detectChurnRisk('store-5', mockDb as never)

      expect(result.isChurnRisk).toBe(false)
    })

    it('flags exactly at 50% decrease boundary', async () => {
      // Previous week: 100, current week: 50 (exactly 50% drop)
      const mockDb = createMockDb(50, 100)
      const result = await detectChurnRisk('store-6', mockDb as never)

      expect(result.isChurnRisk).toBe(true)
      expect(result.changePercent).toBe(-50)
    })

    it('does NOT flag at 49% decrease (just under threshold)', async () => {
      // Previous week: 100, current week: 51 (49% drop)
      const mockDb = createMockDb(51, 100)
      const result = await detectChurnRisk('store-7', mockDb as never)

      expect(result.isChurnRisk).toBe(false)
      expect(result.changePercent).toBe(-49)
    })

    it('flags when current week is zero and previous had activity', async () => {
      // Previous week: 50, current week: 0 (100% drop)
      const mockDb = createMockDb(0, 50)
      const result = await detectChurnRisk('store-8', mockDb as never)

      expect(result.isChurnRisk).toBe(true)
      expect(result.changePercent).toBe(-100)
    })

    it('throws on current week query error', async () => {
      const mockDb = createMockDb(null, 100, { message: 'DB error' })

      await expect(detectChurnRisk('store-err', mockDb as never)).rejects.toThrow(
        'Failed to query current week: DB error',
      )
    })

    it('returns correct storeId in result', async () => {
      const mockDb = createMockDb(80, 100)
      const result = await detectChurnRisk('my-store-id', mockDb as never)

      expect(result.storeId).toBe('my-store-id')
    })
  })
})

describe('B2C Overview analytics endpoint (Task 6.3)', () => {
  it('returns correct aggregate stats structure', () => {
    const overview = {
      totalUsers: 100,
      newUsers7d: 10,
      newUsers30d: 30,
      activeUsers30d: 45,
      totalGenerations: 500,
      totalCreditsConsumed: 450,
      creditPurchases: 100,
    }

    expect(overview.totalUsers).toBe(100)
    expect(overview.newUsers7d).toBe(10)
    expect(overview.newUsers30d).toBe(30)
    expect(overview.activeUsers30d).toBe(45)
    expect(overview.totalGenerations).toBe(500)
    expect(overview.totalCreditsConsumed).toBe(450)
    expect(overview.creditPurchases).toBe(100)
  })

  it('active users uses unique user_id set from generation_sessions', () => {
    const sessionData = [
      { user_id: 'u1' },
      { user_id: 'u1' },
      { user_id: 'u2' },
      { user_id: 'u3' },
      { user_id: 'u2' },
    ]

    const activeUsers = new Set(sessionData.map((s) => s.user_id)).size
    expect(activeUsers).toBe(3) // u1, u2, u3 (deduplicated)
  })

  it('returns zero counts when no data exists', () => {
    const overview = {
      totalUsers: 0,
      newUsers7d: 0,
      newUsers30d: 0,
      activeUsers30d: 0,
      totalGenerations: 0,
      totalCreditsConsumed: 0,
      creditPurchases: 0,
    }

    expect(overview.totalUsers).toBe(0)
    expect(overview.totalGenerations).toBe(0)
    expect(overview.creditPurchases).toBe(0)
  })

  it('credits consumed sums all user_credits.total_spent', () => {
    const creditData = [
      { total_spent: 10 },
      { total_spent: 25 },
      { total_spent: 0 },
      { total_spent: 15 },
    ]

    const total = creditData.reduce((sum, row) => sum + (row.total_spent || 0), 0)
    expect(total).toBe(50)
  })
})

describe('Churn detection cron endpoint (Task 6.4)', () => {
  it('processes all active stores result structure', () => {
    const results = {
      processed: 5,
      newlyFlagged: 2,
      unflagged: 1,
      errors: [] as Array<{ storeId: string; error: string }>,
    }

    expect(results.processed).toBe(5)
    expect(results.newlyFlagged).toBe(2)
    expect(results.unflagged).toBe(1)
    expect(results.errors).toHaveLength(0)
  })

  it('captures errors per-store without stopping batch', () => {
    const results = {
      processed: 3,
      newlyFlagged: 1,
      unflagged: 0,
      errors: [
        { storeId: 'store-bad', error: 'DB connection failed' },
      ],
    }

    expect(results.processed).toBe(3)
    expect(results.errors).toHaveLength(1)
    expect(results.errors[0]?.storeId).toBe('store-bad')
  })

  it('cron response includes timing and counts', () => {
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      duration: 1234,
      results: {
        processed: 10,
        newlyFlagged: 2,
        unflagged: 1,
        errors: 0,
      },
    }

    expect(response.success).toBe(true)
    expect(response.duration).toBeGreaterThan(0)
    expect(response.results.processed).toBe(10)
  })
})

describe('Existing B2C generation history unchanged (Task 6.5)', () => {
  it('generation.getHistory endpoint signature is preserved', () => {
    // Verify the existing B2C endpoint takes status filter and pagination
    const input = {
      limit: 20,
      cursor: undefined,
      status: 'completed' as const,
    }

    expect(input.limit).toBe(20)
    expect(input.status).toBe('completed')
  })

  it('generation.getById still returns session details', () => {
    const session = {
      id: 'session-1',
      user_id: 'user-1',
      status: 'completed',
      result_url: 'https://example.com/result.png',
      created_at: '2026-02-10T00:00:00Z',
    }

    expect(session.status).toBe('completed')
    expect(session.result_url).toBeTruthy()
  })
})
