import axios from 'axios'
import FormData from 'form-data'

const OPENAI_API_BASE_URL = 'https://api.openai.com/v1'

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
  ) {
    super(message)
    this.name = 'OpenAIImageError'
  }
}

export interface OpenAIImageOptions {
  modelImageUrl: string
  outfitImageUrl?: string
  accessoryUrls?: string[]
  prompt?: string
  quality?: 'low' | 'medium' | 'high'
  size?: '1024x1024' | '1024x1536' | '1536x1024'
}

export interface OpenAIImageResponse {
  imageUrl: string
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

  // Download all images
  console.log('[OpenAI Image] Downloading images...')
  const imageBuffers: { name: string; buffer: Buffer }[] = []

  // Model image (primary - person to dress)
  const modelBuffer = await downloadImage(modelImageUrl)
  imageBuffers.push({ name: 'model.png', buffer: modelBuffer })

  // Outfit image
  if (outfitImageUrl) {
    const outfitBuffer = await downloadImage(outfitImageUrl)
    imageBuffers.push({ name: 'outfit.png', buffer: outfitBuffer })
  }

  // Accessory images
  for (let i = 0; i < accessoryUrls.length; i++) {
    const accBuffer = await downloadImage(accessoryUrls[i])
    imageBuffers.push({ name: `accessory_${i}.png`, buffer: accBuffer })
  }

  console.log('[OpenAI Image] Downloaded', imageBuffers.length, 'images')

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

  // Add all images - first image is the primary (model)
  for (const img of imageBuffers) {
    formData.append('image', img.buffer, {
      filename: img.name,
      contentType: 'image/png',
    })
  }

  const maxRetries = 3
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

      const generatedUrl = response.data.data?.[0]?.url || response.data.data?.[0]?.b64_json
      if (!generatedUrl) {
        throw new OpenAIImageError('No image URL in response', response.status, response.data)
      }

      console.log('[OpenAI Image] Success!')
      return {
        imageUrl: generatedUrl,
        model: 'gpt-image-1.5',
        created: response.data.created || Date.now(),
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status

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

