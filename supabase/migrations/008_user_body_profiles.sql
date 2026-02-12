-- Body profile table for B2C users
-- Migration: 008_user_body_profiles

CREATE TABLE IF NOT EXISTS public.user_body_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  height_cm NUMERIC NOT NULL,
  weight_kg NUMERIC,
  body_type TEXT,
  fit_preference TEXT,
  gender TEXT,
  est_chest_cm NUMERIC,
  est_waist_cm NUMERIC,
  est_hip_cm NUMERIC,
  est_shoulder_cm NUMERIC,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'mediapipe', 'user_input')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_body_profiles_user_id
  ON public.user_body_profiles(user_id);

ALTER TABLE public.user_body_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own body profile"
  ON public.user_body_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own body profile"
  ON public.user_body_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own body profile"
  ON public.user_body_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_body_profiles_updated_at
  BEFORE UPDATE ON public.user_body_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.user_body_profiles IS 'Single saved body profile per B2C user for fast size recommendations';
