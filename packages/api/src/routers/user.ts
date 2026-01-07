import { z } from 'zod'
import { router, publicProcedure, protectedProcedure } from '../trpc'

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const { data: authData, error: authError } = await ctx.supabase.auth.getUser()

    if (authError) {
      throw new Error(authError.message)
    }

    // Get extended profile from users table
    const { data: profileData, error: profileError } = await ctx.supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (profileError) {
      throw new Error(profileError.message)
    }

    return {
      ...authData.user,
      profile: profileData,
    }
  }),

  byId: publicProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      // Query user profile from users table
      const { data, error } = await ctx.supabase
        .from('users')
        .select('*')
        .eq('id', input.id)
        .single()

      if (error) {
        throw new Error(error.message)
      }

      return data
    }),

  update: protectedProcedure
    .input(
      z.object({
        displayName: z.string().optional(),
        avatarUrl: z.string().url().optional(),
        gender: z.enum(['male', 'female', 'other']).optional(),
        age: z.number().int().min(13).max(120).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Update auth metadata
      const { data: authData, error: authError } = await ctx.supabase.auth.updateUser({
        data: {
          display_name: input.displayName,
          avatar_url: input.avatarUrl,
        },
      })

      if (authError) {
        throw new Error(authError.message)
      }

      // Update extended profile in users table
      const updateData: Record<string, unknown> = {}
      if (input.displayName !== undefined) updateData.display_name = input.displayName
      if (input.avatarUrl !== undefined) updateData.avatar_url = input.avatarUrl
      if (input.gender !== undefined) updateData.gender = input.gender
      if (input.age !== undefined) updateData.age = input.age

      const { data: profileData, error: profileError } = await ctx.supabase
        .from('users')
        .update(updateData)
        .eq('id', authData.user.id)
        .select()
        .single()

      if (profileError) {
        throw new Error(profileError.message)
      }

      return {
        ...authData.user,
        profile: profileData,
      }
    }),
})
