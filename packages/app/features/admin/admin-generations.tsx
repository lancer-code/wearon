'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { YStack, XStack, Text, Card, Image, Button, PageHeader, PageContent, PageFooter, Input, useToastController } from '@my/ui'
import { Upload, X, RotateCcw, User, Watch, Shirt, Sparkles } from '@tamagui/lucide-icons'
import { trpc } from '../../utils/trpc'

interface UploadedImage {
  id: string
  file: File
  preview: string
}

type ImageType = 'model' | 'accessory' | 'outfit'

const ACCEPTED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

// Helper to convert File to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      const result = reader.result as string
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1]
      resolve(base64 || '')
    }
    reader.onerror = reject
  })
}

interface DropzoneProps {
  images: UploadedImage[]
  onDrop: (files: File[]) => void
  onRemove: (id: string) => void
  maxFiles: number
  title: string
  subtitle: string
  icon: React.ReactNode
  previewLayout?: 'single' | 'grid' | 'vertical'
  existingFiles?: File[] // For duplicate detection across all dropzones
}

// Helper to check if file is duplicate (same name and size)
const isDuplicateFile = (file: File, existingFiles: File[]): boolean => {
  return existingFiles.some(
    (existing) => existing.name === file.name && existing.size === file.size
  )
}

function ImageDropzone({ images, onDrop, onRemove, maxFiles, title, subtitle, icon, previewLayout = 'single', existingFiles = [] }: DropzoneProps) {
  const [localError, setLocalError] = useState<string | null>(null)

  const handleDrop = useCallback(
    (acceptedFiles: File[]) => {
      // Filter out duplicates
      const uniqueFiles = acceptedFiles.filter((file) => {
        const allExisting = [...existingFiles, ...images.map((img) => img.file)]
        if (isDuplicateFile(file, allExisting)) {
          setLocalError(`"${file.name}" is already added`)
          return false
        }
        return true
      })

      if (uniqueFiles.length === 0) return

      if (images.length + uniqueFiles.length > maxFiles) {
        setLocalError(`Maximum ${maxFiles} image${maxFiles > 1 ? 's' : ''} allowed`)
        return
      }
      setLocalError(null)
      onDrop(uniqueFiles)
    },
    [images, maxFiles, onDrop, existingFiles]
  )

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop: handleDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: maxFiles - images.length,
  })

  useEffect(() => {
    if (fileRejections.length > 0) {
      setLocalError('Only JPG, PNG, and WebP images are allowed')
    }
  }, [fileRejections])

  const renderPreviews = () => {
    if (images.length === 0) return null

    if (previewLayout === 'grid') {
      return (
        <XStack flexWrap="wrap" gap="$2" justifyContent="center" width="100%">
          {images.map((image) => (
            <YStack key={image.id} position="relative" width={70} height={70}>
              <Image
                source={{ uri: image.preview }}
                width={70}
                height={70}
                borderRadius="$2"
                objectFit="cover"
              />
              <Button
                size="$1"
                circular
                position="absolute"
                top={-6}
                right={-6}
                backgroundColor="$red10"
                hoverStyle={{ backgroundColor: '$red11' }}
                onPress={() => onRemove(image.id)}
              >
                <X size={10} color="white" />
              </Button>
            </YStack>
          ))}
        </XStack>
      )
    }

    if (previewLayout === 'vertical') {
      return (
        <YStack gap="$2" alignItems="center">
          {images.map((image) => (
            <YStack key={image.id} position="relative">
              <Image
                source={{ uri: image.preview }}
                width={80}
                height={90}
                borderRadius="$2"
                objectFit="cover"
              />
              <Button
                size="$1"
                circular
                position="absolute"
                top={-6}
                right={-6}
                backgroundColor="$red10"
                hoverStyle={{ backgroundColor: '$red11' }}
                onPress={() => onRemove(image.id)}
              >
                <X size={10} color="white" />
              </Button>
            </YStack>
          ))}
        </YStack>
      )
    }

    // Single layout (for model)
    const image = images[0]
    return (
      <YStack position="relative" alignItems="center">
        <Image
          source={{ uri: image.preview }}
          width={120}
          height={160}
          borderRadius="$3"
          objectFit="cover"
        />
        <Button
          size="$2"
          circular
          position="absolute"
          top={-8}
          right={-8}
          backgroundColor="$red10"
          hoverStyle={{ backgroundColor: '$red11' }}
          onPress={() => onRemove(image.id)}
        >
          <X size={12} color="white" />
        </Button>
      </YStack>
    )
  }

  return (
    <YStack flex={1} gap="$2">
      <XStack alignItems="center" gap="$2">
        {icon}
        <Text fontWeight="600" fontSize="$4">
          {title}
        </Text>
        <Text color="$color8" fontSize="$2">
          ({images.length}/{maxFiles})
        </Text>
      </XStack>

      <YStack
        {...getRootProps()}
        padding="$3"
        borderWidth={2}
        borderStyle="dashed"
        borderColor={isDragActive ? '$blue10' : '$borderColor'}
        borderRadius="$4"
        backgroundColor={isDragActive ? '$blue2' : 'transparent'}
        alignItems="center"
        justifyContent="center"
        height={220}
        cursor="pointer"
        hoverStyle={{
          borderColor: '$color10',
        }}
      >
        <input {...getInputProps()} />
        {images.length === 0 ? (
          <>
            <Upload size={24} color={isDragActive ? '$blue10' : '$color10'} />
            <Text color="$color10" marginTop="$2" textAlign="center" fontSize="$2">
              {isDragActive ? 'Drop here...' : subtitle}
            </Text>
          </>
        ) : (
          renderPreviews()
        )}
      </YStack>

      {localError && (
        <Text color="$red10" fontSize="$2">
          {localError}
        </Text>
      )}
    </YStack>
  )
}

export function AdminGenerations() {
  const [modelImages, setModelImages] = useState<UploadedImage[]>([])
  const [accessoryImages, setAccessoryImages] = useState<UploadedImage[]>([])
  const [outfitImages, setOutfitImages] = useState<UploadedImage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [stitchedImage, setStitchedImage] = useState<string | null>(null)
  const [isStitching, setIsStitching] = useState(false)

  // Generation state
  const [userPrompt, setUserPrompt] = useState('')
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<string | null>(null)

  const toast = useToastController()

  const adminUploadMutation = trpc.storage.adminUpload.useMutation()
  const stitchMutation = trpc.storage.stitch.useMutation()
  const generateMutation = trpc.generation.create.useMutation()

  const createDropHandler = (
    setImages: React.Dispatch<React.SetStateAction<UploadedImage[]>>
  ) => {
    return (acceptedFiles: File[]) => {
      const newImages = acceptedFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
      }))
      setImages((prev) => [...prev, ...newImages])
    }
  }

  const createRemoveHandler = (
    setImages: React.Dispatch<React.SetStateAction<UploadedImage[]>>
  ) => {
    return (id: string) => {
      setImages((prev) => {
        const image = prev.find((img) => img.id === id)
        if (image) URL.revokeObjectURL(image.preview)
        return prev.filter((img) => img.id !== id)
      })
      setError(null)
    }
  }

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      modelImages.forEach((image) => URL.revokeObjectURL(image.preview))
      accessoryImages.forEach((image) => URL.revokeObjectURL(image.preview))
      outfitImages.forEach((image) => URL.revokeObjectURL(image.preview))
    }
  }, [modelImages, accessoryImages, outfitImages])

  const handleReset = () => {
    modelImages.forEach((image) => URL.revokeObjectURL(image.preview))
    accessoryImages.forEach((image) => URL.revokeObjectURL(image.preview))
    outfitImages.forEach((image) => URL.revokeObjectURL(image.preview))
    setModelImages([])
    setAccessoryImages([])
    setOutfitImages([])
    setError(null)
    setStitchedImage(null)
    setIsStitching(false)
    setGeneratedImage(null)
    setIsGenerating(false)
    setGenerationStatus(null)
    setUserPrompt('')
  }

  const totalImages = modelImages.length + accessoryImages.length + outfitImages.length

  const handleStitch = async () => {
    if (totalImages === 0) return
    setIsStitching(true)
    setError(null)

    try {
      // Combine all images with their types
      const allImages: Array<{ images: UploadedImage[]; type: ImageType }> = [
        { images: modelImages, type: 'model' },
        { images: accessoryImages, type: 'accessory' },
        { images: outfitImages, type: 'outfit' },
      ]

      // Upload files sequentially to avoid rate limiting
      const uploadedImages: Array<{ url: string; type: ImageType }> = []

      for (const { images, type } of allImages) {
        for (const img of images) {
          const fileName = `admin-upload-${Date.now()}-${img.id}.${img.file.name.split('.').pop()}`
          const filePath = `uploads/${fileName}`
          const fileBase64 = await fileToBase64(img.file)

          const result = await adminUploadMutation.mutateAsync({
            bucket: 'virtual-tryon-images',
            path: filePath,
            fileBase64,
            contentType: img.file.type,
          })

          uploadedImages.push({ url: result.signedUrl, type })
        }
      }

      // Call the stitch endpoint with the uploaded images (uses semantic layout by default)
      const result = await stitchMutation.mutateAsync({
        images: uploadedImages,
      })

      setStitchedImage(result.url)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create collage'
      setError(message)
      toast.show(message, { type: 'error' })
    } finally {
      setIsStitching(false)
    }
  }

  const handleGenerate = async () => {
    if (!stitchedImage || modelImages.length === 0) return
    setIsGenerating(true)
    setError(null)
    setGenerationStatus('Starting generation...')

    try {
      // Get model image URL (first uploaded model image)
      const modelFile = modelImages[0]
      const modelFileName = `model-${Date.now()}-${modelFile.id}.${modelFile.file.name.split('.').pop()}`
      const modelFilePath = `uploads/${modelFileName}`
      const modelFileBase64 = await fileToBase64(modelFile.file)

      const modelUploadResult = await adminUploadMutation.mutateAsync({
        bucket: 'virtual-tryon-images',
        path: modelFilePath,
        fileBase64: modelFileBase64,
        contentType: modelFile.file.type,
      })

      setGenerationStatus('Queuing generation job...')

      // Call generation endpoint
      const result = await generateMutation.mutateAsync({
        modelImageUrl: modelUploadResult.signedUrl,
        outfitImageUrl: outfitImages.length > 0 ? stitchedImage : undefined,
        accessories: accessoryImages.length > 0 ? accessoryImages.map((img, i) => ({
          type: `accessory-${i}`,
          url: stitchedImage!, // Use stitched image which contains all accessories
        })) : undefined,
        promptUser: userPrompt || undefined,
      })

      setGenerationStatus(`Job queued (Session: ${result.sessionId}). Processing...`)

      // For now, show a placeholder message since generation is async
      // In production, you'd poll the session status or use Supabase Realtime
      setGeneratedImage(null)
      setGenerationStatus('Generation job submitted. Check generation history for results.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate try-on'
      setError(message)
      setGenerationStatus(null)
      toast.show(message, { type: 'error' })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <YStack flex={1} padding="$6" gap="$4">
      <PageContent>
        <PageHeader title="Generations" subtitle="Upload images for virtual try-on generation" />
        <Card padding="$4" bordered>
          <YStack gap="$4">
            {/* Three Dropzones in a Row */}
            <XStack gap="$4" width="100%">
              <ImageDropzone
                images={modelImages}
                onDrop={createDropHandler(setModelImages)}
                onRemove={createRemoveHandler(setModelImages)}
                maxFiles={1}
                title="Model"
                subtitle="Drop model photo"
                icon={<User size={18} color="$color10" />}
                previewLayout="single"
                existingFiles={[...accessoryImages, ...outfitImages].map((img) => img.file)}
              />

              <ImageDropzone
                images={accessoryImages}
                onDrop={createDropHandler(setAccessoryImages)}
                onRemove={createRemoveHandler(setAccessoryImages)}
                maxFiles={6}
                title="Accessories"
                subtitle="Drop accessories"
                icon={<Watch size={18} color="$color10" />}
                previewLayout="grid"
                existingFiles={[...modelImages, ...outfitImages].map((img) => img.file)}
              />

              <ImageDropzone
                images={outfitImages}
                onDrop={createDropHandler(setOutfitImages)}
                onRemove={createRemoveHandler(setOutfitImages)}
                maxFiles={2}
                title="Outfit"
                subtitle="Drop outfit items"
                icon={<Shirt size={18} color="$color10" />}
                previewLayout="vertical"
                existingFiles={[...modelImages, ...accessoryImages].map((img) => img.file)}
              />
            </XStack>

            {error && (
              <Text color="$red10" fontSize="$3">
                {error}
              </Text>
            )}
          </YStack>
        </Card>

        {/* Stitched Image Section */}
        <Card padding="$4" bordered>
          <YStack gap="$3">
            <Text fontWeight="600" fontSize="$5">
              Stitched Image
            </Text>
            {stitchedImage ? (
              <YStack alignItems="center" width="100%">
                <Image
                  source={{ uri: stitchedImage }}
                  width="100%"
                  height={350}
                  borderRadius="$4"
                  objectFit="contain"
                />
              </YStack>
            ) : (
              <YStack
                padding="$6"
                borderWidth={1}
                borderStyle="dashed"
                borderColor="$borderColor"
                borderRadius="$4"
                alignItems="center"
                justifyContent="center"
                minHeight={200}
              >
                <Text color="$color8" textAlign="center">
                  {isStitching ? 'Stitching images...' : 'No stitched image yet. Upload images and click "Stitch" to create a collage.'}
                </Text>
              </YStack>
            )}
          </YStack>
        </Card>

        {/* User Prompt Section */}
        {stitchedImage && (
          <Card padding="$4" bordered>
            <YStack gap="$3">
              <Text fontWeight="600" fontSize="$5">
                Custom Prompt (Optional)
              </Text>
              <Text color="$color8" fontSize="$2">
                Add specific instructions for the AI. E.g., "Make the model smile" or "Use outdoor lighting"
              </Text>
              <Input
                placeholder="Enter additional instructions for the AI..."
                value={userPrompt}
                onChange={(e) => setUserPrompt((e.target as HTMLInputElement).value)}
                multiline
                numberOfLines={3}
                maxLength={500}
              />
              <Text color="$color8" fontSize="$1" textAlign="right">
                {userPrompt.length}/500 characters
              </Text>
            </YStack>
          </Card>
        )}

        {/* Generated Image Section */}
        <Card padding="$4" bordered>
          <YStack gap="$3">
            <XStack alignItems="center" gap="$2">
              <Sparkles size={20} color="$color10" />
              <Text fontWeight="600" fontSize="$5">
                Generated Try-On
              </Text>
            </XStack>
            {generatedImage ? (
              <YStack alignItems="center" width="100%">
                <Image
                  source={{ uri: generatedImage }}
                  width={340}
                  height={450}
                  borderRadius="$4"
                  objectFit="contain"
                />
              </YStack>
            ) : (
              <YStack
                padding="$6"
                borderWidth={1}
                borderStyle="dashed"
                borderColor="$borderColor"
                borderRadius="$4"
                alignItems="center"
                justifyContent="center"
                minHeight={200}
              >
                <Text color="$color8" textAlign="center">
                  {isGenerating
                    ? generationStatus || 'Generating...'
                    : generationStatus || 'No generated image yet. Create a collage and click "Generate Try-On".'}
                </Text>
              </YStack>
            )}
          </YStack>
        </Card>
      </PageContent>

      <PageFooter>
        <XStack justifyContent="space-between" alignItems="center">
          <Text color="$color8" fontSize="$2">
            {totalImages} image{totalImages !== 1 ? 's' : ''} selected
          </Text>
          <XStack gap="$3">
            {(totalImages > 0 || stitchedImage || generatedImage) && (
              <Button size="$3" variant="outlined" onPress={handleReset}>
                <RotateCcw size={16} />
                Reset
              </Button>
            )}
            {totalImages > 0 && (
              <Button
                size="$3"
                theme="alt1"
                onPress={handleStitch}
                disabled={isStitching}
              >
                {isStitching ? 'Stitching...' : 'Stitch'}
              </Button>
            )}
            {stitchedImage && modelImages.length > 0 && (
              <Button
                size="$3"
                theme="active"
                onPress={handleGenerate}
                disabled={isGenerating}
              >
                <Sparkles size={16} />
                {isGenerating ? 'Generating...' : 'Generate Try-On'}
              </Button>
            )}
          </XStack>
        </XStack>
      </PageFooter>
    </YStack>
  )
}
