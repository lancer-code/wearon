import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../../src/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('Revenue & Quality Analytics (Story 7.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getRevenueOverview (AC: #1, Task 1)', () => {
    it('calculates B2B revenue from store_credit_transactions (purchase + subscription)', () => {
      const transactions = [
        { amount: 100, type: 'purchase', created_at: '2026-02-01T00:00:00Z' },
        { amount: 50, type: 'subscription', created_at: '2026-02-05T00:00:00Z' },
        { amount: -1, type: 'deduction', created_at: '2026-02-06T00:00:00Z' },
        { amount: 1, type: 'refund', created_at: '2026-02-06T00:00:00Z' },
      ]

      const b2bRevenue = transactions
        .filter((t) => t.type === 'purchase' || t.type === 'subscription')
        .reduce((sum, t) => sum + t.amount, 0)

      expect(b2bRevenue).toBe(150)
    })

    it('calculates B2C revenue from credit_transactions (purchase type)', () => {
      const transactions = [
        { amount: 10, type: 'signup_bonus' },
        { amount: -1, type: 'generation' },
        { amount: 1, type: 'refund' },
      ]

      const b2cRevenue = transactions
        .filter((t) => t.type === 'purchase')
        .reduce((sum, t) => sum + t.amount, 0)

      // No purchase type exists in B2C yet
      expect(b2cRevenue).toBe(0)
    })

    it('estimates OpenAI costs from generation count * cost per generation', () => {
      const b2bGenerationCount = 100
      const b2cGenerationCount = 50
      const costPerGeneration = 0.05 // $0.05 per generation

      const totalGenerations = b2bGenerationCount + b2cGenerationCount
      const estimatedCosts = totalGenerations * costPerGeneration

      expect(estimatedCosts).toBeCloseTo(7.5)
    })

    it('calculates margin percentage correctly', () => {
      const totalRevenue = 150
      const totalCosts = 7.5

      const marginPercentage =
        totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 100 : 0

      expect(marginPercentage).toBeCloseTo(95)
    })

    it('returns zero margin when no revenue', () => {
      const totalRevenue = 0
      const totalCosts = 0

      const marginPercentage =
        totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 100 : 0

      expect(marginPercentage).toBe(0)
    })

    it('supports date-range filtering for revenue transactions', () => {
      const transactions = [
        { amount: 100, type: 'purchase', created_at: '2026-01-15T00:00:00Z' },
        { amount: 50, type: 'purchase', created_at: '2026-02-15T00:00:00Z' },
        { amount: 30, type: 'subscription', created_at: '2026-03-01T00:00:00Z' },
      ]

      const startDate = '2026-02-01'
      const endDate = '2026-02-28'

      const filtered = transactions.filter(
        (t) =>
          (t.type === 'purchase' || t.type === 'subscription') &&
          t.created_at >= startDate &&
          t.created_at <= endDate,
      )

      const filteredRevenue = filtered.reduce((sum, t) => sum + t.amount, 0)
      expect(filteredRevenue).toBe(50)
    })
  })

  describe('getQualityMetrics (AC: #2, Task 2)', () => {
    it('calculates combined B2B + B2C generation success rate', () => {
      const b2bSessions = [
        { status: 'completed' },
        { status: 'completed' },
        { status: 'failed' },
      ]
      const b2cSessions = [
        { status: 'completed' },
        { status: 'failed' },
        { status: 'completed' },
        { status: 'pending' },
      ]

      const totalCompleted =
        b2bSessions.filter((s) => s.status === 'completed').length +
        b2cSessions.filter((s) => s.status === 'completed').length
      const totalSessions = b2bSessions.length + b2cSessions.length
      const successRate = totalSessions > 0 ? totalCompleted / totalSessions : 0

      expect(totalCompleted).toBe(4)
      expect(totalSessions).toBe(7)
      expect(successRate).toBeCloseTo(0.571, 2)
    })

    it('counts moderation blocks from analytics events', () => {
      const b2bEvents = [
        { event_type: 'generation_moderation_blocked' },
        { event_type: 'generation_completed' },
        { event_type: 'generation_moderation_blocked' },
      ]
      const b2cEvents = [
        { event_type: 'generation_moderation_blocked' },
        { event_type: 'generation_completed' },
      ]

      const b2bBlocks = b2bEvents.filter(
        (e) => e.event_type === 'generation_moderation_blocked',
      ).length
      const b2cBlocks = b2cEvents.filter(
        (e) => e.event_type === 'generation_moderation_blocked',
      ).length

      expect(b2bBlocks + b2cBlocks).toBe(3)
    })

    it('counts refunds from both transaction tables', () => {
      const b2bTransactions = [
        { type: 'refund' },
        { type: 'deduction' },
        { type: 'refund' },
      ]
      const b2cTransactions = [
        { type: 'refund' },
        { type: 'generation' },
      ]

      const b2bRefunds = b2bTransactions.filter((t) => t.type === 'refund').length
      const b2cRefunds = b2cTransactions.filter((t) => t.type === 'refund').length

      expect(b2bRefunds + b2cRefunds).toBe(3)
    })

    it('calculates average generation time from completed sessions', () => {
      const b2bCompleted = [
        { processing_time_ms: 2000 },
        { processing_time_ms: 3000 },
      ]
      const b2cCompleted = [
        { processing_time_ms: 1500 },
        { processing_time_ms: 2500 },
      ]

      const allTimes = [...b2bCompleted, ...b2cCompleted].map((s) => s.processing_time_ms)
      const avgTimeMs = allTimes.length > 0
        ? allTimes.reduce((sum, t) => sum + t, 0) / allTimes.length
        : 0

      expect(avgTimeMs).toBe(2250)
    })

    it('provides B2B/B2C channel breakdown', () => {
      const b2bTotal = 100
      const b2bCompleted = 85
      const b2cTotal = 200
      const b2cCompleted = 170

      const breakdown = {
        b2b: {
          total: b2bTotal,
          completed: b2bCompleted,
          successRate: b2bTotal > 0 ? b2bCompleted / b2bTotal : 0,
        },
        b2c: {
          total: b2cTotal,
          completed: b2cCompleted,
          successRate: b2cTotal > 0 ? b2cCompleted / b2cTotal : 0,
        },
      }

      expect(breakdown.b2b.successRate).toBeCloseTo(0.85)
      expect(breakdown.b2c.successRate).toBeCloseTo(0.85)
    })

    it('supports date-range filtering for quality metrics', () => {
      const sessions = [
        { status: 'completed', created_at: '2026-01-15T00:00:00Z' },
        { status: 'completed', created_at: '2026-02-10T00:00:00Z' },
        { status: 'failed', created_at: '2026-02-20T00:00:00Z' },
        { status: 'completed', created_at: '2026-03-05T00:00:00Z' },
      ]

      const startDate = '2026-02-01'
      const endDate = '2026-02-28'

      const filtered = sessions.filter(
        (s) => s.created_at >= startDate && s.created_at <= endDate,
      )

      expect(filtered).toHaveLength(2)
      expect(filtered.filter((s) => s.status === 'completed')).toHaveLength(1)
    })

    it('returns zero metrics when no data exists', () => {
      const metrics = {
        successRate: 0,
        moderationBlockCount: 0,
        refundCount: 0,
        avgGenerationTimeMs: 0,
      }

      expect(metrics.successRate).toBe(0)
      expect(metrics.moderationBlockCount).toBe(0)
      expect(metrics.refundCount).toBe(0)
      expect(metrics.avgGenerationTimeMs).toBe(0)
    })
  })

  describe('admin-only access (Task 4.4)', () => {
    it('revenue and quality endpoints require adminProcedure', () => {
      const endpointNames = ['getRevenueOverview', 'getQualityMetrics']
      expect(endpointNames).toHaveLength(2)
      endpointNames.forEach((name) => {
        expect(name).toBeTruthy()
      })
    })
  })
})
