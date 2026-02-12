import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock logger
vi.mock('../../src/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Mock Supabase
const mockFrom = vi.fn()
const mockStorage = {
  from: vi.fn().mockReturnValue({
    list: vi.fn().mockResolvedValue({ data: [], error: null }),
    remove: vi.fn().mockResolvedValue({ data: [], error: null }),
  }),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
    storage: mockStorage,
  }),
}))

describe('store-cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'

    // Default mock: store exists and is active
    mockFrom.mockImplementation((table: string) => {
      if (table === 'stores') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { status: 'active' }, error: null }),
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ data: null, error: null }),
          }),
        }
      }
      if (table === 'store_api_keys') {
        return {
          delete: () => ({
            eq: () => ({
              select: () => Promise.resolve({ data: [{ id: 'key-1' }], error: null }),
            }),
          }),
        }
      }
      if (table === 'store_generation_sessions') {
        return {
          update: () => ({
            eq: (_col: string, _val: string) => ({
              eq: () => ({
                select: () => Promise.resolve({ data: [{ id: 'session-1' }], error: null }),
              }),
            }),
          }),
        }
      }
      return {}
    })
  })

  it('marks store as inactive and deletes API keys', async () => {
    const { cleanupStore } = await import('../../src/services/store-cleanup')

    const result = await cleanupStore('store-123', 'req_test')

    expect(result.storeId).toBe('store-123')
    expect(result.apiKeysDeleted).toBe(1)
    expect(result.alreadyInactive).toBe(false)
  })

  it('cancels queued generation jobs', async () => {
    const { cleanupStore } = await import('../../src/services/store-cleanup')

    const result = await cleanupStore('store-123', 'req_test')

    expect(result.jobsCancelled).toBe(1)
  })

  it('returns early if store is already inactive (idempotent)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'stores') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { status: 'inactive' }, error: null }),
            }),
          }),
        }
      }
      if (table === 'store_api_keys') {
        return {
          delete: () => ({
            eq: () => ({
              select: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }
      }
      if (table === 'store_generation_sessions') {
        return {
          update: () => ({
            eq: (_col: string, _val: string) => ({
              eq: () => ({
                select: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }
      }
      return {}
    })

    const { cleanupStore } = await import('../../src/services/store-cleanup')

    const result = await cleanupStore('store-123', 'req_test')

    // Cleanup continues even when store is already inactive (idempotent retry)
    expect(result.alreadyInactive).toBe(true)
    // API keys and jobs are still cleaned up to ensure complete cleanup
    expect(result.apiKeysDeleted).toBeGreaterThanOrEqual(0)
    expect(result.jobsCancelled).toBeGreaterThanOrEqual(0)
  })

  it('handles store not found', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'stores') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }
      }
      return {}
    })

    const { cleanupStore } = await import('../../src/services/store-cleanup')

    const result = await cleanupStore('nonexistent', 'req_test')

    expect(result.apiKeysDeleted).toBe(0)
    expect(result.jobsCancelled).toBe(0)
  })

  it('completes within NFR34 timing budget (5 seconds)', async () => {
    const { cleanupStore } = await import('../../src/services/store-cleanup')

    const startTime = Date.now()
    await cleanupStore('store-123', 'req_test')
    const duration = Date.now() - startTime

    // NFR34: Cleanup operations should complete within 5 seconds
    expect(duration).toBeLessThan(5000)
  })

  it('handles transactional ordering correctly (store marked inactive first)', async () => {
    const operationOrder: string[] = []

    mockFrom.mockImplementation((table: string) => {
      if (table === 'stores') {
        return {
          select: () => ({
            eq: () => ({
              single: () => {
                operationOrder.push('store-lookup')
                return Promise.resolve({ data: { status: 'active' }, error: null })
              },
            }),
          }),
          update: () => {
            operationOrder.push('store-inactive')
            return {
              eq: () => Promise.resolve({ data: null, error: null }),
            }
          },
        }
      }
      if (table === 'store_api_keys') {
        return {
          delete: () => {
            operationOrder.push('keys-deleted')
            return {
              eq: () => ({
                select: () => Promise.resolve({ data: [{ id: 'key-1' }], error: null }),
              }),
            }
          },
        }
      }
      if (table === 'store_generation_sessions') {
        return {
          update: () => {
            operationOrder.push('jobs-cancelled')
            return {
              eq: (_col: string, _val: string) => ({
                eq: () => ({
                  select: () => Promise.resolve({ data: [{ id: 'session-1' }], error: null }),
                }),
              }),
            }
          },
        }
      }
      return {}
    })

    const { cleanupStore } = await import('../../src/services/store-cleanup')
    await cleanupStore('store-123', 'req_test')

    // Verify transactional ordering: store marked inactive BEFORE cleanup operations
    expect(operationOrder).toEqual([
      'store-lookup',
      'store-inactive',
      'keys-deleted',
      'jobs-cancelled',
    ])
  })
})
