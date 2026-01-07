import sharp from 'sharp'
import axios from 'axios'

export interface ImageInput {
  url: string
  type: 'model' | 'outfit' | 'accessory'
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
}

export interface CollageOptions {
  width?: number
  height?: number
  quality?: number
  background?: { r: number; g: number; b: number }
}

const DEFAULT_OPTIONS: Required<CollageOptions> = {
  width: 2048,
  height: 2048,
  quality: 95,
  background: { r: 255, g: 255, b: 255 },
}

/**
 * Downloads an image from a URL and returns a Buffer
 */
async function downloadImage(url: string): Promise<Buffer> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'WearOn-Image-Processor/1.0',
      },
    })

    return Buffer.from(response.data)
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to download image from ${url}: ${error.message}`)
    }
    throw error
  }
}

/**
 * Resize image to fit within max dimensions while maintaining aspect ratio
 */
async function resizeImage(
  imageBuffer: Buffer,
  maxWidth: number,
  maxHeight: number,
): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toBuffer()
}

/**
 * Calculate position coordinates for image placement in collage
 */
function calculatePosition(
  index: number,
  imageCount: number,
  canvasWidth: number,
  canvasHeight: number,
  imageWidth: number,
  imageHeight: number,
): { top: number; left: number } {
  if (imageCount === 1) {
    // Center single image
    return {
      top: Math.floor((canvasHeight - imageHeight) / 2),
      left: Math.floor((canvasWidth - imageWidth) / 2),
    }
  }

  if (imageCount === 2) {
    // Two images side by side
    const spacing = 40
    const totalWidth = imageWidth * 2 + spacing
    const startX = Math.floor((canvasWidth - totalWidth) / 2)

    return {
      top: Math.floor((canvasHeight - imageHeight) / 2),
      left: startX + index * (imageWidth + spacing),
    }
  }

  if (imageCount <= 4) {
    // 2x2 grid
    const spacing = 40
    const row = Math.floor(index / 2)
    const col = index % 2
    const totalWidth = imageWidth * 2 + spacing
    const totalHeight = imageHeight * 2 + spacing
    const startX = Math.floor((canvasWidth - totalWidth) / 2)
    const startY = Math.floor((canvasHeight - totalHeight) / 2)

    return {
      top: startY + row * (imageHeight + spacing),
      left: startX + col * (imageWidth + spacing),
    }
  }

  // For more than 4 images, use 3x2 grid
  const spacing = 30
  const cols = 3
  const rows = Math.ceil(imageCount / cols)
  const row = Math.floor(index / cols)
  const col = index % cols
  const gridWidth = imageWidth * cols + spacing * (cols - 1)
  const gridHeight = imageHeight * rows + spacing * (rows - 1)
  const startX = Math.floor((canvasWidth - gridWidth) / 2)
  const startY = Math.floor((canvasHeight - gridHeight) / 2)

  return {
    top: startY + row * (imageHeight + spacing),
    left: startX + col * (imageWidth + spacing),
  }
}

/**
 * Creates a collage from multiple images
 * Downloads images from URLs, resizes them, and stitches into a single image
 *
 * @param images - Array of image URLs with metadata
 * @param options - Collage configuration options
 * @returns Buffer containing the collage image (JPEG)
 */
export async function createCollage(
  images: ImageInput[],
  options: CollageOptions = {},
): Promise<Buffer> {
  if (images.length === 0) {
    throw new Error('At least one image is required to create a collage')
  }

  if (images.length > 6) {
    throw new Error('Maximum 6 images allowed in a collage')
  }

  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Download all images in parallel
  const imageBuffers = await Promise.all(
    images.map(async (img) => {
      const buffer = await downloadImage(img.url)
      return { ...img, buffer }
    }),
  )

  // Calculate optimal size for each image based on canvas size and image count
  const imageCount = imageBuffers.length
  let maxImageWidth: number
  let maxImageHeight: number

  if (imageCount === 1) {
    maxImageWidth = opts.width - 200 // Leave margin
    maxImageHeight = opts.height - 200
  } else if (imageCount === 2) {
    maxImageWidth = Math.floor((opts.width - 120) / 2)
    maxImageHeight = opts.height - 200
  } else if (imageCount <= 4) {
    maxImageWidth = Math.floor((opts.width - 120) / 2)
    maxImageHeight = Math.floor((opts.height - 120) / 2)
  } else {
    maxImageWidth = Math.floor((opts.width - 120) / 3)
    maxImageHeight = Math.floor((opts.height - 120) / 2)
  }

  // Resize all images
  const resizedImages = await Promise.all(
    imageBuffers.map(async (img) => {
      const resized = await resizeImage(img.buffer, maxImageWidth, maxImageHeight)
      const metadata = await sharp(resized).metadata()
      return {
        ...img,
        buffer: resized,
        width: metadata.width || maxImageWidth,
        height: metadata.height || maxImageHeight,
      }
    }),
  )

  // Calculate positions for each image
  const composites = resizedImages.map((img, index) => {
    const position = calculatePosition(
      index,
      imageCount,
      opts.width,
      opts.height,
      img.width,
      img.height,
    )

    return {
      input: img.buffer,
      top: position.top,
      left: position.left,
    }
  })

  // Create the collage
  const collage = await sharp({
    create: {
      width: opts.width,
      height: opts.height,
      channels: 3,
      background: opts.background,
    },
  })
    .composite(composites)
    .jpeg({ quality: opts.quality, mozjpeg: true })
    .toBuffer()

  return collage
}

/**
 * Get image dimensions without fully loading it
 */
export async function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  const buffer = await downloadImage(url)
  const metadata = await sharp(buffer).metadata()

  if (!metadata.width || !metadata.height) {
    throw new Error('Could not determine image dimensions')
  }

  return {
    width: metadata.width,
    height: metadata.height,
  }
}

/**
 * Optimize an image (resize if too large, compress)
 */
export async function optimizeImage(
  imageBuffer: Buffer,
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 90,
): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer()
}
