import { z } from 'zod'
import { router, publicProcedure, protectedProcedure } from '../trpc'

export const authRouter = router({
  signUp: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(6),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase.auth.signUp({
        email: input.email,
        password: input.password,
      })

      if (error) {
        throw new Error(error.message)
      }

      return {
        user: data.user,
        session: data.session,
      }
    }),

  signIn: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      })

      if (error) {
        throw new Error(error.message)
      }

      return {
        user: data.user,
        session: data.session,
      }
    }),

  signOut: protectedProcedure.mutation(async ({ ctx }) => {
    const { error } = await ctx.supabase.auth.signOut()

    if (error) {
      throw new Error(error.message)
    }

    return { success: true }
  }),

  session: publicProcedure.query(async ({ ctx }) => {
    const {
      data: { session },
      error,
    } = await ctx.supabase.auth.getSession()

    if (error) {
      throw new Error(error.message)
    }

    return session
  }),

  updatePassword: protectedProcedure
    .input(
      z.object({
        newPassword: z.string().min(6),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase.auth.updateUser({
        password: input.newPassword,
      })

      if (error) {
        throw new Error(error.message)
      }

      return { user: data.user }
    }),
})
