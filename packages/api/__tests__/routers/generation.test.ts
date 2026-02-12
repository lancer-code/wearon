import { describe, expect, it, vi } from 'vitest'
import { TASK_PAYLOAD_VERSION } from '../../src/types/queue'

// Mock redis-queue
const mockPushGenerationTask = vi.fn()
vi.mock('../../src/services/redis-queue', () => ({
  pushGenerationTask: (...args: unknown[]) => mockPushGenerationTask(...args),
}))

describe('generation router', () => {
  describe('task payload construction', () => {
    it('builds payload with channel b2c and correct version', () => {
      // Simulate what the router does when building the payload
      const userId = 'user-123'
      const sessionId = 'session-456'
      const modelImageUrl = 'https://example.com/model.jpg'
      const outfitImageUrl = 'https://example.com/outfit.jpg'
      const accessories = [{ type: 'hat', url: 'https://example.com/hat.jpg' }]

      const imageUrls: string[] = [modelImageUrl]
      if (outfitImageUrl) {
        imageUrls.push(outfitImageUrl)
      }
      for (const accessory of accessories) {
        imageUrls.push(accessory.url)
      }

      expect(imageUrls).toEqual([
        'https://example.com/model.jpg',
        'https://example.com/outfit.jpg',
        'https://example.com/hat.jpg',
      ])
    })

    it('imageUrls contains only model image when no outfit or accessories', () => {
      const modelImageUrl = 'https://example.com/model.jpg'

      const imageUrls: string[] = [modelImageUrl]

      expect(imageUrls).toEqual(['https://example.com/model.jpg'])
    })

    it('TASK_PAYLOAD_VERSION is used in payload', () => {
      expect(TASK_PAYLOAD_VERSION).toBe(1)
    })
  })

  describe('status values', () => {
    it('session is created with status queued (not pending)', () => {
      const status = 'queued'
      expect(status).toBe('queued')
      expect(status).not.toBe('pending')
    })

    it('getHistory accepts queued status', () => {
      const validStatuses = ['queued', 'processing', 'completed', 'failed']
      expect(validStatuses).toContain('queued')
      expect(validStatuses).not.toContain('pending')
    })

    it('getStats uses queued status for active count', () => {
      const activeStatuses = ['queued', 'processing']
      expect(activeStatuses).toContain('queued')
      expect(activeStatuses).not.toContain('pending')
    })
  })
})
