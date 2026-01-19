import { z } from 'zod'
import { router, protectedProcedure, adminProcedure } from '../trpc'
import { createCollage } from '../services/image-processor'

export const storageRouter = router({
  // Admin upload - uses service role key to bypass RLS
  adminUpload: adminProcedure
    .input(
      z.object({
        bucket: z.string(),
        path: z.string(),
        fileBase64: z.string(),
        contentType: z.string(),
        expiresIn: z.number().optional().default(3600), // 1 hour default
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const fileBuffer = Buffer.from(input.fileBase64, 'base64')

      const { error: uploadError } = await ctx.adminSupabase.storage
        .from(input.bucket)
        .upload(input.path, fileBuffer, {
          contentType: input.contentType,
          upsert: true,
        })

      if (uploadError) {
        throw new Error(`Failed to upload: ${uploadError.message}`)
      }

      // Create signed URL for private bucket access
      const { data: signedUrlData, error: signedUrlError } = await ctx.adminSupabase.storage
        .from(input.bucket)
        .createSignedUrl(input.path, input.expiresIn)

      if (signedUrlError) {
        throw new Error(`Failed to create signed URL: ${signedUrlError.message}`)
      }

      return { signedUrl: signedUrlData.signedUrl }
    }),

  // Stitch images into collage - admin only, uses service role
  stitch: adminProcedure
    .input(
      z.object({
        images: z.array(z.object({
          url: z.string().url(),
          type: z.enum(['model', 'outfit', 'accessory']),
        })).min(1).max(10),
        width: z.number().optional().default(1920),
        height: z.number().optional().default(1080),
        layout: z.enum(['grid', 'horizontal', 'semantic']).optional().default('semantic'),
        expiresIn: z.number().optional().default(3600), // 1 hour default
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const images = input.images

      const collageBuffer = await createCollage(images, {
        width: input.width,
        height: input.height,
        layout: input.layout,
        quality: 95,
      })

      const fileName = `admin-stitch-${Date.now()}.jpg`
      const { error: uploadError } = await ctx.adminSupabase.storage
        .from('virtual-tryon-images')
        .upload(`stitched/${fileName}`, collageBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      if (uploadError) {
        throw new Error(`Failed to upload collage: ${uploadError.message}`)
      }

      // Create signed URL for private bucket access
      const { data: signedUrlData, error: signedUrlError } = await ctx.adminSupabase.storage
        .from('virtual-tryon-images')
        .createSignedUrl(`stitched/${fileName}`, input.expiresIn)

      if (signedUrlError) {
        throw new Error(`Failed to create signed URL: ${signedUrlError.message}`)
      }

      return { url: signedUrlData.signedUrl }
    }),

  getPublicUrl: protectedProcedure
    .input(
      z.object({
        bucket: z.string(),
        path: z.string(),
      }),
    )
    .query(({ input, ctx }) => {
      const { data } = ctx.supabase.storage.from(input.bucket).getPublicUrl(input.path)

      return { publicUrl: data.publicUrl }
    }),

  getSignedUrl: protectedProcedure
    .input(
      z.object({
        bucket: z.string(),
        path: z.string(),
        expiresIn: z.number().optional().default(3600), // 1 hour default
      }),
    )
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase.storage
        .from(input.bucket)
        .createSignedUrl(input.path, input.expiresIn)

      if (error) {
        throw new Error(error.message)
      }

      return data
    }),

  delete: protectedProcedure
    .input(
      z.object({
        bucket: z.string(),
        paths: z.array(z.string()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase.storage.from(input.bucket).remove(input.paths)

      if (error) {
        throw new Error(error.message)
      }

      return data
    }),

  listFiles: protectedProcedure
    .input(
      z.object({
        bucket: z.string(),
        path: z.string().optional().default(''),
        limit: z.number().optional().default(100),
        offset: z.number().optional().default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase.storage.from(input.bucket).list(input.path, {
        limit: input.limit,
        offset: input.offset,
      })

      if (error) {
        throw new Error(error.message)
      }

      return data
    }),
})
