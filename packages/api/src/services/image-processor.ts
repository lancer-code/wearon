import sharp from 'sharp'
import axios from 'axios'

// Disable Sharp cache for one-off operations (reduces memory in serverless)
sharp.cache(false)

// Limit max input pixels to prevent memory issues (100 megapixels)
const MAX_INPUT_PIXELS = 100_000_000
const MIN_IMAGE_DIMENSION = 10

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
  layout?: 'grid' | 'horizontal' | 'semantic' // grid = square collage, horizontal = side by side, semantic = model/accessories/outfit sections
}

const DEFAULT_OPTIONS: Required<CollageOptions> = {
  width: 1920,
  height: 1080,
  quality: 95,
  background: { r: 255, g: 255, b: 255 },
  layout: 'horizontal',
}

/**
 * Validates an image buffer and returns metadata
 * Checks for corrupt images, minimum dimensions, and pixel limits
 */
async function validateImage(buffer: Buffer): Promise<sharp.Metadata> {
  try {
    const metadata = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata()

    if (!metadata.width || !metadata.height) {
      throw new Error('Invalid image: could not determine dimensions')
    }

    if (metadata.width < MIN_IMAGE_DIMENSION || metadata.height < MIN_IMAGE_DIMENSION) {
      throw new Error(`Image too small: minimum ${MIN_IMAGE_DIMENSION}x${MIN_IMAGE_DIMENSION} pixels required`)
    }

    return metadata
  } catch (error) {
    if (error instanceof Error && error.message.includes('Input image exceeds pixel limit')) {
      throw new Error('Image too large: exceeds maximum pixel limit')
    }
    throw error
  }
}

/**
 * Downloads an image from a URL and returns a Buffer
 * Validates content-type and checks for empty responses
 */
async function downloadImage(url: string): Promise<Buffer> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'WearOn-Image-Processor/1.0',
      },
      validateStatus: (status) => status === 200, // Only accept 200 OK
    })

    // Validate content type
    const contentType = response.headers['content-type']
    if (contentType && !contentType.startsWith('image/')) {
      throw new Error(`Invalid content type: expected image, got ${contentType}`)
    }

    const buffer = Buffer.from(response.data)

    // Check for empty response
    if (buffer.length === 0) {
      throw new Error('Downloaded empty image')
    }

    return buffer
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      if (status === 404) {
        throw new Error(`Image not found: ${url}`)
      }
      if (status === 403) {
        throw new Error(`Access denied to image: ${url}`)
      }
      throw new Error(`Failed to download image from ${url}: ${error.message}`)
    }
    throw error
  }
}

/**
 * Downloads an image with retry logic for network resilience
 */
async function downloadWithRetry(url: string, retries = 3): Promise<Buffer> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await downloadImage(url)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry on client errors (4xx)
      if (lastError.message.includes('not found') || lastError.message.includes('Access denied')) {
        throw lastError
      }

      if (attempt < retries) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)))
      }
    }
  }

  throw lastError || new Error('Download failed after retries')
}

/**
 * Resize image to fit within max dimensions while maintaining aspect ratio
 * Handles EXIF orientation, alpha channels, and colorspace conversion
 */
async function resizeImage(
  imageBuffer: Buffer,
  maxWidth: number,
  maxHeight: number,
  background: { r: number; g: number; b: number } = { r: 255, g: 255, b: 255 },
): Promise<Buffer> {
  return sharp(imageBuffer, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate() // Auto-rotate based on EXIF orientation
    .flatten({ background }) // Handle alpha channel (PNG transparency)
    .toColorspace('srgb') // Ensure consistent RGB output (handles CMYK)
    .resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toBuffer()
}

/**
 * Calculate position for horizontal (side-by-side) layout
 * Each image gets a fixed-width slot, and is centered within that slot
 */
function calculateHorizontalPosition(
  index: number,
  imageCount: number,
  canvasWidth: number,
  canvasHeight: number,
  imageWidth: number,
  imageHeight: number,
  slotWidth: number,
): { top: number; left: number } {
  const spacing = 20
  const totalWidth = slotWidth * imageCount + spacing * (imageCount - 1)
  const startX = Math.floor((canvasWidth - totalWidth) / 2)

  // Center image within its slot
  const slotLeft = startX + index * (slotWidth + spacing)
  const imageOffsetInSlot = Math.floor((slotWidth - imageWidth) / 2)

  // Clamp positions to ensure images stay within canvas
  return {
    top: Math.max(0, Math.floor((canvasHeight - imageHeight) / 2)),
    left: Math.max(0, slotLeft + imageOffsetInSlot),
  }
}

/**
 * Calculate position coordinates for grid layout in collage
 */
function calculateGridPosition(
  index: number,
  imageCount: number,
  canvasWidth: number,
  canvasHeight: number,
  imageWidth: number,
  imageHeight: number,
): { top: number; left: number } {
  let top: number
  let left: number

  if (imageCount === 1) {
    // Center single image
    top = Math.floor((canvasHeight - imageHeight) / 2)
    left = Math.floor((canvasWidth - imageWidth) / 2)
  } else if (imageCount === 2) {
    // Two images side by side
    const spacing = 40
    const totalWidth = imageWidth * 2 + spacing
    const startX = Math.floor((canvasWidth - totalWidth) / 2)

    top = Math.floor((canvasHeight - imageHeight) / 2)
    left = startX + index * (imageWidth + spacing)
  } else if (imageCount <= 4) {
    // 2x2 grid
    const spacing = 40
    const row = Math.floor(index / 2)
    const col = index % 2
    const totalWidth = imageWidth * 2 + spacing
    const totalHeight = imageHeight * 2 + spacing
    const startX = Math.floor((canvasWidth - totalWidth) / 2)
    const startY = Math.floor((canvasHeight - totalHeight) / 2)

    top = startY + row * (imageHeight + spacing)
    left = startX + col * (imageWidth + spacing)
  } else {
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

    top = startY + row * (imageHeight + spacing)
    left = startX + col * (imageWidth + spacing)
  }

  // Clamp positions to ensure images stay within canvas
  return {
    top: Math.max(0, top),
    left: Math.max(0, left),
  }
}

/**
 * Calculate semantic layout with three sections: Model | Accessories | Outfit
 * Space is redistributed when sections are empty
 */
function calculateSemanticPositions(
  images: Array<{ buffer: Buffer; width: number; height: number; type: 'model' | 'outfit' | 'accessory' }>,
  canvasWidth: number,
  canvasHeight: number,
): Array<{ input: Buffer; top: number; left: number }> {
  const modelImages = images.filter((img) => img.type === 'model')
  const accessoryImages = images.filter((img) => img.type === 'accessory')
  const outfitImages = images.filter((img) => img.type === 'outfit')

  const hasModel = modelImages.length > 0
  const hasAccessories = accessoryImages.length > 0
  const hasOutfits = outfitImages.length > 0
  const sectionCount = [hasModel, hasAccessories, hasOutfits].filter(Boolean).length

  if (sectionCount === 0) return []

  const margin = 40
  const sectionSpacing = 30
  const availableWidth = canvasWidth - margin * 2 - sectionSpacing * (sectionCount - 1)
  const sectionWidth = Math.floor(availableWidth / sectionCount)
  const availableHeight = canvasHeight - margin * 2

  const composites: Array<{ input: Buffer; top: number; left: number }> = []

  let currentX = margin
  let sectionIndex = 0

  // Model section (single large portrait image)
  if (hasModel) {
    const img = modelImages[0]
    const maxWidth = sectionWidth
    const maxHeight = availableHeight

    // Center model in its section
    const left = currentX + Math.floor((maxWidth - img.width) / 2)
    const top = margin + Math.floor((maxHeight - img.height) / 2)

    composites.push({
      input: img.buffer,
      top: Math.max(margin, top),
      left: Math.max(currentX, left),
    })

    currentX += sectionWidth + sectionSpacing
    sectionIndex++
  }

  // Accessories section (2-column grid)
  if (hasAccessories) {
    const cols = 2
    const rows = Math.ceil(accessoryImages.length / cols)
    const itemSpacing = 10
    const itemWidth = Math.floor((sectionWidth - itemSpacing * (cols - 1)) / cols)
    const itemHeight = Math.floor((availableHeight - itemSpacing * (rows - 1)) / rows)

    const gridWidth = itemWidth * cols + itemSpacing * (cols - 1)
    const gridHeight = itemHeight * rows + itemSpacing * (rows - 1)
    const gridStartX = currentX + Math.floor((sectionWidth - gridWidth) / 2)
    const gridStartY = margin + Math.floor((availableHeight - gridHeight) / 2)

    accessoryImages.forEach((img, index) => {
      const row = Math.floor(index / cols)
      const col = index % cols

      // Center image within its cell
      const cellLeft = gridStartX + col * (itemWidth + itemSpacing)
      const cellTop = gridStartY + row * (itemHeight + itemSpacing)
      const offsetX = Math.floor((itemWidth - img.width) / 2)
      const offsetY = Math.floor((itemHeight - img.height) / 2)

      composites.push({
        input: img.buffer,
        top: Math.max(margin, cellTop + offsetY),
        left: Math.max(currentX, cellLeft + offsetX),
      })
    })

    currentX += sectionWidth + sectionSpacing
    sectionIndex++
  }

  // Outfit section (1-2 images stacked or side by side)
  if (hasOutfits) {
    if (outfitImages.length === 1) {
      const img = outfitImages[0]
      const left = currentX + Math.floor((sectionWidth - img.width) / 2)
      const top = margin + Math.floor((availableHeight - img.height) / 2)

      composites.push({
        input: img.buffer,
        top: Math.max(margin, top),
        left: Math.max(currentX, left),
      })
    } else if (outfitImages.length === 2) {
      // Stack two outfits vertically (top/bottom)
      const itemSpacing = 10
      const itemHeight = Math.floor((availableHeight - itemSpacing) / 2)

      outfitImages.forEach((img, index) => {
        const left = currentX + Math.floor((sectionWidth - img.width) / 2)
        const top = margin + index * (itemHeight + itemSpacing) + Math.floor((itemHeight - img.height) / 2)

        composites.push({
          input: img.buffer,
          top: Math.max(margin, top),
          left: Math.max(currentX, left),
        })
      })
    }
  }

  return composites
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

  if (images.length > 10) {
    throw new Error('Maximum 10 images allowed in a collage')
  }

  const opts = { ...DEFAULT_OPTIONS, ...options }
  const imageCount = images.length

  // Download and validate all images in parallel
  const imageBuffers = await Promise.all(
    images.map(async (img) => {
      const buffer = await downloadWithRetry(img.url)
      await validateImage(buffer) // Validate image is valid and within limits
      return { ...img, buffer }
    }),
  )

  // Calculate optimal size for each image based on layout and image count
  let maxImageWidth: number
  let maxImageHeight: number
  let canvasWidth = opts.width
  let canvasHeight = opts.height

  if (opts.layout === 'semantic') {
    // Semantic layout: Model | Accessories | Outfit sections
    // Each image type is resized separately based on its role
    // We'll use a placeholder here and resize per-type below
    maxImageWidth = opts.width
    maxImageHeight = opts.height
  } else if (opts.layout === 'horizontal') {
    // Horizontal layout: all images side by side
    // For horizontal, we want images to be reasonably sized, so we calculate
    // canvas width based on image count rather than squeezing into fixed width
    const spacing = 20
    const totalSpacing = spacing * (imageCount - 1)
    const margin = 100

    // Target image height fills most of canvas height
    maxImageHeight = opts.height - margin

    // Target image width based on a reasonable aspect ratio (3:4 portrait-ish)
    // This ensures images don't get too narrow with many images
    maxImageWidth = Math.floor(maxImageHeight * 0.75)

    // Calculate required canvas width to fit all images
    canvasWidth = maxImageWidth * imageCount + totalSpacing + margin
  } else {
    // Grid layout
    if (imageCount === 1) {
      maxImageWidth = opts.width - 200
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
  }

  // Resize all images with EXIF orientation and alpha handling
  let resizedImages: Array<{
    url: string
    type: 'model' | 'outfit' | 'accessory'
    buffer: Buffer
    width: number
    height: number
  }>

  if (opts.layout === 'semantic') {
    // For semantic layout, resize each type separately based on its section
    const modelCount = imageBuffers.filter((img) => img.type === 'model').length
    const accessoryCount = imageBuffers.filter((img) => img.type === 'accessory').length
    const outfitCount = imageBuffers.filter((img) => img.type === 'outfit').length
    const sectionCount = [modelCount > 0, accessoryCount > 0, outfitCount > 0].filter(Boolean).length

    const margin = 40
    const sectionSpacing = 30
    const availableWidth = canvasWidth - margin * 2 - sectionSpacing * Math.max(0, sectionCount - 1)
    const sectionWidth = sectionCount > 0 ? Math.floor(availableWidth / sectionCount) : canvasWidth - margin * 2
    const availableHeight = canvasHeight - margin * 2

    resizedImages = await Promise.all(
      imageBuffers.map(async (img) => {
        let targetWidth: number
        let targetHeight: number

        if (img.type === 'model') {
          // Model: full section size
          targetWidth = sectionWidth
          targetHeight = availableHeight
        } else if (img.type === 'accessory') {
          // Accessories: fit in 2-column grid
          const cols = 2
          const rows = Math.ceil(accessoryCount / cols)
          const itemSpacing = 10
          targetWidth = Math.floor((sectionWidth - itemSpacing * (cols - 1)) / cols)
          targetHeight = Math.floor((availableHeight - itemSpacing * (rows - 1)) / rows)
        } else {
          // Outfit: full section width, split height if 2
          targetWidth = sectionWidth
          if (outfitCount === 2) {
            const itemSpacing = 10
            targetHeight = Math.floor((availableHeight - itemSpacing) / 2)
          } else {
            targetHeight = availableHeight
          }
        }

        const resized = await resizeImage(img.buffer, targetWidth, targetHeight, opts.background)
        const metadata = await sharp(resized).metadata()
        return {
          ...img,
          buffer: resized,
          width: metadata.width || targetWidth,
          height: metadata.height || targetHeight,
        }
      }),
    )
  } else {
    resizedImages = await Promise.all(
      imageBuffers.map(async (img) => {
        const resized = await resizeImage(img.buffer, maxImageWidth, maxImageHeight, opts.background)
        const metadata = await sharp(resized).metadata()
        return {
          ...img,
          buffer: resized,
          width: metadata.width || maxImageWidth,
          height: metadata.height || maxImageHeight,
        }
      }),
    )
  }

  // Calculate positions for each image based on layout
  let composites: Array<{ input: Buffer; top: number; left: number }>

  if (opts.layout === 'semantic') {
    // Semantic layout uses its own positioning logic
    composites = calculateSemanticPositions(resizedImages, canvasWidth, canvasHeight)
  } else {
    composites = resizedImages.map((img, index) => {
      const position =
        opts.layout === 'horizontal'
          ? calculateHorizontalPosition(index, imageCount, canvasWidth, canvasHeight, img.width, img.height, maxImageWidth)
          : calculateGridPosition(index, imageCount, canvasWidth, canvasHeight, img.width, img.height)

      return {
        input: img.buffer,
        top: position.top,
        left: position.left,
      }
    })
  }

  // Create the collage
  const collage = await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
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
  const buffer = await downloadWithRetry(url)
  const metadata = await validateImage(buffer)

  return {
    width: metadata.width!,
    height: metadata.height!,
  }
}

/**
 * Optimize an image (resize if too large, compress)
 * Handles EXIF orientation, alpha channels, and colorspace conversion
 */
export async function optimizeImage(
  imageBuffer: Buffer,
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 90,
  background: { r: number; g: number; b: number } = { r: 255, g: 255, b: 255 },
): Promise<Buffer> {
  return sharp(imageBuffer, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate() // Auto-rotate based on EXIF orientation
    .flatten({ background }) // Handle alpha channel
    .toColorspace('srgb') // Ensure consistent RGB output
    .resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer()
}
