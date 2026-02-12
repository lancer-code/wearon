import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationPath = 'supabase/migrations/008_user_body_profiles.sql'

describe('Migration 008_user_body_profiles', () => {
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
})
