import { Queue, Job, QueueEvents, Worker } from 'bullmq'
import IORedis from 'ioredis'

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

// Lazy-initialized Redis connection and queue (only connect when needed)
let redisConnection: IORedis | null = null
let generationQueue: Queue<GenerationJobData> | null = null
let generationQueueEvents: QueueEvents | null = null

function getRedisConnection(): IORedis {
  // Check if existing connection is closed or errored
  if (redisConnection && redisConnection.status !== 'ready' && redisConnection.status !== 'connecting') {
    // Connection is in a bad state, recreate it
    try {
      redisConnection.disconnect()
    } catch {
      // Ignore disconnect errors
    }
    redisConnection = null
    generationQueue = null // Queue needs to be recreated with new connection
    generationQueueEvents = null
  }

  if (!redisConnection) {
    const redisUrl = process.env.REDIS_URL
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set')
    }

    // Parse the URL to check if it's Upstash (requires TLS)
    const isUpstash = redisUrl.includes('upstash.io')

    redisConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false, // Upstash doesn't support INFO command
      tls: isUpstash ? {} : undefined, // Upstash requires TLS
      retryStrategy: (times) => {
        if (times > 10) {
          console.error('[Queue] Redis max retries reached, giving up')
          return null // Stop retrying
        }
        // Exponential backoff: 100ms, 200ms, 400ms... up to 3s
        return Math.min(times * 100, 3000)
      },
    })

    // Only log once on first connect
    let hasLoggedConnect = false
    redisConnection.on('error', (err) => {
      // Only log non-ECONNRESET errors (those are expected during reconnect)
      if (!err.message.includes('ECONNRESET')) {
        console.error('[Queue] Redis connection error:', err.message)
      }
    })

    redisConnection.on('connect', () => {
      if (!hasLoggedConnect) {
        console.log('[Queue] Redis connected')
        hasLoggedConnect = true
      }
    })

    redisConnection.on('reconnecting', () => {
      hasLoggedConnect = false // Allow logging on next successful connect
    })
  }
  return redisConnection
}

function getQueue(): Queue<GenerationJobData> {
  if (!generationQueue) {
    generationQueue = new Queue<GenerationJobData>('image-generation', {
      connection: getRedisConnection() as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          count: 100,
          age: 24 * 3600,
        },
        removeOnFail: {
          count: 500,
          age: 7 * 24 * 3600,
        },
      },
    })
  }
  return generationQueue
}

function getQueueEvents(): QueueEvents {
  if (!generationQueueEvents) {
    generationQueueEvents = new QueueEvents('image-generation', {
      connection: getRedisConnection() as any,
    })
  }
  return generationQueueEvents
}

/**
 * Add a new generation job to the queue
 */
export async function addGenerationJob(data: GenerationJobData): Promise<string> {
  const queue = getQueue()
  const job = await queue.add('generate-image', data, {
    jobId: data.sessionId, // Use session ID as job ID for idempotency
  })

  return job.id || data.sessionId
}

/**
 * Get job status by session ID
 */
export async function getJobStatus(sessionId: string) {
  const queue = getQueue()
  const job = await queue.getJob(sessionId)

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
  const queue = getQueue()
  const job = await queue.getJob(sessionId)

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
  const queue = getQueue()
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
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
  const queue = getQueue()
  const grace = 24 * 3600 * 1000 // 24 hours in milliseconds

  await queue.clean(grace, 1000, 'completed')
  await queue.clean(7 * 24 * 3600 * 1000, 1000, 'failed')
}

/**
 * Graceful shutdown
 */
export async function closeQueue() {
  if (generationQueue) {
    await generationQueue.close()
  }
  if (generationQueueEvents) {
    await generationQueueEvents.close()
  }
  if (redisConnection) {
    await redisConnection.quit()
  }
}

// Export types
export type { Job, Worker }
