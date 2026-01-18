'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { YStack, XStack, Text, Card, Image, Button, PageHeader, PageContent, PageFooter } from '@my/ui'
import { Upload, X, RotateCcw } from '@tamagui/lucide-icons'

interface UploadedImage {
  id: string
  file: File
  preview: string
}

const MAX_IMAGES = 5
const ACCEPTED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

export function AdminGenerations() {
  const [images, setImages] = useState<UploadedImage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [stitchedImage, setStitchedImage] = useState<string | null>(null)
  const [isStitching, setIsStitching] = useState(false)

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (images.length + acceptedFiles.length > MAX_IMAGES) {
        setError(`Maximum ${MAX_IMAGES} images allowed`)
        return
      }

      setError(null)

      const newImages = acceptedFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
      }))

      setImages((prev) => [...prev, ...newImages])
    },
    [images]
  )

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: MAX_IMAGES - images.length,
  })

  useEffect(() => {
    if (fileRejections.length > 0) {
      setError('Only JPG, PNG, and WebP images are allowed')
    }
  }, [fileRejections])

  useEffect(() => {
    return () => {
      images.forEach((image) => URL.revokeObjectURL(image.preview))
    }
  }, [images])

  const removeImage = (id: string) => {
    setImages((prev) => {
      const image = prev.find((img) => img.id === id)
      if (image) URL.revokeObjectURL(image.preview)
      return prev.filter((img) => img.id !== id)
    })
    setError(null)
  }

  const handleReset = () => {
    images.forEach((image) => URL.revokeObjectURL(image.preview))
    setImages([])
    setError(null)
    setStitchedImage(null)
    setIsStitching(false)
  }

  const handleStitch = async () => {
    if (images.length === 0) return
    setIsStitching(true)
    // TODO: Call the actual stitch API endpoint
    // For now, just simulate with a placeholder
    setTimeout(() => {
      setStitchedImage(images[0]?.preview || null)
      setIsStitching(false)
    }, 1000)
  }

  return (
    <YStack flex={1} padding="$6" gap="$4">
      <PageContent>
        <PageHeader title="Generations" subtitle="Upload images for virtual try-on generation" />
        <Card padding="$4" bordered>
          <YStack gap="$4">
            {/* Upload Area */}
            <YStack gap="$3">
              <Text fontWeight="600" fontSize="$5">
                Upload Images
              </Text>
              <YStack
                {...getRootProps()}
                padding="$6"
                borderWidth={2}
                borderStyle="dashed"
                borderColor={isDragActive ? '$blue10' : '$borderColor'}
                borderRadius="$4"
                backgroundColor={isDragActive ? '$blue2' : 'transparent'}
                alignItems="center"
                justifyContent="center"
                minHeight={200}
                cursor="pointer"
                hoverStyle={{
                  borderColor: '$color10',
                }}
              >
                <input {...getInputProps()} />
                <Upload size={40} color={isDragActive ? '$blue10' : '$color10'} />
                <Text color="$color10" marginTop="$3" textAlign="center">
                  {isDragActive ? 'Drop images here...' : 'Drag & drop images, or click to select'}
                </Text>
                <Text color="$color8" fontSize="$2" marginTop="$2">
                  JPG, PNG, WebP (max {MAX_IMAGES} images)
                </Text>
              </YStack>
              {error && (
                <Text color="$red10" fontSize="$3">
                  {error}
                </Text>
              )}
            </YStack>

            {/* Preview Grid - below upload area */}
            {images.length > 0 && (
              <YStack gap="$3">
                <Text fontWeight="600" fontSize="$4">
                  Preview ({images.length}/{MAX_IMAGES})
                </Text>
                <XStack flexWrap="wrap" gap="$3">
                  {images.map((image) => (
                    <YStack key={image.id} position="relative">
                      <Image
                        source={{ uri: image.preview }}
                        width={100}
                        height={100}
                        borderRadius="$2"
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
                        onPress={() => removeImage(image.id)}
                      >
                        <X size={12} color="white" />
                      </Button>
                    </YStack>
                  ))}
                </XStack>
              </YStack>
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
              <YStack alignItems="center">
                <Image
                  source={{ uri: stitchedImage }}
                  width={400}
                  height={400}
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
      </PageContent>

      <PageFooter>
        <XStack justifyContent="space-between" alignItems="center">
          <Text color="$color8" fontSize="$2">
            {images.length} image{images.length !== 1 ? 's' : ''} selected
          </Text>
          <XStack gap="$3">
            {(images.length > 0 || stitchedImage) && (
              <Button size="$3" variant="outlined" onPress={handleReset}>
                <RotateCcw size={16} />
                Cancel
              </Button>
            )}
            {images.length > 0 && (
              <Button
                size="$3"
                theme="alt1"
                onPress={handleStitch}
                disabled={isStitching}
              >
                {isStitching ? 'Stitching...' : 'Stitch'}
              </Button>
            )}
            {stitchedImage && (
              <Button size="$3" theme="active">
                Generate Try-On
              </Button>
            )}
          </XStack>
        </XStack>
      </PageFooter>
    </YStack>
  )
}
