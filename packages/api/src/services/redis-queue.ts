import IORedis from 'ioredis'
import { logger } from '../logger'
import type { GenerationTaskPayload } from '../types/queue'
import { REDIS_QUEUE_KEY } from '../types/queue'
import { toSnakeCase } from '../utils/snake-case'

let redisConnection: IORedis | null = null

function getRedisConnection(): IORedis {
  if (
    redisConnection &&
    redisConnection.status !== 'ready' &&
    redisConnection.status !== 'connecting'
  ) {
    try {
      redisConnection.disconnect()
    } catch {
      // Ignore disconnect errors
    }
    redisConnection = null
  }

  if (!redisConnection) {
    const redisUrl = process.env.REDIS_URL
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set')
    }

    const isUpstash = redisUrl.includes('upstash.io')

    redisConnection = new IORedis(redisUrl, {
      enableReadyCheck: false,
      tls: isUpstash ? {} : undefined,
      retryStrategy: (times) => {
        if (times > 10) {
          logger.error('[RedisQueue] Max retries reached, giving up')
          return null
        }
        return Math.min(times * 100, 3000)
      },
    })

    let hasLoggedConnect = false
    redisConnection.on('error', (err) => {
      if (!err.message.includes('ECONNRESET')) {
        logger.error({ err: err.message }, '[RedisQueue] Connection error')
      }
    })

    redisConnection.on('connect', () => {
      if (!hasLoggedConnect) {
        logger.info('[RedisQueue] Redis connected')
        hasLoggedConnect = true
      }
    })

    redisConnection.on('reconnecting', () => {
      hasLoggedConnect = false
    })
  }

  return redisConnection
}

export async function pushGenerationTask(payload: GenerationTaskPayload): Promise<void> {
  const redis = getRedisConnection()
  const snakeCasePayload = toSnakeCase(payload)
  const jsonString = JSON.stringify(snakeCasePayload)

  try {
    await redis.lpush(REDIS_QUEUE_KEY, jsonString)
  } catch (err) {
    throw new Error('Redis queue unavailable')
  }
}

export async function closeRedisQueue(): Promise<void> {
  if (redisConnection) {
    await redisConnection.quit()
    redisConnection = null
  }
}
