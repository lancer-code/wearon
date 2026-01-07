-- Row Level Security (RLS) Policies
-- Migration: 002_rls_policies

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow service role full access (for triggers and functions)
CREATE POLICY "Service role has full access to users"
  ON public.users
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- USER_CREDITS TABLE POLICIES
-- ============================================================================

-- Users can view their own credits
CREATE POLICY "Users can view own credits"
  ON public.user_credits
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can modify credits (through functions)
CREATE POLICY "Service role has full access to credits"
  ON public.user_credits
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- CREDIT_TRANSACTIONS TABLE POLICIES
-- ============================================================================

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions"
  ON public.credit_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert transactions (through functions)
CREATE POLICY "Service role has full access to transactions"
  ON public.credit_transactions
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- GENERATION_SESSIONS TABLE POLICIES
-- ============================================================================

-- Users can view their own generation sessions
CREATE POLICY "Users can view own generation sessions"
  ON public.generation_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own generation sessions
CREATE POLICY "Users can create own generation sessions"
  ON public.generation_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions (for status polling fallback)
CREATE POLICY "Users can update own generation sessions"
  ON public.generation_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role has full access (for background worker updates)
CREATE POLICY "Service role has full access to generation sessions"
  ON public.generation_sessions
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- ANALYTICS_EVENTS TABLE POLICIES
-- ============================================================================

-- Users can view their own analytics events
CREATE POLICY "Users can view own analytics events"
  ON public.analytics_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role has full access for logging events
CREATE POLICY "Service role has full access to analytics"
  ON public.analytics_events
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Admin users can view all analytics (for future admin dashboard)
CREATE POLICY "Admin can view all analytics"
  ON public.analytics_events
  FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ============================================================================
-- STORAGE BUCKET POLICIES
-- ============================================================================

-- Note: Storage policies are defined separately in Supabase dashboard or via API
-- Here's the recommended configuration for reference:

-- Bucket: virtual-tryon-images
-- Public: false
-- File size limit: 10MB
-- Allowed MIME types: image/jpeg, image/png, image/webp

-- Storage Policy: Users can upload to their own folder
-- CREATE POLICY "Users can upload to own folder"
--   ON storage.objects
--   FOR INSERT
--   WITH CHECK (
--     bucket_id = 'virtual-tryon-images'
--     AND (storage.foldername(name))[1] = auth.uid()::text
--   );

-- Storage Policy: Users can read their own files
-- CREATE POLICY "Users can read own files"
--   ON storage.objects
--   FOR SELECT
--   USING (
--     bucket_id = 'virtual-tryon-images'
--     AND (storage.foldername(name))[1] = auth.uid()::text
--   );

-- Storage Policy: Users can delete their own files
-- CREATE POLICY "Users can delete own files"
--   ON storage.objects
--   FOR DELETE
--   USING (
--     bucket_id = 'virtual-tryon-images'
--     AND (storage.foldername(name))[1] = auth.uid()::text
--   );

-- Storage Policy: Service role has full access (for worker and cron jobs)
-- CREATE POLICY "Service role has full storage access"
--   ON storage.objects
--   FOR ALL
--   USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON POLICY "Users can view own profile" ON public.users IS 'Allow users to read their own user record';
COMMENT ON POLICY "Users can view own credits" ON public.user_credits IS 'Allow users to check their credit balance';
COMMENT ON POLICY "Users can view own transactions" ON public.credit_transactions IS 'Allow users to view their transaction history';
COMMENT ON POLICY "Users can view own generation sessions" ON public.generation_sessions IS 'Allow users to view their try-on generation history';
