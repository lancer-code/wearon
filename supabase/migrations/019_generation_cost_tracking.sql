-- Add token usage and cost tracking to generation tables
-- Migration: 019_generation_cost_tracking

-- =============================================================================
-- B2C: generation_sessions
-- =============================================================================
ALTER TABLE public.generation_sessions
  ADD COLUMN IF NOT EXISTS input_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS output_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(10, 6);

-- =============================================================================
-- B2B: store_generation_sessions
-- =============================================================================
ALTER TABLE public.store_generation_sessions
  ADD COLUMN IF NOT EXISTS input_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS output_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(10, 6);

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON COLUMN public.generation_sessions.input_tokens IS 'Total input tokens consumed (images + prompt)';
COMMENT ON COLUMN public.generation_sessions.output_tokens IS 'Total output tokens consumed (generated image)';
COMMENT ON COLUMN public.generation_sessions.estimated_cost_usd IS 'Estimated cost in USD based on token pricing';

COMMENT ON COLUMN public.store_generation_sessions.input_tokens IS 'Total input tokens consumed (images + prompt)';
COMMENT ON COLUMN public.store_generation_sessions.output_tokens IS 'Total output tokens consumed (generated image)';
COMMENT ON COLUMN public.store_generation_sessions.estimated_cost_usd IS 'Estimated cost in USD based on token pricing';
