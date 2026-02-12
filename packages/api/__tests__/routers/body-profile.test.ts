import { beforeEach, describe, expect, it, vi } from 'vitest'

function createMockSupabase() {
  const single = vi.fn()
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq, single }))

  const upsertSingle = vi.fn()
  const upsertSelect = vi.fn(() => ({ single: upsertSingle }))
  const upsert = vi.fn(() => ({ select: upsertSelect }))

  const from = vi.fn(() => ({ select, upsert }))

  return {
    from,
    _mocks: {
      select,
      eq,
      single,
      upsert,
      upsertSelect,
      upsertSingle,
    },
  }
}

describe('body-profile router', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('getProfile returns null when no profile exists', async () => {
    const mockSupabase = createMockSupabase()
    mockSupabase._mocks.single.mockResolvedValue({ data: null, error: null })

    const { bodyProfileRouter } = await import('../../src/routers/body-profile')

    const caller = bodyProfileRouter.createCaller({
      user: { id: 'user_123' },
      supabase: mockSupabase as any,
      adminSupabase: mockSupabase as any,
    })

    const profile = await caller.getProfile()

    expect(profile).toBeNull()
    expect(mockSupabase.from).toHaveBeenCalledWith('user_body_profiles')
    expect(mockSupabase._mocks.eq).toHaveBeenCalledWith('user_id', 'user_123')
  })

  it('saveProfile creates/upserts body profile and returns mapped result', async () => {
    const mockSupabase = createMockSupabase()
    mockSupabase._mocks.upsertSingle.mockResolvedValue({
      data: {
        user_id: 'user_123',
        height_cm: 175,
        weight_kg: 72,
        body_type: 'athletic',
        fit_preference: 'regular',
        gender: 'male',
        est_chest_cm: 98,
        est_waist_cm: 82,
        est_hip_cm: 96,
        est_shoulder_cm: 46,
        source: 'manual',
        created_at: '2026-02-12T00:00:00Z',
        updated_at: '2026-02-12T00:00:00Z',
      },
      error: null,
    })

    const { bodyProfileRouter } = await import('../../src/routers/body-profile')

    const caller = bodyProfileRouter.createCaller({
      user: { id: 'user_123' },
      supabase: mockSupabase as any,
      adminSupabase: mockSupabase as any,
    })

    const result = await caller.saveProfile({
      heightCm: 175,
      weightKg: 72,
      bodyType: 'athletic',
      fitPreference: 'regular',
      gender: 'male',
      estChestCm: 98,
      estWaistCm: 82,
      estHipCm: 96,
      estShoulderCm: 46,
    })

    expect(mockSupabase._mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user_123',
        height_cm: 175,
        source: 'manual',
      }),
      { onConflict: 'user_id' }
    )

    expect(result).toEqual(
      expect.objectContaining({
        heightCm: 175,
        source: 'manual',
      })
    )
  })

  it('updateFromSizeRec upserts with mediapipe source and user scoping', async () => {
    const mockSupabase = createMockSupabase()
    mockSupabase._mocks.upsertSingle.mockResolvedValue({
      data: {
        user_id: 'user_abc',
        height_cm: 180,
        est_chest_cm: 100,
        est_waist_cm: 84,
        est_hip_cm: 98,
        est_shoulder_cm: 47,
        source: 'mediapipe',
        body_type: 'athletic',
        fit_preference: null,
        gender: null,
        weight_kg: null,
        created_at: '2026-02-12T00:00:00Z',
        updated_at: '2026-02-12T00:00:00Z',
      },
      error: null,
    })

    const { bodyProfileRouter } = await import('../../src/routers/body-profile')

    const caller = bodyProfileRouter.createCaller({
      user: { id: 'user_abc' },
      supabase: mockSupabase as any,
      adminSupabase: mockSupabase as any,
    })

    await caller.updateFromSizeRec({
      heightCm: 180,
      bodyType: 'athletic',
      estChestCm: 100,
      estWaistCm: 84,
      estHipCm: 98,
      estShoulderCm: 47,
    })

    expect(mockSupabase._mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user_abc',
        source: 'mediapipe',
      }),
      { onConflict: 'user_id' }
    )
  })

  it('registers bodyProfile router on app router', async () => {
    const { appRouter } = await import('../../src/routers/_app')

    expect(appRouter._def.record).toHaveProperty('bodyProfile')
  })
})
