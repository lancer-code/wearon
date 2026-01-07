import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'

export const analyticsRouter = router({
  /**
   * Get total generation count (all users)
   * Admin-only in future, but public for now
   */
  getTotalGenerations: protectedProcedure.query(async ({ ctx }) => {
    const { count, error } = await ctx.supabase
      .from('generation_sessions')
      .select('*', { count: 'exact', head: true })

    if (error) {
      throw new Error(error.message)
    }

    return { total: count || 0 }
  }),

  /**
   * Get generation stats by status
   */
  getGenerationStats: protectedProcedure.query(async ({ ctx }) => {
    // Get counts for each status
    const { data: allSessions, error: fetchError } = await ctx.supabase
      .from('generation_sessions')
      .select('status')

    if (fetchError) {
      throw new Error(fetchError.message)
    }

    const stats = {
      total: allSessions?.length || 0,
      completed: allSessions?.filter((s) => s.status === 'completed').length || 0,
      failed: allSessions?.filter((s) => s.status === 'failed').length || 0,
      pending: allSessions?.filter((s) => s.status === 'pending').length || 0,
      processing: allSessions?.filter((s) => s.status === 'processing').length || 0,
    }

    return stats
  }),

  /**
   * Get daily generation statistics
   * Returns count of generations per day for the last 30 days
   */
  getDailyStats: protectedProcedure
    .input(
      z.object({
        days: z.number().int().min(1).max(90).default(30),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from('analytics_events')
        .select('event_type, created_at, metadata')
        .in('event_type', ['generation_completed', 'generation_failed', 'generation_started'])
        .gte('created_at', new Date(Date.now() - input.days * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(error.message)
      }

      // Group by date
      const dailyStats: Record<
        string,
        { date: string; started: number; completed: number; failed: number }
      > = {}

      data?.forEach((event) => {
        const date = new Date(event.created_at).toISOString().split('T')[0]

        if (!dailyStats[date]) {
          dailyStats[date] = { date, started: 0, completed: 0, failed: 0 }
        }

        if (event.event_type === 'generation_started') dailyStats[date].started++
        if (event.event_type === 'generation_completed') dailyStats[date].completed++
        if (event.event_type === 'generation_failed') dailyStats[date].failed++
      })

      return Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date))
    }),

  /**
   * Get user-specific analytics
   */
  getUserStats: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      throw new Error('Unauthorized')
    }

    // Get all user sessions
    const { data: sessions, error: sessionsError } = await ctx.supabase
      .from('generation_sessions')
      .select('*')
      .eq('user_id', ctx.user.id)

    if (sessionsError) {
      throw new Error(sessionsError.message)
    }

    // Calculate stats
    const completed = sessions?.filter((s) => s.status === 'completed') || []
    const failed = sessions?.filter((s) => s.status === 'failed') || []

    const avgProcessingTime =
      completed.length > 0
        ? completed.reduce((sum, s) => sum + (s.processing_time_ms || 0), 0) / completed.length
        : 0

    return {
      total: sessions?.length || 0,
      completed: completed.length,
      failed: failed.length,
      pending: sessions?.filter((s) => s.status === 'pending').length || 0,
      processing: sessions?.filter((s) => s.status === 'processing').length || 0,
      avgProcessingTimeMs: Math.round(avgProcessingTime),
      totalCreditsUsed: sessions?.reduce((sum, s) => sum + (s.credits_used || 0), 0) || 0,
    }
  }),

  /**
   * Get recent events for debugging/monitoring
   */
  getRecentEvents: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        eventType: z
          .enum(['generation_started', 'generation_completed', 'generation_failed', 'user_signup'])
          .optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      let query = ctx.supabase
        .from('analytics_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(input.limit)

      if (input.eventType) {
        query = query.eq('event_type', input.eventType)
      }

      const { data, error } = await query

      if (error) {
        throw new Error(error.message)
      }

      return data
    }),

  /**
   * Get average processing times
   */
  getProcessingMetrics: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('generation_sessions')
      .select('processing_time_ms, status')
      .eq('status', 'completed')
      .not('processing_time_ms', 'is', null)

    if (error) {
      throw new Error(error.message)
    }

    if (!data || data.length === 0) {
      return {
        avgMs: 0,
        minMs: 0,
        maxMs: 0,
        count: 0,
      }
    }

    const times = data.map((s) => s.processing_time_ms || 0)
    const avg = times.reduce((sum, t) => sum + t, 0) / times.length
    const min = Math.min(...times)
    const max = Math.max(...times)

    return {
      avgMs: Math.round(avg),
      minMs: min,
      maxMs: max,
      count: times.length,
    }
  }),
})
