import { z } from 'zod'
import { router, protectedProcedure, adminProcedure } from '../trpc'

const iso8601DateString = z.string().refine(
  (val) => {
    const date = new Date(val)
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(val.substring(0, 10))
  },
  { message: 'Must be a valid ISO 8601 date string' },
)

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
    const { data, error } = await ctx.supabase.rpc('get_generation_status_counts')

    if (error) {
      throw new Error(error.message)
    }

    const rows = Array.isArray(data) ? data : []
    const statusMap: Record<string, number> = {}
    let total = 0

    for (const row of rows) {
      const count = Number(row.count ?? 0)
      statusMap[row.status] = count
      total += count
    }

    return {
      total,
      completed: statusMap['completed'] || 0,
      failed: statusMap['failed'] || 0,
      pending: statusMap['pending'] || 0,
      processing: statusMap['processing'] || 0,
    }
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
    const { data, error } = await ctx.supabase.rpc('get_processing_metrics')

    if (error) {
      throw new Error(error.message)
    }

    const row = Array.isArray(data) ? data[0] : data

    if (!row || Number(row.total) === 0) {
      return {
        avgMs: 0,
        minMs: 0,
        maxMs: 0,
        count: 0,
      }
    }

    return {
      avgMs: Number(row.avg_ms ?? 0),
      minMs: Number(row.min_ms ?? 0),
      maxMs: Number(row.max_ms ?? 0),
      count: Number(row.total ?? 0),
    }
  }),

  /**
   * B2B Overview: total active stores, total B2B generations, total credits consumed
   * Admin-only endpoint
   */
  getB2BOverview: adminProcedure
    .input(
      z.object({
        startDate: iso8601DateString.optional(),
        endDate: iso8601DateString.optional(),
      }).optional(),
    )
    .query(async ({ input, ctx }) => {
      const db = ctx.adminSupabase

      // Total active stores
      const { count: activeStoreCount, error: storesError } = await db
        .from('stores')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      if (storesError) {
        throw new Error(storesError.message)
      }

      // Total B2B generations (with optional date filter)
      let genQuery = db
        .from('store_generation_sessions')
        .select('*', { count: 'exact', head: true })

      if (input?.startDate) {
        genQuery = genQuery.gte('created_at', input.startDate)
      }
      if (input?.endDate) {
        genQuery = genQuery.lte('created_at', input.endDate)
      }

      const { count: totalGenerations, error: genError } = await genQuery

      if (genError) {
        throw new Error(genError.message)
      }

      // Total credits consumed across all stores
      const { data: creditData, error: creditsError } = await db
        .from('store_credits')
        .select('total_spent')

      if (creditsError) {
        throw new Error(creditsError.message)
      }

      const totalCreditsConsumed = creditData?.reduce(
        (sum, row) => sum + (row.total_spent || 0),
        0,
      ) || 0

      // Churn risk count
      const { count: churnRiskCount, error: churnError } = await db
        .from('stores')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .eq('is_churn_risk', true)

      if (churnError) {
        throw new Error(churnError.message)
      }

      return {
        totalActiveStores: activeStoreCount || 0,
        totalGenerations: totalGenerations || 0,
        totalCreditsConsumed,
        churnRiskCount: churnRiskCount || 0,
      }
    }),

  /**
   * B2B Store Breakdown: per-store stats with pagination
   * Admin-only endpoint
   */
  getStoreBreakdown: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(100).default(20),
        churnRiskOnly: z.boolean().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const db = ctx.adminSupabase
      const offset = input.page * input.limit

      // Get stores with credits joined
      let storesQuery = db
        .from('stores')
        .select(
          'id, shop_domain, billing_mode, subscription_tier, status, is_churn_risk, churn_flagged_at, created_at, store_credits(balance, total_spent, total_purchased)',
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + input.limit - 1)

      if (input.churnRiskOnly) {
        storesQuery = storesQuery.eq('is_churn_risk', true)
      }

      const { data: stores, error: storesError, count } = await storesQuery

      if (storesError) {
        throw new Error(storesError.message)
      }

      // Batch: get generation counts for all stores via RPC (eliminates N+1)
      const storeIds = stores?.map((s) => s.id) || []
      const { data: genCounts, error: genCountsError } = await db.rpc('get_store_generation_counts')

      if (genCountsError) {
        throw new Error(genCountsError.message)
      }

      // Build lookup map from RPC results
      const genCountMap = new Map<string, { total: number; completed: number; failed: number }>()
      for (const row of genCounts || []) {
        genCountMap.set(row.store_id, {
          total: Number(row.total ?? 0),
          completed: Number(row.completed ?? 0),
          failed: Number(row.failed ?? 0),
        })
      }

      // Batch: get last generation date for the current page of stores
      const lastGenMap = new Map<string, string | null>()
      if (storeIds.length > 0) {
        const { data: lastGens } = await db
          .from('store_generation_sessions')
          .select('store_id, created_at')
          .in('store_id', storeIds)
          .order('created_at', { ascending: false })

        // First occurrence per store_id is the most recent
        for (const row of lastGens || []) {
          if (!lastGenMap.has(row.store_id)) {
            lastGenMap.set(row.store_id, row.created_at)
          }
        }
      }

      const storeStats = (stores || []).map((store) => {
        // store_credits is a joined relation — could be array or object
        const credits = Array.isArray(store.store_credits)
          ? store.store_credits[0]
          : store.store_credits

        const counts = genCountMap.get(store.id)

        return {
          store_id: store.id,
          shop_domain: store.shop_domain,
          billing_mode: store.billing_mode,
          subscription_tier: store.subscription_tier,
          status: store.status,
          is_churn_risk: store.is_churn_risk ?? false,
          churn_flagged_at: store.churn_flagged_at ?? null,
          credit_balance: credits?.balance ?? 0,
          total_spent: credits?.total_spent ?? 0,
          generation_count: counts?.total ?? 0,
          last_generation_at: lastGenMap.get(store.id) ?? null,
        }
      })

      return {
        stores: storeStats,
        total: count || 0,
        page: input.page,
        limit: input.limit,
      }
    }),

  /**
   * B2B Store Detail: single store with full credit and generation history
   * Admin-only endpoint
   */
  getStoreDetail: adminProcedure
    .input(
      z.object({
        storeId: z.string().uuid(),
        generationPage: z.number().int().min(0).default(0),
        generationLimit: z.number().int().min(1).max(100).default(20),
        transactionPage: z.number().int().min(0).default(0),
        transactionLimit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ input, ctx }) => {
      const db = ctx.adminSupabase

      // Store info
      const { data: store, error: storeError } = await db
        .from('stores')
        .select('*')
        .eq('id', input.storeId)
        .single()

      if (storeError) {
        throw new Error(storeError.message)
      }

      // Credit balance
      const { data: credits, error: creditsError } = await db
        .from('store_credits')
        .select('balance, total_purchased, total_spent')
        .eq('store_id', input.storeId)
        .single()

      if (creditsError) {
        throw new Error(creditsError.message)
      }

      // API key status
      const { count: apiKeyCount, error: apiKeyError } = await db
        .from('store_api_keys')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', input.storeId)
        .eq('is_active', true)

      if (apiKeyError) {
        throw new Error(apiKeyError.message)
      }

      // Generation history (paginated)
      const genOffset = input.generationPage * input.generationLimit
      const { data: generations, error: genError, count: genTotal } = await db
        .from('store_generation_sessions')
        .select('id, status, credits_used, processing_time_ms, error_message, request_id, created_at, completed_at', { count: 'exact' })
        .eq('store_id', input.storeId)
        .order('created_at', { ascending: false })
        .range(genOffset, genOffset + input.generationLimit - 1)

      if (genError) {
        throw new Error(genError.message)
      }

      // Credit transaction history (paginated)
      const txOffset = input.transactionPage * input.transactionLimit
      const { data: transactions, error: txError, count: txTotal } = await db
        .from('store_credit_transactions')
        .select('id, amount, type, request_id, description, created_at', { count: 'exact' })
        .eq('store_id', input.storeId)
        .order('created_at', { ascending: false })
        .range(txOffset, txOffset + input.transactionLimit - 1)

      if (txError) {
        throw new Error(txError.message)
      }

      return {
        store: {
          id: store.id,
          shopDomain: store.shop_domain,
          billingMode: store.billing_mode,
          subscriptionTier: store.subscription_tier,
          subscriptionStatus: store.subscription_status,
          status: store.status,
          onboardingCompleted: store.onboarding_completed,
          createdAt: store.created_at,
          updatedAt: store.updated_at,
        },
        credits: {
          balance: credits?.balance ?? 0,
          totalPurchased: credits?.total_purchased ?? 0,
          totalSpent: credits?.total_spent ?? 0,
        },
        hasActiveApiKey: (apiKeyCount || 0) > 0,
        generations: {
          items: generations || [],
          total: genTotal || 0,
          page: input.generationPage,
          limit: input.generationLimit,
        },
        transactions: {
          items: transactions || [],
          total: txTotal || 0,
          page: input.transactionPage,
          limit: input.transactionLimit,
        },
      }
    }),

  /**
   * B2C Overview: user growth, generation stats, credit consumption
   * Admin-only endpoint
   */
  getB2COverview: adminProcedure
    .input(
      z.object({
        startDate: iso8601DateString.optional(),
        endDate: iso8601DateString.optional(),
      }).optional(),
    )
    .query(async ({ input, ctx }) => {
      const db = ctx.adminSupabase

      // Total users
      const { count: totalUsers, error: usersError } = await db
        .from('users')
        .select('*', { count: 'exact', head: true })

      if (usersError) {
        throw new Error(usersError.message)
      }

      // New users in last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { count: newUsers7d, error: new7dError } = await db
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo)

      if (new7dError) {
        throw new Error(new7dError.message)
      }

      // New users in last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { count: newUsers30d, error: new30dError } = await db
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo)

      if (new30dError) {
        throw new Error(new30dError.message)
      }

      // Active users (users with generation in last 30 days)
      const { data: activeUserData, error: activeError } = await db
        .from('generation_sessions')
        .select('user_id')
        .gte('created_at', thirtyDaysAgo)

      if (activeError) {
        throw new Error(activeError.message)
      }

      const activeUsers = new Set(activeUserData?.map((s) => s.user_id)).size

      // Total B2C generations (with optional date filter)
      let genQuery = db
        .from('generation_sessions')
        .select('*', { count: 'exact', head: true })

      if (input?.startDate) {
        genQuery = genQuery.gte('created_at', input.startDate)
      }
      if (input?.endDate) {
        genQuery = genQuery.lte('created_at', input.endDate)
      }

      const { count: totalGenerations, error: genError } = await genQuery

      if (genError) {
        throw new Error(genError.message)
      }

      // Total B2C credits consumed
      const { data: creditData, error: creditsError } = await db
        .from('user_credits')
        .select('total_spent')

      if (creditsError) {
        throw new Error(creditsError.message)
      }

      const totalCreditsConsumed = creditData?.reduce(
        (sum, row) => sum + (row.total_spent || 0),
        0,
      ) || 0

      // B2C credit purchases (count of purchase transactions)
      const { count: creditPurchases, error: purchaseError } = await db
        .from('credit_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'signup_bonus')

      if (purchaseError) {
        throw new Error(purchaseError.message)
      }

      return {
        totalUsers: totalUsers || 0,
        newUsers7d: newUsers7d || 0,
        newUsers30d: newUsers30d || 0,
        activeUsers30d: activeUsers,
        totalGenerations: totalGenerations || 0,
        totalCreditsConsumed,
        creditPurchases: creditPurchases || 0,
      }
    }),

  /**
   * Revenue Overview: B2B + B2C revenue, OpenAI costs, margin
   * Admin-only endpoint
   */
  getRevenueOverview: adminProcedure
    .input(
      z.object({
        startDate: iso8601DateString.optional(),
        endDate: iso8601DateString.optional(),
      }).optional(),
    )
    .query(async ({ input, ctx }) => {
      const db = ctx.adminSupabase
      const costPerGeneration = Number(process.env.OPENAI_COST_PER_GENERATION) || 0.05

      // B2B revenue: purchase + subscription transactions
      let b2bTxQuery = db
        .from('store_credit_transactions')
        .select('amount')
        .in('type', ['purchase', 'subscription'])

      if (input?.startDate) {
        b2bTxQuery = b2bTxQuery.gte('created_at', input.startDate)
      }
      if (input?.endDate) {
        b2bTxQuery = b2bTxQuery.lte('created_at', input.endDate)
      }

      const { data: b2bTx, error: b2bTxError } = await b2bTxQuery

      if (b2bTxError) {
        throw new Error(b2bTxError.message)
      }

      const b2bRevenue = b2bTx?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0

      // B2C revenue: purchase transactions (future-proof — no purchase type yet)
      let b2cTxQuery = db
        .from('credit_transactions')
        .select('amount')
        .eq('type', 'purchase')

      if (input?.startDate) {
        b2cTxQuery = b2cTxQuery.gte('created_at', input.startDate)
      }
      if (input?.endDate) {
        b2cTxQuery = b2cTxQuery.lte('created_at', input.endDate)
      }

      const { data: b2cTx, error: b2cTxError } = await b2cTxQuery

      if (b2cTxError) {
        throw new Error(b2cTxError.message)
      }

      const b2cRevenue = b2cTx?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0

      // Total generation count for cost estimation (B2B + B2C)
      let b2bGenQuery = db
        .from('store_generation_sessions')
        .select('*', { count: 'exact', head: true })

      if (input?.startDate) {
        b2bGenQuery = b2bGenQuery.gte('created_at', input.startDate)
      }
      if (input?.endDate) {
        b2bGenQuery = b2bGenQuery.lte('created_at', input.endDate)
      }

      const { count: b2bGenCount, error: b2bGenError } = await b2bGenQuery

      if (b2bGenError) {
        throw new Error(b2bGenError.message)
      }

      let b2cGenQuery = db
        .from('generation_sessions')
        .select('*', { count: 'exact', head: true })

      if (input?.startDate) {
        b2cGenQuery = b2cGenQuery.gte('created_at', input.startDate)
      }
      if (input?.endDate) {
        b2cGenQuery = b2cGenQuery.lte('created_at', input.endDate)
      }

      const { count: b2cGenCount, error: b2cGenError } = await b2cGenQuery

      if (b2cGenError) {
        throw new Error(b2cGenError.message)
      }

      const totalGenerations = (b2bGenCount || 0) + (b2cGenCount || 0)
      const estimatedCosts = totalGenerations * costPerGeneration
      const totalRevenue = b2bRevenue + b2cRevenue
      const marginPercentage =
        totalRevenue > 0 ? ((totalRevenue - estimatedCosts) / totalRevenue) * 100 : 0

      return {
        b2bRevenue,
        b2cRevenue,
        totalRevenue,
        estimatedCosts: Math.round(estimatedCosts * 100) / 100,
        marginPercentage: Math.round(marginPercentage * 100) / 100,
        totalGenerations,
        costPerGeneration,
      }
    }),

  /**
   * Quality Metrics: success rate, moderation blocks, refunds, avg generation time
   * Admin-only endpoint
   */
  getQualityMetrics: adminProcedure
    .input(
      z.object({
        startDate: iso8601DateString.optional(),
        endDate: iso8601DateString.optional(),
      }).optional(),
    )
    .query(async ({ input, ctx }) => {
      const db = ctx.adminSupabase

      // B2B generation sessions
      let b2bSessionQuery = db
        .from('store_generation_sessions')
        .select('status, processing_time_ms')

      if (input?.startDate) {
        b2bSessionQuery = b2bSessionQuery.gte('created_at', input.startDate)
      }
      if (input?.endDate) {
        b2bSessionQuery = b2bSessionQuery.lte('created_at', input.endDate)
      }

      const { data: b2bSessions, error: b2bSessionError } = await b2bSessionQuery

      if (b2bSessionError) {
        throw new Error(b2bSessionError.message)
      }

      // B2C generation sessions
      let b2cSessionQuery = db
        .from('generation_sessions')
        .select('status, processing_time_ms')

      if (input?.startDate) {
        b2cSessionQuery = b2cSessionQuery.gte('created_at', input.startDate)
      }
      if (input?.endDate) {
        b2cSessionQuery = b2cSessionQuery.lte('created_at', input.endDate)
      }

      const { data: b2cSessions, error: b2cSessionError } = await b2cSessionQuery

      if (b2cSessionError) {
        throw new Error(b2cSessionError.message)
      }

      // Combined stats
      const b2bList = b2bSessions || []
      const b2cList = b2cSessions || []

      const b2bCompleted = b2bList.filter((s) => s.status === 'completed').length
      const b2bFailed = b2bList.filter((s) => s.status === 'failed').length
      const b2cCompleted = b2cList.filter((s) => s.status === 'completed').length
      const b2cFailed = b2cList.filter((s) => s.status === 'failed').length

      const totalCompleted = b2bCompleted + b2cCompleted
      const totalSessions = b2bList.length + b2cList.length
      const successRate = totalSessions > 0 ? totalCompleted / totalSessions : 0

      // Average generation time from completed sessions
      const completedTimes = [
        ...b2bList.filter((s) => s.status === 'completed' && s.processing_time_ms),
        ...b2cList.filter((s) => s.status === 'completed' && s.processing_time_ms),
      ].map((s) => s.processing_time_ms || 0)

      const avgGenerationTimeMs =
        completedTimes.length > 0
          ? Math.round(completedTimes.reduce((sum, t) => sum + t, 0) / completedTimes.length)
          : 0

      // Moderation blocks from B2B analytics events
      let b2bBlockQuery = db
        .from('store_analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'generation_moderation_blocked')

      if (input?.startDate) {
        b2bBlockQuery = b2bBlockQuery.gte('created_at', input.startDate)
      }
      if (input?.endDate) {
        b2bBlockQuery = b2bBlockQuery.lte('created_at', input.endDate)
      }

      const { count: b2bBlockCount, error: b2bBlockError } = await b2bBlockQuery

      if (b2bBlockError) {
        throw new Error(b2bBlockError.message)
      }

      // Moderation blocks from B2C analytics events
      let b2cBlockQuery = db
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'generation_moderation_blocked')

      if (input?.startDate) {
        b2cBlockQuery = b2cBlockQuery.gte('created_at', input.startDate)
      }
      if (input?.endDate) {
        b2cBlockQuery = b2cBlockQuery.lte('created_at', input.endDate)
      }

      const { count: b2cBlockCount, error: b2cBlockError } = await b2cBlockQuery

      if (b2cBlockError) {
        throw new Error(b2cBlockError.message)
      }

      // Refund counts
      let b2bRefundQuery = db
        .from('store_credit_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'refund')

      if (input?.startDate) {
        b2bRefundQuery = b2bRefundQuery.gte('created_at', input.startDate)
      }
      if (input?.endDate) {
        b2bRefundQuery = b2bRefundQuery.lte('created_at', input.endDate)
      }

      const { count: b2bRefundCount, error: b2bRefundError } = await b2bRefundQuery

      if (b2bRefundError) {
        throw new Error(b2bRefundError.message)
      }

      let b2cRefundQuery = db
        .from('credit_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'refund')

      if (input?.startDate) {
        b2cRefundQuery = b2cRefundQuery.gte('created_at', input.startDate)
      }
      if (input?.endDate) {
        b2cRefundQuery = b2cRefundQuery.lte('created_at', input.endDate)
      }

      const { count: b2cRefundCount, error: b2cRefundError } = await b2cRefundQuery

      if (b2cRefundError) {
        throw new Error(b2cRefundError.message)
      }

      return {
        successRate: Math.round(successRate * 10000) / 10000,
        totalSessions,
        totalCompleted,
        totalFailed: b2bFailed + b2cFailed,
        moderationBlockCount: (b2bBlockCount || 0) + (b2cBlockCount || 0),
        refundCount: (b2bRefundCount || 0) + (b2cRefundCount || 0),
        avgGenerationTimeMs,
        channelBreakdown: {
          b2b: {
            total: b2bList.length,
            completed: b2bCompleted,
            failed: b2bFailed,
            successRate: b2bList.length > 0 ? Math.round((b2bCompleted / b2bList.length) * 10000) / 10000 : 0,
          },
          b2c: {
            total: b2cList.length,
            completed: b2cCompleted,
            failed: b2cFailed,
            successRate: b2cList.length > 0 ? Math.round((b2cCompleted / b2cList.length) * 10000) / 10000 : 0,
          },
        },
      }
    }),
})
