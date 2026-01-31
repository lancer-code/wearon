import { Worker, Job, Queue } from 'bullmq'
import { createClient } from '@supabase/supabase-js'
import IORedis from 'ioredis'
import dotenv from 'dotenv'
import { resolve } from 'path'
import axios from 'axios'
import type { GenerationJobData } from '../services/queue'
import { generateWithOpenAI, OpenAIImageError } from '../services/openai-image'

// Max retries configured in queue (must match queue.ts)
const MAX_JOB_ATTEMPTS = 3

// Load environment variables from apps/next/.env.local FIRST
const envPath = resolve(process.cwd(), '../../apps/next/.env.local')
dotenv.config({ path: envPath })
console.log('[Worker] Loaded env from:', envPath)

console.log('[Worker] Using OpenAI GPT Image 1.5 for generation')

// Initialize Supabase client with service role key (for worker operations)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase credentials not configured for worker')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Redis connection for Upstash (with full auth URL)
const redisUrl = process.env.REDIS_URL
if (!redisUrl) {
  throw new Error('REDIS_URL environment variable is not set')
}

// Check if using Upstash (requires TLS and specific settings)
const isUpstash = redisUrl.includes('upstash.io')

const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false, // Upstash doesn't support INFO command
  tls: isUpstash ? {} : undefined, // Upstash requires TLS
})

redisConnection.on('error', (err) => {
  if (!err.message.includes('ECONNRESET')) {
    console.error('[Worker] Redis error:', err.message)
  }
})

redisConnection.on('connect', () => {
  console.log('[Worker] Redis connected')
})

/**
 * Process a single generation job
 */
async function processGenerationJob(job: Job<GenerationJobData>) {
  const startTime = Date.now()
  const { sessionId, userId, modelImageUrl, outfitImageUrl, accessories, promptSystem } = job.data

  try {
    // Update session status to processing
    await supabase
      .from('generation_sessions')
      .update({ status: 'processing' })
      .eq('id', sessionId)

    await job.updateProgress(10)

    // Prepare accessory URLs
    const accessoryUrls = accessories?.map((acc) => acc.url) || []

    const imageCount = 1 + (outfitImageUrl ? 1 : 0) + accessoryUrls.length
    console.log(`[Worker] Sending ${imageCount} images directly to OpenAI for session ${sessionId}`)
    console.log(`[Worker] Model: ${modelImageUrl.substring(0, 50)}...`)
    console.log(`[Worker] Outfit: ${outfitImageUrl ? outfitImageUrl.substring(0, 50) + '...' : 'none'}`)
    console.log(`[Worker] Accessories: ${accessoryUrls.length}`)

    await job.updateProgress(30)

    // Call OpenAI GPT Image 1.5 API with multiple images directly
    const generationResponse = await generateWithOpenAI({
      modelImageUrl,
      outfitImageUrl,
      accessoryUrls,
      quality: 'medium',
      size: '1024x1536',
    })

    await job.updateProgress(90)

    // Step 5: Get image buffer and re-upload to Supabase (prevent URL expiration)
    console.log(`[Worker] Processing generated image for session ${sessionId}`)
    let finalImageUrl = generationResponse.imageUrl || ''
    let imageBuffer: Buffer | null = null

    try {
      // Handle both URL and base64 responses from OpenAI
      if (generationResponse.imageBase64) {
        // OpenAI returned base64 data - decode directly
        console.log(`[Worker] Decoding base64 image data`)
        imageBuffer = Buffer.from(generationResponse.imageBase64, 'base64')
      } else if (generationResponse.imageUrl) {
        // OpenAI returned URL - download it
        console.log(`[Worker] Downloading image from URL`)
        const imageResponse = await axios.get(generationResponse.imageUrl, {
          responseType: 'arraybuffer',
          timeout: 60000, // 1 minute timeout for download
        })
        imageBuffer = Buffer.from(imageResponse.data)
      }

      if (imageBuffer) {
        const generatedFileName = `${sessionId}-generated.png`

        const { error: generatedUploadError } = await supabase.storage
          .from('virtual-tryon-images')
          .upload(`generated/${generatedFileName}`, imageBuffer, {
            contentType: 'image/png',
            upsert: true,
          })

        if (!generatedUploadError) {
          // Create signed URL (expires in 6 hours to match cleanup schedule)
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('virtual-tryon-images')
            .createSignedUrl(`generated/${generatedFileName}`, 6 * 60 * 60) // 6 hours

          if (signedUrlData && !signedUrlError) {
            finalImageUrl = signedUrlData.signedUrl
            console.log(`[Worker] Created signed URL for generated image`)
          } else {
            console.warn(`[Worker] Failed to create signed URL, using public URL`)
            const { data: publicUrlData } = supabase.storage
              .from('virtual-tryon-images')
              .getPublicUrl(`generated/${generatedFileName}`)
            finalImageUrl = publicUrlData.publicUrl
          }
        } else {
          console.warn(`[Worker] Failed to save generated image to Supabase: ${generatedUploadError.message}`)
        }
      }
    } catch (downloadError) {
      console.warn(`[Worker] Failed to process generated image:`, downloadError)
    }

    // Verify we have a valid image URL before marking as completed
    if (!finalImageUrl) {
      throw new Error('Failed to generate or save image - no valid URL')
    }

    // Step 6: Update session with generated image URL
    const processingTime = Date.now() - startTime

    await supabase
      .from('generation_sessions')
      .update({
        status: 'completed',
        generated_image_url: finalImageUrl,
        processing_time_ms: processingTime,
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    // Log analytics event
    await supabase
      .from('analytics_events')
      .insert({
        event_type: 'generation_completed',
        user_id: userId,
        metadata: {
          session_id: sessionId,
          processing_time_ms: processingTime,
          image_count: imageCount,
        },
      })

    await job.updateProgress(100)

    console.log(`[Worker] Successfully completed generation for session ${sessionId} in ${processingTime}ms`)

    return { success: true, sessionId, imageUrl: generationResponse.imageUrl }
  } catch (error) {
    console.error(`[Worker] Error processing session ${sessionId}:`, error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const processingTime = Date.now() - startTime

    // Check error type
    const isRateLimitError = error instanceof OpenAIImageError && error.statusCode === 429
    const isModerationError = error instanceof OpenAIImageError && error.isModerationError

    if (isRateLimitError) {
      // Don't mark as failed yet, let BullMQ retry
      // Update session to show it's retrying
      try {
        await supabase
          .from('generation_sessions')
          .update({ error_message: `Rate limited, retrying (attempt ${job.attemptsMade + 1}/${MAX_JOB_ATTEMPTS})` })
          .eq('id', sessionId)
      } catch (updateError) {
        console.error(`[Worker] Failed to update session status for retry:`, updateError)
      }
      throw error
    }

    // For moderation errors, log but don't expose raw error details
    if (isModerationError) {
      console.log(`[Worker] Content moderation blocked session ${sessionId}`)
    }

    // For non-rate-limit errors (including moderation), mark as failed immediately and refund
    // Wrap all Supabase calls in try-catch to prevent silent failures
    try {
      // Refund credits on failure (only if not already refunded)
      const { data: session } = await supabase
        .from('generation_sessions')
        .select('status')
        .eq('id', sessionId)
        .single()

      // Only refund if session wasn't already marked as failed (idempotency)
      if (session && session.status !== 'failed') {
        await supabase.rpc('refund_credits', {
          p_user_id: userId,
          p_amount: 1,
          p_description: `Generation failed: ${errorMessage}`,
        })
      }
    } catch (refundError) {
      console.error(`[Worker] Failed to refund credits for session ${sessionId}:`, refundError)
    }

    try {
      // Update session status to failed
      await supabase
        .from('generation_sessions')
        .update({
          status: 'failed',
          error_message: errorMessage,
          processing_time_ms: processingTime,
          completed_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
    } catch (updateError) {
      console.error(`[Worker] Failed to update session status to failed:`, updateError)
    }

    try {
      // Log analytics event
      await supabase
        .from('analytics_events')
        .insert({
          event_type: isModerationError ? 'generation_moderation_blocked' : 'generation_failed',
          user_id: userId,
          metadata: {
            session_id: sessionId,
            error: errorMessage,
            processing_time_ms: processingTime,
            moderation_blocked: isModerationError,
          },
        })
    } catch (analyticsError) {
      console.error(`[Worker] Failed to log analytics event:`, analyticsError)
    }

    // Return instead of throw to prevent BullMQ from retrying
    // We've already handled the failure (refund + status update)
    return { success: false, sessionId, error: errorMessage }
  }
}

// Create the worker (paused - will start after cleanup)
export const generationWorker = new Worker<GenerationJobData>(
  'image-generation',
  processGenerationJob,
  {
    connection: redisConnection as any, // Type assertion due to BullMQ bundled ioredis version mismatch
    concurrency: 5, // Process up to 5 jobs concurrently
    autorun: false, // Don't start automatically - wait for cleanup
    limiter: {
      max: 300,
      duration: 60000, // Match queue rate limit
    },
  },
)

// Worker event handlers
generationWorker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully`)
})

generationWorker.on('failed', async (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message)

  // Check if this was the final attempt (all retries exhausted)
  if (job && job.attemptsMade >= MAX_JOB_ATTEMPTS) {
    console.log(`[Worker] Job ${job.id} exhausted all ${MAX_JOB_ATTEMPTS} attempts, processing final failure`)

    const { sessionId, userId } = job.data
    const errorMessage = err.message || 'Unknown error after all retries'

    try {
      // Check if already refunded (idempotency)
      const { data: session } = await supabase
        .from('generation_sessions')
        .select('status')
        .eq('id', sessionId)
        .single()

      if (session && session.status !== 'failed') {
        // Refund credits
        await supabase.rpc('refund_credits', {
          p_user_id: userId,
          p_amount: 1,
          p_description: `Generation failed after ${MAX_JOB_ATTEMPTS} attempts: ${errorMessage}`,
        })

        // Update session status
        await supabase
          .from('generation_sessions')
          .update({
            status: 'failed',
            error_message: `Failed after ${MAX_JOB_ATTEMPTS} attempts: ${errorMessage}`,
            completed_at: new Date().toISOString(),
          })
          .eq('id', sessionId)

        // Log analytics
        await supabase.from('analytics_events').insert({
          event_type: 'generation_failed',
          user_id: userId,
          metadata: {
            session_id: sessionId,
            error: errorMessage,
            attempts: job.attemptsMade,
            final_failure: true,
          },
        })

        console.log(`[Worker] Refunded credits and marked session ${sessionId} as failed`)
      }
    } catch (refundError) {
      console.error(`[Worker] Failed to process final failure for job ${job.id}:`, refundError)
    }
  }
})

generationWorker.on('stalled', async (jobId) => {
  console.warn(`[Worker] Job ${jobId} stalled - attempting recovery`)

  try {
    // Create queue instance to get job data
    const queue = new Queue<GenerationJobData>('image-generation', {
      connection: redisConnection as any,
    })

    const job = await queue.getJob(jobId)

    if (job) {
      const { sessionId } = job.data
      // Update session to show it's being retried
      await supabase
        .from('generation_sessions')
        .update({ error_message: 'Job stalled, retrying...' })
        .eq('id', sessionId)
    }

    await queue.close()
  } catch (stalledError) {
    console.error(`[Worker] Failed to handle stalled job ${jobId}:`, stalledError)
  }
})

generationWorker.on('error', (err) => {
  console.error('[Worker] Worker error:', err)
})

// Clear old pending jobs on startup
async function clearPendingJobs() {
  console.log('[Worker] Clearing old pending jobs...')

  const queue = new Queue<GenerationJobData>('image-generation', {
    connection: redisConnection as any,
  })

  try {
    // Get all waiting and delayed jobs
    const [waitingJobs, delayedJobs] = await Promise.all([
      queue.getWaiting(),
      queue.getDelayed(),
    ])

    const allPendingJobs = [...waitingJobs, ...delayedJobs]

    if (allPendingJobs.length === 0) {
      console.log('[Worker] No pending jobs to clear')
      await queue.close()
      return
    }

    console.log(`[Worker] Found ${allPendingJobs.length} pending jobs to clear`)

    // Process each pending job - mark as failed and refund
    for (const job of allPendingJobs) {
      const { sessionId, userId } = job.data

      try {
        // Check if already processed
        const { data: session } = await supabase
          .from('generation_sessions')
          .select('status')
          .eq('id', sessionId)
          .single()

        if (session && session.status !== 'failed' && session.status !== 'completed') {
          // Refund credits
          await supabase.rpc('refund_credits', {
            p_user_id: userId,
            p_amount: 1,
            p_description: 'Job cleared on worker restart',
          })

          // Mark session as failed
          await supabase
            .from('generation_sessions')
            .update({
              status: 'failed',
              error_message: 'Job cleared on worker restart - please try again',
              completed_at: new Date().toISOString(),
            })
            .eq('id', sessionId)
        }

        // Remove job from queue
        await job.remove()
      } catch (jobError) {
        console.error(`[Worker] Failed to clear job ${job.id}:`, jobError)
      }
    }

    console.log(`[Worker] Cleared ${allPendingJobs.length} pending jobs`)
  } catch (error) {
    console.error('[Worker] Failed to clear pending jobs:', error)
  } finally {
    await queue.close()
  }
}

// Run cleanup on startup, then start the worker
clearPendingJobs().then(() => {
  console.log('[Worker] Startup cleanup complete, starting worker...')
  generationWorker.run()
  console.log('[Worker] Worker is now processing new jobs')
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] SIGTERM received, closing worker...')
  await generationWorker.close()
  await redisConnection.quit()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('[Worker] SIGINT received, closing worker...')
  await generationWorker.close()
  await redisConnection.quit()
  process.exit(0)
})

console.log('[Worker] Image generation worker initialized (paused until cleanup completes)')

export default generationWorker
