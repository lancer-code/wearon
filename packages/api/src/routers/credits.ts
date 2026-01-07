import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'

export const creditsRouter = router({
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await ctx.supabase
      .from('user_credits')
      .select('balance, total_earned, total_spent, updated_at')
      .eq('user_id', ctx.user.id)
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return data
  }),

  getTransactions: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new Error('Unauthorized')
      }

      const { data, error } = await ctx.supabase
        .from('credit_transactions')
        .select('id, amount, type, description, created_at')
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false })
        .range(input.offset, input.offset + input.limit - 1)

      if (error) {
        throw new Error(error.message)
      }

      return data
    }),
})
