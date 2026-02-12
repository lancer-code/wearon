import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockInsert = vi.fn()
const mockLoggerError = vi.fn()

vi.mock('../../src/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'store_analytics_events') {
        return {
          insert: (payload: unknown) => {
            mockInsert(payload)
            return mockInsert()
          },
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  }),
}))

describe('store-analytics service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  })

  it('inserts analytics event with correct payload', async () => {
    mockInsert.mockReturnValue({ error: null })

    const { logStoreAnalyticsEvent } = await import(
      '../../src/services/store-analytics'
    )

    await logStoreAnalyticsEvent('store_123', 'generation_queued', {
      request_id: 'req_abc',
      session_id: 'sess_123',
    })

    expect(mockInsert).toHaveBeenCalledWith({
      store_id: 'store_123',
      event_type: 'generation_queued',
      metadata: { request_id: 'req_abc', session_id: 'sess_123' },
    })
  })

  it('uses empty metadata when none provided', async () => {
    mockInsert.mockReturnValue({ error: null })

    const { logStoreAnalyticsEvent } = await import(
      '../../src/services/store-analytics'
    )

    await logStoreAnalyticsEvent('store_123', 'generation_completed')

    expect(mockInsert).toHaveBeenCalledWith({
      store_id: 'store_123',
      event_type: 'generation_completed',
      metadata: {},
    })
  })

  it('logs error but does not throw on insert failure', async () => {
    mockInsert.mockReturnValue({ error: { message: 'insert failed' } })

    const { logStoreAnalyticsEvent } = await import(
      '../../src/services/store-analytics'
    )

    await expect(
      logStoreAnalyticsEvent('store_123', 'generation_failed', { reason: 'timeout' })
    ).resolves.toBeUndefined()

    expect(mockLoggerError).toHaveBeenCalled()
  })
})
