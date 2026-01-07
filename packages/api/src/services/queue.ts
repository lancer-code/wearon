import { Queue, Worker, Job, QueueEvents } from 'bullmq'
import Redis from 'ioredis'

// Redis connection configuration
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

// Job data interface
export interface GenerationJobData {
  sessionId: string
  userId: string
  modelImageUrl: string
  outfitImageUrl?: string
  accessories?: Array<{ type: string; url: string }>
  promptSystem: string
  promptUser?: string
}

// Queue configuration
export const generationQueue = new Queue<GenerationJobData>('image-generation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Retry failed jobs up to 3 times
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 second delay
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 3600, // Keep completed jobs for 24 hours
    },
    removeOnFail: {
      count: 500, // Keep last 500 failed jobs for debugging
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
  limiter: {
    max: 300, // Maximum 300 jobs
    duration: 60000, // Per 60 seconds (1 minute)
  },
})

// Queue events for monitoring
export const generationQueueEvents = new QueueEvents('image-generation', {
  connection: redisConnection,
})

/**
 * Add a new generation job to the queue
 */
export async function addGenerationJob(data: GenerationJobData): Promise<string> {
  const job = await generationQueue.add('generate-image', data, {
    jobId: data.sessionId, // Use session ID as job ID for idempotency
  })

  return job.id || data.sessionId
}

/**
 * Get job status by session ID
 */
export async function getJobStatus(sessionId: string) {
  const job = await generationQueue.getJob(sessionId)

  if (!job) {
    return { status: 'not_found', progress: 0 }
  }

  const state = await job.getState()
  const progress = job.progress

  return {
    status: state,
    progress: typeof progress === 'number' ? progress : 0,
    failedReason: job.failedReason,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
  }
}

/**
 * Cancel a job
 */
export async function cancelJob(sessionId: string): Promise<boolean> {
  const job = await generationQueue.getJob(sessionId)

  if (!job) {
    return false
  }

  await job.remove()
  return true
}

/**
 * Get queue metrics
 */
export async function getQueueMetrics() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    generationQueue.getWaitingCount(),
    generationQueue.getActiveCount(),
    generationQueue.getCompletedCount(),
    generationQueue.getFailedCount(),
    generationQueue.getDelayedCount(),
  ])

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + delayed,
  }
}

/**
 * Clean up old jobs
 */
export async function cleanOldJobs() {
  const grace = 24 * 3600 * 1000 // 24 hours in milliseconds

  await generationQueue.clean(grace, 1000, 'completed')
  await generationQueue.clean(7 * 24 * 3600 * 1000, 1000, 'failed')
}

/**
 * Graceful shutdown
 */
export async function closeQueue() {
  await generationQueue.close()
  await generationQueueEvents.close()
  await redisConnection.quit()
}

// Export types
export type { Job, Worker }
