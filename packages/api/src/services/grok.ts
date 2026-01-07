import axios, { AxiosError } from 'axios'

const GROK_API_BASE_URL = 'https://api.x.ai/v1'

// Get API key at runtime (not at import time) to allow dotenv to load first
function getApiKey(): string {
  const key = process.env.GROK_API_KEY
  if (!key) {
    throw new Error('GROK_API_KEY environment variable is not set')
  }
  return key
}

export interface GrokGenerationOptions {
  imageUrl: string
  systemPrompt: string
  userPrompt?: string
  model?: string
}

export interface GrokGenerationResponse {
  imageUrl: string
  model: string
  created: number
}

export class GrokAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown,
  ) {
    super(message)
    this.name = 'GrokAPIError'
  }
}

/**
 * Generate an image using Grok API
 *
 * @param options - Generation options
 * @returns Generated image URL
 * @throws GrokAPIError if API call fails
 */
export async function generateImage(
  options: GrokGenerationOptions,
): Promise<GrokGenerationResponse> {
  const { imageUrl, systemPrompt, userPrompt, model = 'grok-2-image' } = options
  const apiKey = getApiKey() // Get API key at runtime

  try {
    const response = await axios.post(
      `${GROK_API_BASE_URL}/images/generations`,
      {
        model,
        image: imageUrl, // URL to collage image
        prompt: userPrompt ? `${systemPrompt}\n\n${userPrompt}` : systemPrompt,
        n: 1, // Generate only 1 image
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000, // 2 minute timeout for image generation
      },
    )

    // Extract image URL from response
    // Response format: { data: [{ url: string, ... }] }
    const generatedImageUrl = response.data.data?.[0]?.url

    if (!generatedImageUrl) {
      throw new GrokAPIError('No image URL in Grok API response', response.status, response.data)
    }

    return {
      imageUrl: generatedImageUrl,
      model: response.data.model || model,
      created: response.data.created || Date.now(),
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError

      // Handle rate limiting (429)
      if (axiosError.response?.status === 429) {
        const retryAfter = axiosError.response.headers['retry-after']
        throw new GrokAPIError(
          `Rate limit exceeded. Retry after ${retryAfter || 'unknown'} seconds`,
          429,
          axiosError.response.data,
        )
      }

      // Handle other HTTP errors
      throw new GrokAPIError(
        `Grok API request failed: ${axiosError.message}`,
        axiosError.response?.status,
        axiosError.response?.data,
      )
    }

    // Re-throw unknown errors
    throw error
  }
}

/**
 * Check if Grok API is configured and accessible
 */
export async function checkGrokAPIHealth(): Promise<boolean> {
  if (!GROK_API_KEY) {
    return false
  }

  try {
    // Try a simple API call to verify connectivity
    await axios.get(`${GROK_API_BASE_URL}/models`, {
      headers: {
        Authorization: `Bearer ${GROK_API_KEY}`,
      },
      timeout: 5000,
    })
    return true
  } catch (error) {
    console.error('Grok API health check failed:', error)
    return false
  }
}

/**
 * Get estimated time for generation based on current queue
 * (This is a placeholder - actual implementation would query Grok API for queue status)
 */
export function estimateGenerationTime(): number {
  // Base generation time: 30-60 seconds
  return 45000 // 45 seconds in milliseconds
}
