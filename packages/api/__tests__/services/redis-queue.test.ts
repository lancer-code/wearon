import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GenerationTaskPayload } from '../../src/types/queue'
import { REDIS_QUEUE_KEY } from '../../src/types/queue'

// Mock ioredis
const mockLpush = vi.fn()
const mockQuit = vi.fn()
const mockOn = vi.fn()
const mockDisconnect = vi.fn()

vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      lpush: mockLpush,
      quit: mockQuit,
      on: mockOn,
      disconnect: mockDisconnect,
      status: 'ready',
    })),
  }
})

// Mock logger
vi.mock('../../src/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

describe('redis-queue', () => {
  const testPayload: GenerationTaskPayload = {
    taskId: 'task-123',
    channel: 'b2c',
    userId: 'user-456',
    sessionId: 'session-789',
    imageUrls: ['https://example.com/model.jpg', 'https://example.com/outfit.jpg'],
    prompt: 'Virtual try-on',
    requestId: 'req_abc123',
    version: 1,
    createdAt: '2026-02-12T00:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.REDIS_URL = 'redis://localhost:6379'
    // Reset the module to clear cached connection
    vi.resetModules()
  })

  afterEach(() => {
    delete process.env.REDIS_URL
  })

  it('pushGenerationTask calls LPUSH with correct key and snake_case JSON', async () => {
    const { pushGenerationTask } = await import('../../src/services/redis-queue')

    mockLpush.mockResolvedValue(1)

    await pushGenerationTask(testPayload)

    expect(mockLpush).toHaveBeenCalledTimes(1)
    expect(mockLpush).toHaveBeenCalledWith(REDIS_QUEUE_KEY, expect.any(String))

    // Verify the payload is snake_case JSON
    const jsonArg = mockLpush.mock.calls[0][1] as string
    const parsed = JSON.parse(jsonArg)

    expect(parsed.task_id).toBe('task-123')
    expect(parsed.channel).toBe('b2c')
    expect(parsed.user_id).toBe('user-456')
    expect(parsed.session_id).toBe('session-789')
    expect(parsed.image_urls).toEqual(['https://example.com/model.jpg', 'https://example.com/outfit.jpg'])
    expect(parsed.request_id).toBe('req_abc123')
    expect(parsed.version).toBe(1)
    expect(parsed.created_at).toBe('2026-02-12T00:00:00Z')
  })

  it('throws error when REDIS_URL is not set', async () => {
    delete process.env.REDIS_URL

    const { pushGenerationTask } = await import('../../src/services/redis-queue')

    await expect(pushGenerationTask(testPayload)).rejects.toThrow('REDIS_URL environment variable is not set')
  })

  it('throws "Redis queue unavailable" when LPUSH fails', async () => {
    const { pushGenerationTask } = await import('../../src/services/redis-queue')

    mockLpush.mockRejectedValue(new Error('Connection refused'))

    await expect(pushGenerationTask(testPayload)).rejects.toThrow('Redis queue unavailable')
  })

  it('closeRedisQueue calls quit on the connection', async () => {
    const { pushGenerationTask, closeRedisQueue } = await import('../../src/services/redis-queue')

    mockLpush.mockResolvedValue(1)
    await pushGenerationTask(testPayload) // Initialize connection

    mockQuit.mockResolvedValue('OK')
    await closeRedisQueue()

    expect(mockQuit).toHaveBeenCalledTimes(1)
  })

  it('closeRedisQueue is safe to call when no connection exists', async () => {
    const { closeRedisQueue } = await import('../../src/services/redis-queue')

    // Should not throw
    await closeRedisQueue()
    expect(mockQuit).not.toHaveBeenCalled()
  })
})
