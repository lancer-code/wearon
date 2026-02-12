import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockLoggerError = vi.fn()

let generationResult: { data: unknown; error: unknown } = { data: [], error: null }
let creditsResult: { data: unknown; error: unknown } = { data: null, error: null }

vi.mock('../../../packages/api/src/middleware/b2b', () => ({
  withB2BAuth: (handler: unknown) => handler,
}))

vi.mock('../../../packages/api/src/logger', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: (...args: unknown[]) => mockLoggerError(...args),
  }),
}))

function createChainableMock(resolveValue: () => { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'gte', 'lte', 'single']
  for (const method of methods) {
    chain[method] = vi.fn().mockImplementation(() => chain)
  }
  // Make the chain thenable so `await` resolves it
  chain.then = (resolve: (val: unknown) => void) => {
    return Promise.resolve(resolveValue()).then(resolve)
  }
  return chain
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'store_generation_sessions') {
        return createChainableMock(() => generationResult)
      }
      if (table === 'store_credits') {
        return createChainableMock(() => creditsResult)
      }
      throw new Error(`Unexpected table in analytics tests: ${table}`)
    },
  }),
}))

const testContext = {
  storeId: 'store_123',
  shopDomain: 'store.myshopify.com',
  allowedDomains: ['https://store.myshopify.com'],
  subscriptionTier: 'starter',
  isActive: true,
  requestId: 'req_test_123',
}

describe('stores analytics route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

    generationResult = { data: [], error: null }
    creditsResult = { data: { balance: 0, total_purchased: 0, total_spent: 0 }, error: null }
  })

  it('GET returns analytics stats without date range', async () => {
    const { handleGetAnalytics } = await import(
      '../app/api/v1/stores/analytics/route'
    )

    generationResult = {
      data: [
        { status: 'completed' },
        { status: 'completed' },
        { status: 'completed' },
        { status: 'failed' },
        { status: 'queued' },
      ],
      error: null,
    }

    creditsResult = {
      data: { balance: 50, total_purchased: 100, total_spent: 50 },
      error: null,
    }

    const request = new Request('http://localhost/api/v1/stores/analytics')
    const response = await handleGetAnalytics(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.total_generations).toBe(5)
    expect(payload.data.completed_generations).toBe(3)
    expect(payload.data.failed_generations).toBe(1)
    expect(payload.data.success_rate).toBeCloseTo(0.6)
    expect(payload.data.credits_remaining).toBe(50)
    expect(payload.data.credits_used).toBe(50)
    expect(payload.error).toBeNull()
  })

  it('GET returns analytics with date range filtering', async () => {
    const { handleGetAnalytics } = await import(
      '../app/api/v1/stores/analytics/route'
    )

    generationResult = {
      data: [
        { status: 'completed' },
        { status: 'completed' },
      ],
      error: null,
    }

    creditsResult = {
      data: { balance: 80, total_purchased: 100, total_spent: 20 },
      error: null,
    }

    const request = new Request(
      'http://localhost/api/v1/stores/analytics?start_date=2026-02-01T00:00:00Z&end_date=2026-02-12T23:59:59Z'
    )
    const response = await handleGetAnalytics(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.total_generations).toBe(2)
    expect(payload.data.completed_generations).toBe(2)
    expect(payload.data.success_rate).toBe(1.0)
    expect(payload.error).toBeNull()
  })

  it('GET returns zero stats when no generations exist', async () => {
    const { handleGetAnalytics } = await import(
      '../app/api/v1/stores/analytics/route'
    )

    generationResult = { data: [], error: null }
    creditsResult = {
      data: { balance: 100, total_purchased: 100, total_spent: 0 },
      error: null,
    }

    const request = new Request('http://localhost/api/v1/stores/analytics')
    const response = await handleGetAnalytics(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.total_generations).toBe(0)
    expect(payload.data.completed_generations).toBe(0)
    expect(payload.data.failed_generations).toBe(0)
    expect(payload.data.success_rate).toBe(0)
    expect(payload.data.credits_remaining).toBe(100)
    expect(payload.data.credits_used).toBe(0)
  })

  it('GET returns 500 when generation query fails', async () => {
    const { handleGetAnalytics } = await import(
      '../app/api/v1/stores/analytics/route'
    )

    generationResult = {
      data: null,
      error: { message: 'database error' },
    }

    const request = new Request('http://localhost/api/v1/stores/analytics')
    const response = await handleGetAnalytics(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload.error.code).toBe('INTERNAL_ERROR')
    expect(mockLoggerError).toHaveBeenCalled()
  })

  it('GET returns 500 when credits query fails', async () => {
    const { handleGetAnalytics } = await import(
      '../app/api/v1/stores/analytics/route'
    )

    generationResult = { data: [], error: null }
    creditsResult = {
      data: null,
      error: { message: 'credits query error' },
    }

    const request = new Request('http://localhost/api/v1/stores/analytics')
    const response = await handleGetAnalytics(request, testContext)
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload.error.code).toBe('INTERNAL_ERROR')
  })
})
