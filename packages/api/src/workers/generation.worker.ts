import { Worker, Job } from 'bullmq'
import { createClient } from '@supabase/supabase-js'
import Redis from 'ioredis'
import type { GenerationJobData } from '../services/queue'
import { createCollage, type ImageInput } from '../services/image-processor'
import { generateImage, GrokAPIError } from '../services/grok'

// Initialize Supabase client with service role key (for worker operations)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase credentials not configured for worker')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Redis connection
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
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

    // Step 2: Create collage using Sharp
    console.log(`[Worker] Creating collage for session ${sessionId} with ${images.length} images`)
    const collageBuffer = await createCollage(images, {
      width: 2048,
      height: 2048,
      quality: 95,
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

    // Get public URL for the collage
    const { data: urlData } = supabase.storage
      .from('virtual-tryon-images')
      .getPublicUrl(`stitched/${collageFileName}`)

    const stitchedImageUrl = urlData.publicUrl

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

    // Step 5: Update session with generated image URL
    const processingTime = Date.now() - startTime

    await supabase
      .from('generation_sessions')
      .update({
        status: 'completed',
        generated_image_url: grokResponse.imageUrl,
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
      throw error
    }

    // Refund credits on failure
    await supabase.rpc('refund_credits', {
      p_user_id: userId,
      p_amount: 1,
      p_description: `Generation failed: ${errorMessage}`,
    })

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

    throw error
  }
}

// Create the worker
export const generationWorker = new Worker<GenerationJobData>(
  'image-generation',
  processGenerationJob,
  {
    connection: redisConnection,
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

generationWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message)
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
