export type TaskChannel = 'b2b' | 'b2c'

export interface GenerationTaskPayload {
  taskId: string
  channel: TaskChannel
  storeId?: string
  userId?: string
  sessionId: string
  imageUrls: string[]
  prompt: string
  requestId: string
  version: number
  createdAt: string
}

export const TASK_PAYLOAD_VERSION = 1

export const REDIS_QUEUE_KEY = 'wearon:tasks:generation'
