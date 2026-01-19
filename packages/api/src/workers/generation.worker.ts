import { Worker, Job, Queue } from 'bullmq'
import { createClient } from '@supabase/supabase-js'
import IORedis from 'ioredis'
import dotenv from 'dotenv'
import { resolve } from 'path'
import axios from 'axios'
import type { GenerationJobData } from '../services/queue'
import { createCollage, type ImageInput } from '../services/image-processor'
import { generateImage, GrokAPIError } from '../services/grok'

// Max retries configured in queue (must match queue.ts)
const MAX_JOB_ATTEMPTS = 3

// Load environment variables from apps/next/.env.local
const envPath = resolve(process.cwd(), '../../apps/next/.env.local')
dotenv.config({ path: envPath })
console.log('[Worker] Loaded env from:', envPath)

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
  const { sessionId, userId, modelImageUrl, outfitImageUrl, accessories, promptSystem, promptUser } = job.data

  try {
    // Update session status to processing
    await supabase
      .from('generation_sessions')
      .update({ status: 'processing' })
      .eq('id', sessionId)

    await job.updateProgress(10)

    // Step 1: Prepare images for collage
    const images: ImageInput[] = [
      { url: modelImageUrl, type: 'model' },
    ]

    if (outfitImageUrl) {
      images.push({ url: outfitImageUrl, type: 'outfit' })
    }

    if (accessories && accessories.length > 0) {
      accessories.forEach((acc) => {
        images.push({ url: acc.url, type: 'accessory' })
      })
    }

    await job.updateProgress(20)

    // Step 2: Create collage using Sharp with semantic layout
    console.log(`[Worker] Creating collage for session ${sessionId} with ${images.length} images`)
    console.log(`[Worker] Images for collage:`, JSON.stringify(images.map(img => ({ type: img.type, url: img.url.substring(0, 50) + '...' })), null, 2))
    const collageBuffer = await createCollage(images, {
      width: 2048,
      height: 2048,
      quality: 95,
      layout: 'semantic',
    })

    await job.updateProgress(40)

    // Step 3: Upload collage to Supabase Storage
    const collageFileName = `${sessionId}.jpg`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('virtual-tryon-images')
      .upload(`stitched/${collageFileName}`, collageBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      })

    if (uploadError) {
      throw new Error(`Failed to upload collage: ${uploadError.message}`)
    }

    // Get signed URL for the collage (6 hours expiry)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('virtual-tryon-images')
      .createSignedUrl(`stitched/${collageFileName}`, 6 * 60 * 60)

    if (signedUrlError || !signedUrlData) {
      throw new Error(`Failed to create signed URL for collage: ${signedUrlError?.message}`)
    }

    const stitchedImageUrl = signedUrlData.signedUrl

    // Update session with stitched image URL
    await supabase
      .from('generation_sessions')
      .update({ stitched_image_url: stitchedImageUrl })
      .eq('id', sessionId)

    await job.updateProgress(60)

    // Step 4: Call Grok API
    console.log(`[Worker] Calling Grok API for session ${sessionId}`)
    const grokResponse = await generateImage({
      imageUrl: stitchedImageUrl,
      systemPrompt: promptSystem,
      userPrompt: promptUser,
    })

    await job.updateProgress(90)

    // Step 5: Download generated image and re-upload to Supabase (prevent URL expiration)
    console.log(`[Worker] Downloading generated image for session ${sessionId}`)
    let finalImageUrl = grokResponse.imageUrl

    try {
      const imageResponse = await axios.get(grokResponse.imageUrl, {
        responseType: 'arraybuffer',
        timeout: 60000, // 1 minute timeout for download
      })

      const imageBuffer = Buffer.from(imageResponse.data)
      const generatedFileName = `${sessionId}-generated.jpg`

      const { error: generatedUploadError } = await supabase.storage
        .from('virtual-tryon-images')
        .upload(`generated/${generatedFileName}`, imageBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      if (!generatedUploadError) {
        // Create signed URL (expires in 6 hours to match cleanup schedule)
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('virtual-tryon-images')
          .createSignedUrl(`generated/${generatedFileName}`, 6 * 60 * 60) // 6 hours

        if (signedUrlData && !signedUrlError) {
          finalImageUrl = signedUrlData.signedUrl
          console.log(`[Worker] Created signed URL for generated image: ${finalImageUrl}`)
        } else {
          console.warn(`[Worker] Failed to create signed URL, using public URL`)
          const { data: publicUrlData } = supabase.storage
            .from('virtual-tryon-images')
            .getPublicUrl(`generated/${generatedFileName}`)
          finalImageUrl = publicUrlData.publicUrl
        }
      } else {
        console.warn(`[Worker] Failed to save generated image to Supabase, using original URL: ${generatedUploadError.message}`)
      }
    } catch (downloadError) {
      console.warn(`[Worker] Failed to download generated image, using original URL:`, downloadError)
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
          image_count: images.length,
        },
      })

    await job.updateProgress(100)

    console.log(`[Worker] Successfully completed generation for session ${sessionId} in ${processingTime}ms`)

    return { success: true, sessionId, imageUrl: grokResponse.imageUrl }
  } catch (error) {
    console.error(`[Worker] Error processing session ${sessionId}:`, error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const processingTime = Date.now() - startTime

    // Check if this is a rate limit error
    const isRateLimitError = error instanceof GrokAPIError && error.statusCode === 429

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

    // For non-rate-limit errors, mark as failed immediately and refund
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
          event_type: 'generation_failed',
          user_id: userId,
          metadata: {
            session_id: sessionId,
            error: errorMessage,
            processing_time_ms: processingTime,
          },
        })
    } catch (analyticsError) {
      console.error(`[Worker] Failed to log analytics event:`, analyticsError)
    }

    throw error
  }
}

// Create the worker
export const generationWorker = new Worker<GenerationJobData>(
  'image-generation',
  processGenerationJob,
  {
    connection: redisConnection as any, // Type assertion due to BullMQ bundled ioredis version mismatch
    concurrency: 5, // Process up to 5 jobs concurrently
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

console.log('[Worker] Image generation worker started')

export default generationWorker
