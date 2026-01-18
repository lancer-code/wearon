import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { createCollage } from '../services/image-processor'

export const storageRouter = router({
  stitch: protectedProcedure
    .input(
      z.object({
        imageUrls: z.array(z.string().url()).min(1).max(6),
        width: z.number().optional().default(2048),
        height: z.number().optional().default(2048),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const images = input.imageUrls.map((url, index) => ({
        url,
        type: (index === 0 ? 'model' : 'outfit') as 'model' | 'outfit' | 'accessory',
      }))

      const collageBuffer = await createCollage(images, {
        width: input.width,
        height: input.height,
        quality: 95,
      })

      const fileName = `admin-stitch-${Date.now()}.jpg`
      const { error: uploadError } = await ctx.supabase.storage
        .from('virtual-tryon-images')
        .upload(`stitched/${fileName}`, collageBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      if (uploadError) {
        throw new Error(`Failed to upload collage: ${uploadError.message}`)
      }

      const { data: urlData } = ctx.supabase.storage
        .from('virtual-tryon-images')
        .getPublicUrl(`stitched/${fileName}`)

      return { url: urlData.publicUrl }
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
