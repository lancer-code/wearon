-- Database performance hardening
-- Migration: 022_db_performance_hardening
-- Adds: CHECK constraints, composite indexes, autovacuum tuning, aggregation RPCs

-- =============================================================================
-- 1. Non-negative balance CHECK constraints
-- =============================================================================
ALTER TABLE public.user_credits
  ADD CONSTRAINT chk_user_credits_balance CHECK (balance >= 0);

ALTER TABLE public.store_credits
  ADD CONSTRAINT chk_store_credits_balance CHECK (balance >= 0);

ALTER TABLE public.store_shopper_credits
  ADD CONSTRAINT chk_store_shopper_credits_balance CHECK (balance >= 0);

-- =============================================================================
-- 2. Composite indexes for common query patterns
-- =============================================================================

-- User's recent generations (getHistory, getUserStats)
CREATE INDEX IF NOT EXISTS idx_generation_sessions_user_created
  ON public.generation_sessions(user_id, created_at DESC);

-- Store's recent generations (getStoreBreakdown, churn detection)
CREATE INDEX IF NOT EXISTS idx_store_generation_sessions_store_created
  ON public.store_generation_sessions(store_id, created_at DESC);

-- Shopper generation history in resell mode
CREATE INDEX IF NOT EXISTS idx_store_generation_sessions_shopper
  ON public.store_generation_sessions(store_id, shopper_email)
  WHERE shopper_email IS NOT NULL;

-- =============================================================================
-- 3. Autovacuum tuning for high-churn tables
-- =============================================================================

-- generation_sessions: frequent inserts + status updates
ALTER TABLE public.generation_sessions SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);
ALTER TABLE public.store_generation_sessions SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- analytics_events: high-volume append-only
ALTER TABLE public.analytics_events SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);
ALTER TABLE public.store_analytics_events SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

-- =============================================================================
-- 4. Aggregation RPCs (replace in-memory aggregation + N+1 patterns)
-- =============================================================================

-- B2C: single-query generation stats (replaces 3 separate COUNT queries)
CREATE OR REPLACE FUNCTION get_user_generation_stats(p_user_id UUID)
RETURNS TABLE (total BIGINT, completed BIGINT, failed BIGINT) AS $$
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'failed')
  FROM public.generation_sessions
  WHERE user_id = p_user_id;
$$ LANGUAGE sql STABLE;

-- Processing time metrics (replaces in-memory min/max/avg)
CREATE OR REPLACE FUNCTION get_processing_metrics()
RETURNS TABLE (avg_ms NUMERIC, min_ms INTEGER, max_ms INTEGER, total BIGINT) AS $$
  SELECT
    ROUND(AVG(processing_time_ms)::numeric, 0),
    MIN(processing_time_ms),
    MAX(processing_time_ms),
    COUNT(*)
  FROM public.generation_sessions
  WHERE status = 'completed' AND processing_time_ms IS NOT NULL;
$$ LANGUAGE sql STABLE;

-- B2B: store generation counts (fixes N+1 loop in getStoreBreakdown)
CREATE OR REPLACE FUNCTION get_store_generation_counts()
RETURNS TABLE (store_id UUID, total BIGINT, completed BIGINT, failed BIGINT) AS $$
  SELECT
    s.store_id,
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'failed')
  FROM public.store_generation_sessions s
  GROUP BY s.store_id;
$$ LANGUAGE sql STABLE;

-- B2C: generation status breakdown (replaces full-table fetch + in-memory filter)
CREATE OR REPLACE FUNCTION get_generation_status_counts()
RETURNS TABLE (status TEXT, count BIGINT) AS $$
  SELECT gs.status, COUNT(*)
  FROM public.generation_sessions gs
  GROUP BY gs.status;
$$ LANGUAGE sql STABLE;

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON FUNCTION get_user_generation_stats IS 'Single-query generation stats per user (total, completed, failed)';
COMMENT ON FUNCTION get_processing_metrics IS 'Aggregate processing time metrics (avg, min, max) for completed generations';
COMMENT ON FUNCTION get_store_generation_counts IS 'Per-store generation counts for B2B dashboard (eliminates N+1)';
COMMENT ON FUNCTION get_generation_status_counts IS 'Generation status breakdown counts for analytics';
