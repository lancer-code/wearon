import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
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

  it('getSizeRecInput returns useSavedProfile=false when profile is missing', async () => {
    const mockSupabase = createMockSupabase()
    mockSupabase._mocks.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })

    const { bodyProfileRouter } = await import('../../src/routers/body-profile')
    const caller = bodyProfileRouter.createCaller({
      user: { id: 'user_123' },
      supabase: mockSupabase as any,
      adminSupabase: mockSupabase as any,
    })

    const result = await caller.getSizeRecInput()

    expect(result).toEqual({
      useSavedProfile: false,
      profile: null,
    })
  })

  it('getSizeRecInput returns useSavedProfile=true when saved measurements exist', async () => {
    const mockSupabase = createMockSupabase()
    mockSupabase._mocks.single.mockResolvedValue({
      data: {
        user_id: 'user_123',
        height_cm: 178,
        weight_kg: 74,
        body_type: 'athletic',
        fit_preference: 'regular',
        gender: 'male',
        est_chest_cm: 100,
        est_waist_cm: 83,
        est_hip_cm: 97,
        est_shoulder_cm: 47,
        source: 'mediapipe',
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

    const result = await caller.getSizeRecInput()

    expect(result.useSavedProfile).toBe(true)
    expect(result.profile).toEqual(
      expect.objectContaining({
        heightCm: 178,
        estChestCm: 100,
        source: 'mediapipe',
      })
    )
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

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.SUPABASE_ANON_KEY
  const itWithRlsEnv = supabaseUrl && serviceRoleKey && anonKey ? it : it.skip

  itWithRlsEnv(
    'enforces cross-user RLS isolation when querying body profiles',
    async () => {
      const adminClient = createClient(supabaseUrl as string, serviceRoleKey as string)

      let userAId: string | null = null
      let userBId: string | null = null

      const createUser = async () => {
        const email = `body-profile-rls-${randomUUID()}@example.com`
        const password = `RlS_${randomUUID()}!A9`
        const { data, error } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        })
        if (error || !data.user) {
          throw new Error(`Failed to create integration test user: ${error?.message ?? 'unknown'}`)
        }
        return { id: data.user.id, email, password }
      }

      try {
        const userA = await createUser()
        const userB = await createUser()
        userAId = userA.id
        userBId = userB.id

        const userAClient = createClient(supabaseUrl as string, anonKey as string)
        const userBClient = createClient(supabaseUrl as string, anonKey as string)

        await userAClient.auth.signInWithPassword({
          email: userA.email,
          password: userA.password,
        })
        await userBClient.auth.signInWithPassword({
          email: userB.email,
          password: userB.password,
        })

        const { error: insertError } = await userAClient.from('user_body_profiles').upsert(
          {
            user_id: userA.id,
            height_cm: 175,
            source: 'manual',
          },
          { onConflict: 'user_id' }
        )
        expect(insertError).toBeNull()

        const { data: crossReadData, error: crossReadError } = await userBClient
          .from('user_body_profiles')
          .select('user_id, height_cm')
          .eq('user_id', userA.id)

        expect(crossReadError).toBeNull()
        expect(crossReadData).toEqual([])

        const { data: crossUpdateData, error: crossUpdateError } = await userBClient
          .from('user_body_profiles')
          .update({ height_cm: 199 })
          .eq('user_id', userA.id)
          .select('user_id')

        expect(crossUpdateError).toBeNull()
        expect(crossUpdateData).toEqual([])
      } finally {
        if (userAId) {
          await adminClient.auth.admin.deleteUser(userAId)
        }
        if (userBId) {
          await adminClient.auth.admin.deleteUser(userBId)
        }
      }
    },
    45_000
  )
})
