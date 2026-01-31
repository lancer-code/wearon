import axios from 'axios'
import FormData from 'form-data'
import sharp from 'sharp'

const OPENAI_API_BASE_URL = 'https://api.openai.com/v1'

// Image resize settings for cost optimization
// Target max dimension of 1024px reduces tokens significantly while maintaining quality
const MAX_IMAGE_DIMENSION = 1024
const JPEG_QUALITY = 85 // Good balance of quality and file size

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  return key
}

export class OpenAIImageError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown,
    public isModerationError: boolean = false,
  ) {
    super(message)
    this.name = 'OpenAIImageError'
  }
}

// User-friendly moderation error message
const MODERATION_ERROR_MESSAGE = 'Your image was flagged by the safety filter. Please use different images that comply with content guidelines.'

export interface OpenAIImageOptions {
  modelImageUrl: string
  outfitImageUrl?: string
  accessoryUrls?: string[]
  prompt?: string
  quality?: 'low' | 'medium' | 'high'
  size?: '1024x1024' | '1024x1536' | '1536x1024'
}

export interface OpenAIImageResponse {
  imageUrl?: string
  imageBase64?: string
  model: string
  created: number
}

/**
 * Download image from URL and return as Buffer
 */
async function downloadImage(url: string): Promise<Buffer> {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
  })
  return Buffer.from(response.data)
}

/**
 * Calculate estimated tokens for an image based on OpenAI's formula:
 * - Images are tiled at 512x512
 * - Base cost: 85 tokens
 * - Per tile: 170 tokens
 * - Formula: 85 + 170 * ceil(width/512) * ceil(height/512)
 */
function calculateImageTokens(width: number, height: number): number {
  const tilesX = Math.ceil(width / 512)
  const tilesY = Math.ceil(height / 512)
  const totalTiles = tilesX * tilesY
  return 85 + 170 * totalTiles
}

/**
 * Resize image to reduce input tokens while maintaining aspect ratio
 * - Targets max 1024px on longest side (reduces tokens ~75% for typical phone photos)
 * - Maintains aspect ratio (no distortion)
 * - Optimized for portrait images (most common in try-on)
 * - Converts to JPEG for smaller file size
 */
async function resizeImageForCost(buffer: Buffer, imageName: string): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata()
  const { width, height } = metadata

  if (!width || !height) {
    // Can't determine dimensions, return original
    console.log(`[Tokens] ${imageName}: unknown dimensions, assuming ~765 tokens`)
    return buffer
  }

  const originalSize = buffer.length
  const longestSide = Math.max(width, height)

  // Skip resize if already small enough
  if (longestSide <= MAX_IMAGE_DIMENSION) {
    const tokens = calculateImageTokens(width, height)
    console.log(`[Tokens] ${imageName}: ${width}x${height} = ${tokens} tokens (no resize needed)`)
    // Still convert to JPEG for consistent format
    return sharp(buffer)
      .flatten({ background: { r: 255, g: 255, b: 255 } }) // Handle transparency
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer()
  }

  // Calculate new dimensions maintaining aspect ratio
  const scale = MAX_IMAGE_DIMENSION / longestSide
  const newWidth = Math.round(width * scale)
  const newHeight = Math.round(height * scale)

  const resized = await sharp(buffer)
    .resize(newWidth, newHeight, {
      fit: 'inside', // Maintain aspect ratio, fit within bounds
      withoutEnlargement: true, // Never upscale
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } }) // Handle PNG transparency
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer()

  const reduction = ((originalSize - resized.length) / originalSize * 100).toFixed(1)
  const originalTokens = calculateImageTokens(width, height)
  const newTokens = calculateImageTokens(newWidth, newHeight)
  console.log(`[Tokens] ${imageName}: ${width}x${height} (${originalTokens} tokens) → ${newWidth}x${newHeight} (${newTokens} tokens) - saved ${originalTokens - newTokens} tokens, ${reduction}% smaller file`)

  return resized
}

/**
 * Download and resize image for optimal cost
 */
async function downloadAndResizeImage(url: string, imageName: string): Promise<Buffer> {
  const buffer = await downloadImage(url)
  return resizeImageForCost(buffer, imageName)
}

/**
 * Generate virtual try-on image using OpenAI GPT Image 1.5
 *
 * This uses the images/edit endpoint with multiple input images:
 * - Model photo (person to dress)
 * - Outfit image(s)
 * - Accessory images
 *
 * The model will composite these to create a try-on result
 */
export async function generateWithOpenAI(options: OpenAIImageOptions): Promise<OpenAIImageResponse> {
  const { modelImageUrl, outfitImageUrl, accessoryUrls = [], prompt, quality = 'medium', size = '1024x1536' } = options
  const apiKey = getApiKey()

  console.log('[OpenAI Image] Starting generation...')
  console.log('[OpenAI Image] Model image:', modelImageUrl.substring(0, 50) + '...')
  console.log('[OpenAI Image] Outfit image:', outfitImageUrl ? outfitImageUrl.substring(0, 50) + '...' : 'none')
  console.log('[OpenAI Image] Accessories:', accessoryUrls.length)

  // Download and resize all images for cost optimization
  console.log('[OpenAI Image] Downloading and resizing images...')
  const imageBuffers: { name: string; buffer: Buffer }[] = []

  // Model image (primary - person to dress)
  const modelBuffer = await downloadAndResizeImage(modelImageUrl, 'model')
  imageBuffers.push({ name: 'model.jpg', buffer: modelBuffer })

  // Outfit image
  if (outfitImageUrl) {
    const outfitBuffer = await downloadAndResizeImage(outfitImageUrl, 'outfit')
    imageBuffers.push({ name: 'outfit.jpg', buffer: outfitBuffer })
  }

  // Accessory images
  for (let i = 0; i < accessoryUrls.length; i++) {
    const accBuffer = await downloadAndResizeImage(accessoryUrls[i], `accessory_${i}`)
    imageBuffers.push({ name: `accessory_${i}.jpg`, buffer: accBuffer })
  }

  console.log('[OpenAI Image] Downloaded and resized', imageBuffers.length, 'images')

  // Calculate total estimated cost (input tokens at $8/1M)
  // Note: After resizing to max 1024px, each image is ~765 tokens (2x2 tiles)
  const estimatedTokensPerImage = 765 // 85 + 170 * 4 tiles (1024x1024 max)
  const totalInputTokens = imageBuffers.length * estimatedTokensPerImage
  const inputCost = (totalInputTokens / 1_000_000) * 8 // $8 per 1M tokens
  const outputCost = 0.05 // Fixed for medium quality 1024x1536
  const totalCost = inputCost + outputCost
  console.log(`[Cost] Estimated: ${imageBuffers.length} images × ~${estimatedTokensPerImage} tokens = ${totalInputTokens} input tokens`)
  console.log(`[Cost] Input: $${inputCost.toFixed(4)} + Output: $${outputCost.toFixed(2)} = Total: $${totalCost.toFixed(4)}`)

  // Build the prompt for virtual try-on
  const tryOnPrompt = prompt || buildDefaultPrompt(!!outfitImageUrl, accessoryUrls.length)

  console.log('[OpenAI Image] Prompt:', tryOnPrompt.substring(0, 100) + '...')

  // Create form data with multiple images
  const formData = new FormData()
  formData.append('model', 'gpt-image-1.5')
  formData.append('prompt', tryOnPrompt)
  formData.append('quality', quality)
  formData.append('size', size)
  formData.append('n', '1')
  // Note: response_format not supported for /images/edits - we handle both URL and base64

  // Add all images using array syntax - first image is the primary (model)
  for (const img of imageBuffers) {
    formData.append('image[]', img.buffer, {
      filename: img.name,
      contentType: 'image/jpeg',
    })
  }

  const maxRetries = parseInt(process.env.OPENAI_MAX_RETRIES || '3', 10)
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[OpenAI Image] Attempt ${attempt}/${maxRetries}`)

      const response = await axios.post(`${OPENAI_API_BASE_URL}/images/edits`, formData, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...formData.getHeaders(),
        },
        timeout: 180000, // 3 minute timeout
      })

      const imageUrl = response.data.data?.[0]?.url
      const imageBase64 = response.data.data?.[0]?.b64_json

      if (!imageUrl && !imageBase64) {
        throw new OpenAIImageError('No image data in response', response.status, response.data)
      }

      console.log('[OpenAI Image] Success!', imageUrl ? 'Got URL' : 'Got base64')
      return {
        imageUrl,
        imageBase64,
        model: 'gpt-image-1.5',
        created: response.data.created || Date.now(),
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status
        const errorData = error.response?.data as { error?: { code?: string; message?: string } } | undefined
        const errorCode = errorData?.error?.code

        // Moderation/safety error - don't retry, throw with user-friendly message
        if (status === 400 && errorCode === 'moderation_blocked') {
          console.log('[OpenAI Image] Content moderation blocked request')
          throw new OpenAIImageError(MODERATION_ERROR_MESSAGE, 400, error.response?.data, true)
        }

        // Rate limit - throw immediately for BullMQ to handle
        if (status === 429) {
          throw new OpenAIImageError('Rate limit exceeded', 429, error.response?.data)
        }

        // Retry on server errors
        if (status && status >= 500 && attempt < maxRetries) {
          console.log(`[OpenAI Image] Server error ${status}, retrying in ${attempt * 2}s...`)
          lastError = new OpenAIImageError(`API error: ${error.message}`, status, error.response?.data)
          await new Promise((r) => setTimeout(r, attempt * 2000))
          continue
        }

        throw new OpenAIImageError(`API error: ${error.message}`, status, error.response?.data)
      }
      throw error
    }
  }

  throw lastError || new OpenAIImageError('Failed after all retries')
}

/**
 * Build default prompt for virtual try-on
 */
function buildDefaultPrompt(hasOutfit: boolean, accessoryCount: number): string {
  let prompt = 'Virtual try-on: Using the first image as the model (person to dress), '

  if (hasOutfit && accessoryCount > 0) {
    prompt += 'dress them in the outfit from the second image and add the accessories from the remaining images. '
  } else if (hasOutfit) {
    prompt += 'dress them in the outfit from the second image. '
  } else if (accessoryCount > 0) {
    prompt += 'add the accessories from the other images. '
  }

  prompt += `
Requirements:
- Keep the model's exact face, skin tone, hair, and body shape
- Naturally fit the clothing to their body
- Place accessories correctly (watch on wrist, necklace on neck, hat on head, etc.)
- Professional fashion photography style
- Natural lighting and shadows
- Output a single portrait photo (3:4 ratio)`

  return prompt
}

