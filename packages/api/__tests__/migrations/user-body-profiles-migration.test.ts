import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

const migrationPath = 'supabase/migrations/012_user_body_profiles.sql'

describe('Migration 012_user_body_profiles', () => {
  it('creates user_body_profiles table with required columns and unique user_id', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.user_body_profiles')
    expect(sql).toContain('user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE')
    expect(sql).toContain('UNIQUE(user_id)')
    expect(sql).toContain('height_cm NUMERIC NOT NULL')
    expect(sql).toContain('weight_kg NUMERIC')
    expect(sql).toContain('body_type TEXT')
    expect(sql).toContain('fit_preference TEXT')
    expect(sql).toContain('gender TEXT')
    expect(sql).toContain('est_chest_cm NUMERIC')
    expect(sql).toContain('est_waist_cm NUMERIC')
    expect(sql).toContain('est_hip_cm NUMERIC')
    expect(sql).toContain('est_shoulder_cm NUMERIC')
    expect(sql).toContain("source TEXT NOT NULL DEFAULT 'manual'")
    expect(sql).toContain('created_at TIMESTAMPTZ DEFAULT NOW()')
    expect(sql).toContain('updated_at TIMESTAMPTZ DEFAULT NOW()')
  })

  it('adds source check constraint and RLS own-profile policy', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain("CHECK (source IN ('manual', 'mediapipe', 'user_input'))")
    expect(sql).toContain('ALTER TABLE public.user_body_profiles ENABLE ROW LEVEL SECURITY;')
    expect(sql).toContain('CREATE POLICY "Users can view own body profile"')
    expect(sql).toContain('CREATE POLICY "Users can insert own body profile"')
    expect(sql).toContain('CREATE POLICY "Users can update own body profile"')
    expect(sql).toContain('USING (auth.uid() = user_id)')
    expect(sql).toContain('WITH CHECK (auth.uid() = user_id)')
  })

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const itWithDbEnv = supabaseUrl && serviceRoleKey ? it : it.skip

  itWithDbEnv('validates migration constraints against a real database schema', async () => {
    const client = createClient(supabaseUrl as string, serviceRoleKey as string)
    const email = `body-profile-migration-${Date.now()}@example.com`
    const password = `Tmp_${Date.now()}!A9`
    const { data: createdUser, error: createError } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    expect(createError).toBeNull()
    expect(createdUser.user?.id).toBeTruthy()

    try {
      const userId = createdUser.user?.id as string
      const { error: selectError } = await client
        .from('user_body_profiles')
        .select('user_id, height_cm, source')
        .limit(1)
      expect(selectError).toBeNull()

      const { error: invalidSourceError } = await client.from('user_body_profiles').insert({
        user_id: userId,
        height_cm: 175,
        source: 'invalid_source',
      })
      expect(invalidSourceError).toBeTruthy()
      expect(invalidSourceError?.message ?? '').toContain('source')
    } finally {
      if (createdUser.user?.id) {
        await client.auth.admin.deleteUser(createdUser.user.id)
      }
    }
  })
})
