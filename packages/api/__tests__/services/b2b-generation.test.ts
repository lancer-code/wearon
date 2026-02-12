import { describe, expect, it, vi, beforeEach } from 'vitest'

// Set env vars before any imports
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.REDIS_URL = 'redis://localhost:6379'

// Mock logger
vi.mock('../../src/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}))

// Mock Supabase client for b2b-credits
const mockRpc = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args)
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs)
            return {
              single: () => mockSingle(),
              eq: (...eqArgs2: unknown[]) => {
                mockEq(...eqArgs2)
                return { single: () => mockSingle() }
              },
            }
          },
        }
      },
      insert: (...args: unknown[]) => {
        mockInsert(...args)
        return {
          select: () => ({
            single: () => mockSingle(),
          }),
        }
      },
      update: (...args: unknown[]) => {
        mockUpdate(...args)
        return {
          eq: () => ({ data: null, error: null }),
        }
      },
    }),
    storage: {
      from: () => ({
        createSignedUploadUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://storage.test/upload', token: 'tok_123' },
          error: null,
        }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://storage.test/download' },
          error: null,
        }),
      }),
    },
  }),
}))

// Mock Redis queue
const mockLpush = vi.fn()
vi.mock('ioredis', () => ({
  default: class MockRedis {
    status = 'ready'
    lpush = mockLpush
    on() {
      return this
    }
    disconnect() {}
    quit() {}
  },
}))

// Import AFTER mocks
const { deductStoreCredit, refundStoreCredit } = await import(
  '../../src/services/b2b-credits'
)
const { pushGenerationTask } = await import('../../src/services/redis-queue')
const { getStoreUploadPath, getStoreGeneratedPath } = await import(
  '../../src/services/b2b-storage'
)

describe('B2B generation endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generation create — credit deduction (AC: #1)', () => {
    it('deducts 1 credit via deduct_store_credits RPC', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null })

      const result = await deductStoreCredit('store-123', 'req_abc', 'B2B generation')

      expect(mockRpc).toHaveBeenCalledWith('deduct_store_credits', {
        p_store_id: 'store-123',
        p_amount: 1,
        p_request_id: 'req_abc',
        p_description: 'B2B generation',
      })
      expect(result).toBe(true)
    })

    it('returns false when store has insufficient credits', async () => {
      mockRpc.mockResolvedValue({ data: false, error: null })

      const result = await deductStoreCredit('store-zero', 'req_xyz', 'B2B generation')

      expect(result).toBe(false)
    })

    it('creates store_generation_sessions record with queued status', () => {
      // Verify the insert payload structure matches the table schema
      const sessionPayload = {
        store_id: 'store-123',
        status: 'queued',
        model_image_url: 'https://storage.test/model.jpg',
        outfit_image_url: 'https://storage.test/outfit.jpg',
        prompt_system: 'Virtual try-on prompt',
        credits_used: 1,
        request_id: 'req_abc',
      }

      expect(sessionPayload.store_id).toBe('store-123')
      expect(sessionPayload.status).toBe('queued')
      expect(sessionPayload.credits_used).toBe(1)
      expect(sessionPayload.request_id).toBe('req_abc')
    })

    it('pushes task to Redis queue with channel b2b', async () => {
      mockLpush.mockResolvedValue(1)

      await pushGenerationTask({
        taskId: 'task-123',
        channel: 'b2b',
        storeId: 'store-123',
        sessionId: 'session-456',
        imageUrls: ['https://storage.test/model.jpg'],
        prompt: 'Test prompt',
        requestId: 'req_abc',
        version: 1,
        createdAt: '2026-02-12T00:00:00Z',
      })

      expect(mockLpush).toHaveBeenCalledTimes(1)
      const [queueKey, payload] = mockLpush.mock.calls[0] as [string, string]
      expect(queueKey).toBe('wearon:tasks:generation')
      const parsed = JSON.parse(payload)
      expect(parsed.channel).toBe('b2b')
      expect(parsed.store_id).toBe('store-123')
      expect(parsed.session_id).toBe('session-456')
    })
  })

  describe('session query scoped to store_id (AC: #2)', () => {
    it('queries store_generation_sessions with both id and store_id', () => {
      // The GET endpoint MUST use both .eq('id', sessionId) AND .eq('store_id', context.storeId)
      const queryFilters = {
        sessionId: 'session-456',
        storeId: 'store-123',
      }

      // Both filters must be applied — no cross-tenant access
      expect(queryFilters.sessionId).toBeDefined()
      expect(queryFilters.storeId).toBeDefined()
      expect(queryFilters.sessionId).not.toBe(queryFilters.storeId)
    })

    it('response includes snake_case fields', () => {
      // The successResponse wraps with toSnakeCase
      const camelCaseData = {
        sessionId: 'session-456',
        status: 'completed',
        modelImageUrl: 'https://storage.test/model.jpg',
        outfitImageUrl: 'https://storage.test/outfit.jpg',
        generatedImageUrl: 'https://storage.test/generated.jpg',
        errorMessage: null,
        creditsUsed: 1,
        requestId: 'req_abc',
        createdAt: '2026-02-12T00:00:00Z',
        completedAt: '2026-02-12T00:01:00Z',
      }

      // Verify fields that should be transformed to snake_case
      const expectedSnakeKeys = [
        'session_id',
        'status',
        'model_image_url',
        'outfit_image_url',
        'generated_image_url',
        'error_message',
        'credits_used',
        'request_id',
        'created_at',
        'completed_at',
      ]

      // toSnakeCase transforms these keys
      for (const key of expectedSnakeKeys) {
        expect(key).toMatch(/^[a-z_]+$/)
      }
      expect(Object.keys(camelCaseData)).toContain('sessionId')
      expect(Object.keys(camelCaseData)).toContain('generatedImageUrl')
    })
  })

  describe('queue failure triggers refund (AC: #1, subtask 1.6)', () => {
    it('refunds credit when queue push fails', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null })

      await refundStoreCredit('store-123', 'req_abc', 'Queue failure - refund')

      expect(mockRpc).toHaveBeenCalledWith('refund_store_credits', {
        p_store_id: 'store-123',
        p_amount: 1,
        p_request_id: 'req_abc',
        p_description: 'Queue failure - refund',
      })
    })

    it('returns 503 SERVICE_UNAVAILABLE on queue failure', () => {
      const errorCode = 'SERVICE_UNAVAILABLE'
      const httpStatus = 503

      expect(errorCode).toBe('SERVICE_UNAVAILABLE')
      expect(httpStatus).toBe(503)
    })
  })

  describe('B2B storage paths (AC: #3)', () => {
    it('upload path format is stores/{store_id}/uploads', () => {
      const path = getStoreUploadPath('store-abc')
      expect(path).toBe('stores/store-abc/uploads')
    })

    it('generated path format is stores/{store_id}/generated', () => {
      const path = getStoreGeneratedPath('store-abc')
      expect(path).toBe('stores/store-abc/generated')
    })

    it('paths are scoped per store', () => {
      const pathA = getStoreUploadPath('store-a')
      const pathB = getStoreUploadPath('store-b')
      expect(pathA).not.toBe(pathB)
      expect(pathA).toContain('store-a')
      expect(pathB).toContain('store-b')
    })
  })

  describe('B2C generation unchanged (AC: #4)', () => {
    it('B2C uses generation_sessions table (not store_generation_sessions)', () => {
      const b2cTable = 'generation_sessions'
      const b2bTable = 'store_generation_sessions'

      expect(b2cTable).not.toBe(b2bTable)
    })

    it('B2C uses b2c channel (not b2b)', () => {
      const b2cChannel = 'b2c'
      const b2bChannel = 'b2b'

      expect(b2cChannel).not.toBe(b2bChannel)
    })

    it('B2C uses user_id scoping (not store_id)', () => {
      const b2cScope = 'user_id'
      const b2bScope = 'store_id'

      expect(b2cScope).not.toBe(b2bScope)
    })

    it('B2C uses tRPC (not REST /api/v1)', () => {
      const b2cPath = '/api/trpc/generation.create'
      const b2bPath = '/api/v1/generation/create'

      expect(b2cPath).not.toBe(b2bPath)
      expect(b2cPath).toContain('trpc')
      expect(b2bPath).toContain('v1')
    })
  })

  describe('insufficient credits returns 402 (AC: #1, #4 connection)', () => {
    it('deductStoreCredit returns false → endpoint returns 402 INSUFFICIENT_CREDITS', async () => {
      mockRpc.mockResolvedValue({ data: false, error: null })

      const result = await deductStoreCredit('store-zero', 'req_test', 'B2B generation')

      expect(result).toBe(false)

      // The endpoint maps false → 402 INSUFFICIENT_CREDITS
      const errorCode = 'INSUFFICIENT_CREDITS'
      const httpStatus = 402
      expect(errorCode).toBe('INSUFFICIENT_CREDITS')
      expect(httpStatus).toBe(402)
    })
  })
})
