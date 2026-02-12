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
  const limit = tier.maxRequestsPerMinute

  const minuteWindow = Math.floor(Date.now() / 60000)
  const key = `ratelimit:store:${storeId}:${minuteWindow}`
  const windowResetTimestamp = (minuteWindow + 1) * 60

  try {
    const redis = getRedisClient()
    const count = await redis.incr(key)

    if (count === 1) {
      await redis.expire(key, 120)
    }

    if (count > limit) {
      return {
        allowed: false,
        response: rateLimitResponse('RATE_LIMIT_EXCEEDED', 'Store rate limit exceeded. Try again later.', {
          limit,
          remaining: 0,
          reset: windowResetTimestamp,
        }),
      }
    }

    return {
      allowed: true,
      headers: {
        limit,
        remaining: limit - count,
        reset: windowResetTimestamp,
      },
    }
  } catch (err) {
    // Fail-open: if Redis is unavailable, allow the request through
    logger.warn({ err, store_id: storeId }, 'Rate limit check failed, allowing request through (fail-open)')
    return {
      allowed: true,
      headers: {
        limit,
        remaining: limit,
        reset: windowResetTimestamp,
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
