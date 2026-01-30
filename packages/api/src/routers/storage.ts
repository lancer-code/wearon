import { z } from 'zod'
import { router, protectedProcedure, adminProcedure } from '../trpc'

export const storageRouter = router({
  // Get presigned upload URLs for direct client-to-storage upload
  // This is the recommended approach - bypasses backend for file upload
  getUploadUrls: adminProcedure
    .input(
      z.object({
        files: z.array(
          z.object({
            fileName: z.string(),
            contentType: z.string(),
            type: z.enum(['model', 'outfit', 'accessory']),
          })
        ).min(1).max(10),
        bucket: z.string().default('virtual-tryon-images'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const results = await Promise.all(
        input.files.map(async (file) => {
          const path = `uploads/${file.type}-${Date.now()}-${crypto.randomUUID()}.${file.fileName.split('.').pop()}`

          // Create signed upload URL (valid for 1 hour)
          const { data, error } = await ctx.adminSupabase.storage
            .from(input.bucket)
            .createSignedUploadUrl(path)

          if (error) {
            throw new Error(`Failed to create upload URL for ${file.fileName}: ${error.message}`)
          }

          // Also create a signed download URL for after upload (valid for 6 hours)
          const { data: downloadData, error: downloadError } = await ctx.adminSupabase.storage
            .from(input.bucket)
            .createSignedUrl(path, 6 * 60 * 60) // 6 hours

          if (downloadError) {
            throw new Error(`Failed to create download URL for ${file.fileName}: ${downloadError.message}`)
          }

          return {
            fileName: file.fileName,
            type: file.type,
            path,
            uploadUrl: data.signedUrl,
            token: data.token,
            downloadUrl: downloadData.signedUrl,
          }
        })
      )

      return { uploads: results }
    }),

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
