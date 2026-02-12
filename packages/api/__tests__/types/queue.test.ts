import { describe, expect, it } from 'vitest'
import { REDIS_QUEUE_KEY, TASK_PAYLOAD_VERSION } from '../../src/types/queue'
import type { GenerationTaskPayload, TaskChannel } from '../../src/types/queue'

describe('queue types', () => {
  it('TASK_PAYLOAD_VERSION equals 1', () => {
    expect(TASK_PAYLOAD_VERSION).toBe(1)
  })

  it('REDIS_QUEUE_KEY equals wearon:tasks:generation', () => {
    expect(REDIS_QUEUE_KEY).toBe('wearon:tasks:generation')
  })

  it('accepts a B2C payload with userId', () => {
    const payload: GenerationTaskPayload = {
      taskId: 'test-task-id',
      channel: 'b2c',
      userId: 'user-123',
      sessionId: 'session-456',
      imageUrls: ['https://example.com/img1.jpg'],
      prompt: 'Test prompt',
      requestId: 'req_abc',
      version: 1,
      createdAt: '2026-02-12T00:00:00Z',
    }
    expect(payload.channel).toBe('b2c')
    expect(payload.userId).toBe('user-123')
    expect(payload.storeId).toBeUndefined()
  })

  it('accepts a B2B payload with storeId', () => {
    const payload: GenerationTaskPayload = {
      taskId: 'test-task-id',
      channel: 'b2b',
      storeId: 'store-789',
      sessionId: 'session-456',
      imageUrls: ['https://example.com/img1.jpg'],
      prompt: 'Test prompt',
      requestId: 'req_def',
      version: 1,
      createdAt: '2026-02-12T00:00:00Z',
    }
    expect(payload.channel).toBe('b2b')
    expect(payload.storeId).toBe('store-789')
    expect(payload.userId).toBeUndefined()
  })

  it('TaskChannel type allows b2b and b2c', () => {
    const b2c: TaskChannel = 'b2c'
    const b2b: TaskChannel = 'b2b'
    expect(b2c).toBe('b2c')
    expect(b2b).toBe('b2b')
  })
})
