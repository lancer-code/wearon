'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { YStack, XStack, Text, Card, Image, Button, PageHeader, PageContent, PageFooter, Input, useToastController } from '@my/ui'
import { Upload, X, RotateCcw, User, Watch, Shirt, Sparkles, Wifi, WifiOff } from '@tamagui/lucide-icons'
import { trpc } from '../../utils/trpc'
import { useSupabase } from '../../provider/SupabaseProvider'
import { supabase } from '../../utils/supabase'
import type { Tables } from '@my/api/src/types/databaseTypes'

type GenerationSession = Tables<'generation_sessions'>

interface UploadedImage {
  id: string
  file: File
  preview: string
}

const ACCEPTED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

// Upload file directly to Supabase using presigned URL
const uploadToPresignedUrl = async (
  file: File,
  uploadUrl: string,
  token: string
): Promise<void> => {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  })

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`)
  }
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

  // Generation state
  const [userPrompt, setUserPrompt] = useState('')
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [stitchedImage, setStitchedImage] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<string | null>(null)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')

  const toast = useToastController()
  useSupabase() // Keep hook for auth state if needed

  const getUploadUrlsMutation = trpc.storage.getUploadUrls.useMutation()
  const generateMutation = trpc.generation.create.useMutation()

  // Establish Realtime connection on page load - subscribe to generation_sessions table
  useEffect(() => {
    console.log('[Realtime] Establishing connection to generation_sessions table...')
    setRealtimeStatus('connecting')

    const channel = supabase
      .channel('admin-generations-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'generation_sessions',
        },
        (payload) => {
          console.log('[Realtime] Received change from generation_sessions:', payload)
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Connection status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Successfully connected to generation_sessions table')
          setRealtimeStatus('connected')
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.log('[Realtime] Connection failed:', status)
          setRealtimeStatus('disconnected')
        } else {
          setRealtimeStatus('connecting')
        }
      })

    return () => {
      console.log('[Realtime] Cleaning up generation_sessions channel')
      supabase.removeChannel(channel)
    }
  }, [])

  // Realtime subscription for generation session updates
  useEffect(() => {
    if (!currentSessionId) {
      return
    }

    console.log('[Realtime] Setting up subscription for session:', currentSessionId)

    const channel = supabase
      .channel(`generation-${currentSessionId}`)
      .on<GenerationSession>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'generation_sessions',
          filter: `id=eq.${currentSessionId}`,
        },
        (payload) => {
          console.log('[Realtime] Received update:', payload)
          const session = payload.new as GenerationSession

          // Capture stitched image URL when available
          if (session.stitched_image_url) {
            console.log('[Realtime] Stitched image ready:', session.stitched_image_url)
            setStitchedImage(session.stitched_image_url)
          }

          if (session.status === 'completed' && session.generated_image_url) {
            console.log('[Realtime] Generation completed!', session.generated_image_url)
            setGeneratedImage(session.generated_image_url)
            setGenerationStatus(null)
            setIsGenerating(false)
            setCurrentSessionId(null)
            toast.show('Generation completed!', { type: 'success' })
          } else if (session.status === 'failed') {
            console.log('[Realtime] Generation failed:', session.error_message)
            setError(session.error_message || 'Generation failed')
            setGenerationStatus(null)
            setIsGenerating(false)
            setCurrentSessionId(null)
            toast.show(session.error_message || 'Generation failed', { type: 'error' })
          } else if (session.status === 'processing') {
            console.log('[Realtime] Generation processing...')
            setGenerationStatus('Processing with Grok AI...')
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Session subscription status:', status)
      })

    return () => {
      console.log('[Realtime] Removing channel for session:', currentSessionId)
      supabase.removeChannel(channel)
    }
  }, [currentSessionId, toast])

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
    setGeneratedImage(null)
    setStitchedImage(null)
    setIsGenerating(false)
    setGenerationStatus(null)
    setUserPrompt('')
    setCurrentSessionId(null)
  }

  const totalImages = modelImages.length + accessoryImages.length + outfitImages.length

  const handleGenerate = async () => {
    if (modelImages.length === 0) return
    setIsGenerating(true)
    setError(null)
    setGeneratedImage(null)
    setStitchedImage(null)
    setGenerationStatus('Preparing uploads...')

    try {
      // Prepare all files for upload
      const filesToUpload: { file: File; type: 'model' | 'outfit' | 'accessory' }[] = []

      // Add model image
      filesToUpload.push({ file: modelImages[0].file, type: 'model' })

      // Add outfit images
      outfitImages.forEach((img) => {
        filesToUpload.push({ file: img.file, type: 'outfit' })
      })

      // Add accessory images
      accessoryImages.forEach((img) => {
        filesToUpload.push({ file: img.file, type: 'accessory' })
      })

      // Step 1: Get presigned upload URLs for all files at once
      setGenerationStatus(`Getting upload URLs for ${filesToUpload.length} images...`)
      const { uploads } = await getUploadUrlsMutation.mutateAsync({
        files: filesToUpload.map((f) => ({
          fileName: f.file.name,
          contentType: f.file.type,
          type: f.type,
        })),
      })

      // Step 2: Upload all files CONCURRENTLY using presigned URLs
      setGenerationStatus(`Uploading ${filesToUpload.length} images concurrently...`)
      await Promise.all(
        uploads.map((upload, index) =>
          uploadToPresignedUrl(filesToUpload[index].file, upload.uploadUrl, upload.token)
        )
      )

      setGenerationStatus('Queuing generation job...')

      // Step 3: Call generation endpoint with download URLs
      const modelUpload = uploads.find((u) => u.type === 'model')
      const outfitUpload = uploads.find((u) => u.type === 'outfit')
      const accessoryUploads = uploads.filter((u) => u.type === 'accessory')

      const result = await generateMutation.mutateAsync({
        modelImageUrl: modelUpload!.downloadUrl,
        outfitImageUrl: outfitUpload?.downloadUrl,
        accessories: accessoryUploads.length > 0
          ? accessoryUploads.map((u, i) => ({ type: `accessory-${i}`, url: u.downloadUrl }))
          : undefined,
        promptUser: userPrompt || undefined,
      })

      // Set session ID to trigger Realtime subscription
      setCurrentSessionId(result.sessionId)
      setGenerationStatus('Processing... Waiting for results via Realtime.')

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate try-on'
      setError(message)
      setGenerationStatus(null)
      setIsGenerating(false)
      toast.show(message, { type: 'error' })
    }
  }

  return (
    <YStack flex={1} padding="$6" gap="$4">
      <PageContent>
        <XStack justifyContent="space-between" alignItems="flex-start">
          <PageHeader title="Generations" subtitle="Upload images for virtual try-on generation" />
          <XStack alignItems="center" gap="$2" paddingTop="$2">
            <YStack
              width={10}
              height={10}
              borderRadius={5}
              backgroundColor={
                realtimeStatus === 'connected' ? '$green10' :
                realtimeStatus === 'connecting' ? '$yellow10' : '$red10'
              }
            />
            <Text fontSize="$2" color="$color8">
              {realtimeStatus === 'connected' ? 'Realtime Connected' :
               realtimeStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </Text>
          </XStack>
        </XStack>
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

        {/* Stitched Collage Preview - shows when generating or has stitched image */}
        {(generationStatus || stitchedImage) && (
          <Card padding="$4" bordered>
            <YStack gap="$3">
              <XStack alignItems="center" justifyContent="space-between">
                <Text fontWeight="600" fontSize="$5">
                  Stitched Collage
                </Text>
                {isGenerating && (
                  <XStack alignItems="center" gap="$2">
                    <YStack
                      width={10}
                      height={10}
                      borderRadius={5}
                      backgroundColor={
                        realtimeStatus === 'connected' ? '$green10' :
                        realtimeStatus === 'connecting' ? '$yellow10' : '$red10'
                      }
                    />
                    <Text fontSize="$2" color="$color8">
                      {generationStatus || 'Processing...'}
                    </Text>
                  </XStack>
                )}
              </XStack>
              {stitchedImage ? (
                <YStack alignItems="center" width="100%">
                  <Image
                    source={{ uri: stitchedImage }}
                    width="100%"
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
                  minHeight={150}
                >
                  <Text color="$color8" textAlign="center">
                    {generationStatus || 'Creating collage...'}
                  </Text>
                </YStack>
              )}
            </YStack>
          </Card>
        )}

        {/* User Prompt Section */}
        {modelImages.length > 0 && (
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
            <XStack alignItems="center" justifyContent="space-between">
              <XStack alignItems="center" gap="$2">
                <Sparkles size={20} color="$color10" />
                <Text fontWeight="600" fontSize="$5">
                  Generated Try-On
                </Text>
              </XStack>
              {isGenerating && (
                <XStack alignItems="center" gap="$2">
                  <YStack
                    width={10}
                    height={10}
                    borderRadius={5}
                    backgroundColor={
                      realtimeStatus === 'connected' ? '$green10' :
                      realtimeStatus === 'connecting' ? '$yellow10' : '$red10'
                    }
                  />
                  <Text fontSize="$2" color="$color8">
                    {realtimeStatus === 'connected' ? 'Live' :
                     realtimeStatus === 'connecting' ? 'Connecting...' : 'Offline'}
                  </Text>
                </XStack>
              )}
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
                    : 'Upload a model photo and click "Generate Try-On" to create a virtual try-on.'}
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
            {(totalImages > 0 || generatedImage) && (
              <Button size="$3" variant="outlined" onPress={handleReset}>
                <RotateCcw size={16} />
                Reset
              </Button>
            )}
            {modelImages.length > 0 && (
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
