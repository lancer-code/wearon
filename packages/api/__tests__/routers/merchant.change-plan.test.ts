import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockChangeSubscriptionPlan = vi.fn()
const mockAddStoreCredits = vi.fn()
const mockGetTierCredits = vi.fn((tier: string) => {
  if (tier === 'starter') return 350
  if (tier === 'growth') return 800
  if (tier === 'scale') return 1800
  return 0
})

vi.mock('../../src/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../../src/services/b2b-credits', () => ({
  addStoreCredits: (...args: unknown[]) => mockAddStoreCredits(...args),
}))

vi.mock('../../src/services/paddle', () => ({
  calculatePaygTotalCents: (credits: number) => credits * 18,
  changeSubscriptionPlan: (...args: unknown[]) => mockChangeSubscriptionPlan(...args),
  createPaygCheckoutSession: vi.fn(),
  createSubscriptionCheckoutSession: vi.fn(),
  getBillingCatalog: vi.fn(),
  getTierCredits: (...args: unknown[]) => mockGetTierCredits(...args),
}))

function createMockAdminSupabase(store: Record<string, unknown>) {
  const mockSelectSingle = vi.fn().mockResolvedValue({ data: store, error: null })
  const mockUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null })

  const adminSupabase = {
    from: vi.fn((table: string) => {
      if (table !== 'stores') {
        throw new Error(`Unexpected table in merchant.changePlan tests: ${table}`)
      }

      return {
        select: () => ({
          eq: () => ({
            single: () => mockSelectSingle(),
          }),
        }),
        update: (payload: Record<string, unknown>) => ({
          eq: (field: string, value: string) => mockUpdateEq(payload, field, value),
        }),
      }
    }),
  }

  return { adminSupabase, mockUpdateEq }
}

describe('merchant.changePlan route behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('processes upgrades immediately and grants delta credits', async () => {
    const { merchantRouter } = await import('../../src/routers/merchant')

    const { adminSupabase, mockUpdateEq } = createMockAdminSupabase({
      id: 'store_123',
      shop_domain: 'shop.myshopify.com',
      subscription_tier: 'starter',
      subscription_id: 'sub_123',
      subscription_status: 'active',
      subscription_current_period_end: null,
      paddle_customer_id: 'ctm_123',
      billing_mode: 'absorb_mode',
      status: 'active',
      onboarding_completed: true,
      created_at: '2026-02-12T00:00:00Z',
    })

    const caller = merchantRouter.createCaller({
      user: { id: 'user_123', email: 'owner@example.com' },
      adminSupabase: adminSupabase as any,
      supabase: adminSupabase as any,
    } as any)

    const result = await caller.changePlan({ targetTier: 'growth' })

    expect(result).toEqual({
      changed: true,
      targetTier: 'growth',
      effectiveFrom: 'immediately',
    })

    expect(mockChangeSubscriptionPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: 'sub_123',
        targetTier: 'growth',
        effectiveFrom: 'immediately',
      })
    )

    expect(mockAddStoreCredits).toHaveBeenCalledWith(
      'store_123',
      450,
      'subscription',
      expect.stringMatching(/^req_/),
      'Upgrade starter -> growth delta credits'
    )

    expect(mockUpdateEq).toHaveBeenCalledWith(
      { subscription_tier: 'growth', subscription_status: 'active' },
      'id',
      'store_123'
    )
  })

  it('schedules downgrades for next billing period without immediate credits', async () => {
    const { merchantRouter } = await import('../../src/routers/merchant')

    const { adminSupabase, mockUpdateEq } = createMockAdminSupabase({
      id: 'store_456',
      shop_domain: 'shop.myshopify.com',
      subscription_tier: 'scale',
      subscription_id: 'sub_456',
      subscription_status: 'active',
      subscription_current_period_end: null,
      paddle_customer_id: 'ctm_456',
      billing_mode: 'absorb_mode',
      status: 'active',
      onboarding_completed: true,
      created_at: '2026-02-12T00:00:00Z',
    })

    const caller = merchantRouter.createCaller({
      user: { id: 'user_456', email: 'owner@example.com' },
      adminSupabase: adminSupabase as any,
      supabase: adminSupabase as any,
    } as any)

    const result = await caller.changePlan({ targetTier: 'growth' })

    expect(result).toEqual({
      changed: true,
      targetTier: 'growth',
      effectiveFrom: 'next_billing_period',
    })

    expect(mockChangeSubscriptionPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: 'sub_456',
        targetTier: 'growth',
        effectiveFrom: 'next_billing_period',
      })
    )

    expect(mockAddStoreCredits).not.toHaveBeenCalled()
    expect(mockUpdateEq).not.toHaveBeenCalled()
  })

  it('returns unchanged result when target tier matches current tier', async () => {
    const { merchantRouter } = await import('../../src/routers/merchant')

    const { adminSupabase } = createMockAdminSupabase({
      id: 'store_789',
      shop_domain: 'shop.myshopify.com',
      subscription_tier: 'growth',
      subscription_id: 'sub_789',
      subscription_status: 'active',
      subscription_current_period_end: null,
      paddle_customer_id: 'ctm_789',
      billing_mode: 'absorb_mode',
      status: 'active',
      onboarding_completed: true,
      created_at: '2026-02-12T00:00:00Z',
    })

    const caller = merchantRouter.createCaller({
      user: { id: 'user_789', email: 'owner@example.com' },
      adminSupabase: adminSupabase as any,
      supabase: adminSupabase as any,
    } as any)

    const result = await caller.changePlan({ targetTier: 'growth' })

    expect(result).toEqual({
      changed: false,
      targetTier: 'growth',
      effectiveFrom: 'none',
    })

    expect(mockChangeSubscriptionPlan).not.toHaveBeenCalled()
    expect(mockAddStoreCredits).not.toHaveBeenCalled()
  })

  it('fails when immediate upgrade store persistence fails (MEDIUM #7 - HIGH #1 fix verification)', async () => {
    const { merchantRouter } = await import('../../src/routers/merchant')

    const { adminSupabase, mockUpdateEq } = createMockAdminSupabase({
      id: 'store_321',
      shop_domain: 'shop.myshopify.com',
      subscription_tier: 'starter',
      subscription_id: 'sub_321',
      subscription_status: 'active',
      subscription_current_period_end: null,
      paddle_customer_id: 'ctm_321',
      billing_mode: 'absorb_mode',
      status: 'active',
      onboarding_completed: true,
      created_at: '2026-02-12T00:00:00Z',
    })
    mockUpdateEq.mockResolvedValueOnce({
      data: null,
      error: { message: 'update failed' },
    })

    const caller = merchantRouter.createCaller({
      user: { id: 'user_321', email: 'owner@example.com' },
      adminSupabase: adminSupabase as any,
      supabase: adminSupabase as any,
    } as any)

    await expect(caller.changePlan({ targetTier: 'growth' })).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
    })

    // HIGH #1 FIX: Credits should NOT be granted when store update fails
    // Store update now happens BEFORE credit grant (reordered in fix)
    expect(mockAddStoreCredits).not.toHaveBeenCalled()
  })

  it('fails with BAD_REQUEST when no active subscription exists', async () => {
    const { merchantRouter } = await import('../../src/routers/merchant')

    const { adminSupabase } = createMockAdminSupabase({
      id: 'store_000',
      shop_domain: 'shop.myshopify.com',
      subscription_tier: 'starter',
      subscription_id: null,
      subscription_status: null,
      subscription_current_period_end: null,
      paddle_customer_id: null,
      billing_mode: 'absorb_mode',
      status: 'active',
      onboarding_completed: true,
      created_at: '2026-02-12T00:00:00Z',
    })

    const caller = merchantRouter.createCaller({
      user: { id: 'user_000', email: 'owner@example.com' },
      adminSupabase: adminSupabase as any,
      supabase: adminSupabase as any,
    } as any)

    await expect(caller.changePlan({ targetTier: 'growth' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
  })
})
