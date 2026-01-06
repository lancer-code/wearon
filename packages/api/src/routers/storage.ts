import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'

export const storageRouter = router({
  upload: protectedProcedure
    .input(
      z.object({
        bucket: z.string(),
        path: z.string(),
        file: z.string(), // base64 encoded file
        contentType: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Decode base64 file
      const fileBuffer = Buffer.from(input.file, 'base64')

      const { data, error } = await ctx.supabase.storage
        .from(input.bucket)
        .upload(input.path, fileBuffer, {
          contentType: input.contentType,
          upsert: false,
        })

      if (error) {
        throw new Error(error.message)
      }

      return data
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
