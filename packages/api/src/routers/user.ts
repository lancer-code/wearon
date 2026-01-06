import { z } from 'zod'
import { router, publicProcedure, protectedProcedure } from '../trpc'

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase.auth.getUser()

    if (error) {
      throw new Error(error.message)
    }

    return data.user
  }),

  byId: publicProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      // Query user profile from auth.users or custom users table
      const { data, error} = await ctx.supabase.auth.admin.getUserById(input.id)

      if (error) {
        throw new Error(error.message)
      }

      return data.user
    }),

  update: protectedProcedure
    .input(
      z.object({
        displayName: z.string().optional(),
        avatarUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase.auth.updateUser({
        data: {
          display_name: input.displayName,
          avatar_url: input.avatarUrl,
        },
      })

      if (error) {
        throw new Error(error.message)
      }

      return data.user
    }),
})
