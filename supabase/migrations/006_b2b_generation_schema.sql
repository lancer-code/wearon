-- B2B Generation & Analytics Schema
-- Migration: 006_b2b_generation_schema
-- Creates: store_generation_sessions, store_analytics_events

-- =============================================================================
-- Task 2.1: store_generation_sessions table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.store_generation_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  shopper_email TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')) DEFAULT 'queued',
  model_image_url TEXT NOT NULL,
  outfit_image_url TEXT,
  prompt_system TEXT NOT NULL,
  prompt_user TEXT,
  generated_image_url TEXT,
  credits_used INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  processing_time_ms INTEGER,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- =============================================================================
-- Task 2.2: store_analytics_events table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.store_analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  shopper_email TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- Task 2.3: Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_store_generation_sessions_store_id ON public.store_generation_sessions(store_id);
CREATE INDEX IF NOT EXISTS idx_store_generation_sessions_status ON public.store_generation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_store_generation_sessions_created_at ON public.store_generation_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_analytics_events_store_id ON public.store_analytics_events(store_id);
CREATE INDEX IF NOT EXISTS idx_store_analytics_events_type_created ON public.store_analytics_events(event_type, created_at);

-- =============================================================================
-- Task 2.4: Enable Realtime for store_generation_sessions
-- =============================================================================
-- Idempotent version: Only add if not already in publication
DO $$
BEGIN
  -- Check if table is already in the publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'store_generation_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.store_generation_sessions;
  END IF;
END $$;

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON TABLE public.store_generation_sessions IS 'B2B virtual try-on generation history and status (per store)';
COMMENT ON TABLE public.store_analytics_events IS 'B2B store-level analytics and usage events';
