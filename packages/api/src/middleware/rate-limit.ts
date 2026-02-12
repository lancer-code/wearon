import IORedis from 'ioredis'
import type { NextResponse } from 'next/server'
import { logger } from '../logger'
import type { RateLimitHeaders } from '../types/b2b'
import { RATE_LIMIT_TIERS } from '../types/b2b'
import { rateLimitResponse } from '../utils/b2b-response'

let redisClient: IORedis | null = null

function getRedisClient(): IORedis {
  if (redisClient && redisClient.status !== 'ready' && redisClient.status !== 'connecting') {
    try {
      redisClient.disconnect()
    } catch {
      // Ignore disconnect errors
    }
    redisClient = null
  }

  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set')
    }

    const isUpstash = redisUrl.includes('upstash.io')

    redisClient = new IORedis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      tls: isUpstash ? {} : undefined,
      retryStrategy: (times) => {
        if (times > 5) {
          return null
        }
        return Math.min(times * 100, 3000)
      },
    })
  }
  return redisClient
}

export async function checkRateLimit(
  storeId: string,
  subscriptionTier: string | null,
): Promise<{ allowed: true; headers: RateLimitHeaders } | { allowed: false; response: NextResponse }> {
  const tierKey = subscriptionTier ?? 'default'
  const tier = RATE_LIMIT_TIERS[tierKey] ?? RATE_LIMIT_TIERS['default']!
  const minuteLimit = tier.maxRequestsPerMinute
  const hourLimit = tier.maxRequestsPerHour

  const now = Date.now()
  const minuteWindow = Math.floor(now / 60000)
  const hourWindow = Math.floor(now / 3600000)
  const minuteKey = `ratelimit:store:${storeId}:minute:${minuteWindow}`
  const hourKey = `ratelimit:store:${storeId}:hour:${hourWindow}`
  const minuteResetTimestamp = (minuteWindow + 1) * 60
  const hourResetTimestamp = (hourWindow + 1) * 3600

  try {
    const redis = getRedisClient()

    // Check both minute and hour windows atomically via pipeline
    const pipeline = redis.pipeline()
    pipeline.incr(minuteKey)
    pipeline.incr(hourKey)
    const results = await pipeline.exec()

    if (!results) {
      throw new Error('Pipeline execution failed')
    }

    const minuteCount = (results[0]?.[1] as number) ?? 0
    const hourCount = (results[1]?.[1] as number) ?? 0

    // Set expiry on first increment for each window
    if (minuteCount === 1) {
      await redis.expire(minuteKey, 120) // 2 minutes TTL
    }
    if (hourCount === 1) {
      await redis.expire(hourKey, 7200) // 2 hours TTL
    }

    // Check minute limit
    if (minuteCount > minuteLimit) {
      return {
        allowed: false,
        response: rateLimitResponse(
          'RATE_LIMIT_EXCEEDED',
          'Per-minute rate limit exceeded. Try again later.',
          {
            limit: minuteLimit,
            remaining: 0,
            reset: minuteResetTimestamp,
          },
        ),
      }
    }

    // Check hour limit
    if (hourCount > hourLimit) {
      return {
        allowed: false,
        response: rateLimitResponse('RATE_LIMIT_EXCEEDED', 'Hourly rate limit exceeded. Try again later.', {
          limit: hourLimit,
          remaining: 0,
          reset: hourResetTimestamp,
        }),
      }
    }

    // Return minute-based headers (primary limit for user feedback)
    return {
      allowed: true,
      headers: {
        limit: minuteLimit,
        remaining: minuteLimit - minuteCount,
        reset: minuteResetTimestamp,
      },
    }
  } catch (err) {
    // Fail-open: if Redis is unavailable, allow the request through
    logger.warn({ err, store_id: storeId }, 'Rate limit check failed, allowing request through (fail-open)')
    return {
      allowed: true,
      headers: {
        limit: minuteLimit,
        remaining: minuteLimit,
        reset: minuteResetTimestamp,
      },
    }
  }
}

export async function closeRateLimitRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
  }
}
