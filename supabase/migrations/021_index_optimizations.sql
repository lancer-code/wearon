-- Index optimizations for query performance
-- Migration: 021_index_optimizations
-- Adds: partial indexes, BRIN indexes, covering indexes

-- =============================================================================
-- 1. Partial indexes on generation status (hot path: active jobs)
-- Only indexes rows that matter for queue polling — tiny index, fast scans
-- =============================================================================

-- B2C: active generation jobs
CREATE INDEX IF NOT EXISTS idx_generation_sessions_active
  ON public.generation_sessions(status, created_at DESC)
  WHERE status IN ('pending', 'processing');

-- B2B: active generation jobs
CREATE INDEX IF NOT EXISTS idx_store_generation_sessions_active
  ON public.store_generation_sessions(status, created_at DESC)
  WHERE status IN ('queued', 'processing');

-- =============================================================================
-- 2. BRIN indexes on created_at for append-only time-series tables
-- ~100x smaller than B-tree, ideal for time-ordered data (especially with UUIDv7)
-- =============================================================================

-- Analytics events (B2C) — high volume, queried by time range
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at_brin
  ON public.analytics_events USING brin(created_at);

-- Analytics events (B2B) — high volume, queried by time range
CREATE INDEX IF NOT EXISTS idx_store_analytics_events_created_at_brin
  ON public.store_analytics_events USING brin(created_at);

-- Credit transactions (B2C) — append-only audit log
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at_brin
  ON public.credit_transactions USING brin(created_at);

-- Credit transactions (B2B) — append-only audit log
CREATE INDEX IF NOT EXISTS idx_store_credit_transactions_created_at_brin
  ON public.store_credit_transactions USING brin(created_at);

-- Webhook events — append-only, queried by time
CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_processed_at_brin
  ON public.billing_webhook_events USING brin(processed_at);

-- =============================================================================
-- 3. Covering indexes for common lookups (avoids table fetch)
-- =============================================================================

-- Store lookup by domain: includes fields needed by withShopifySession middleware
CREATE INDEX IF NOT EXISTS idx_stores_domain_covering
  ON public.stores(shop_domain)
  INCLUDE (id, status, billing_mode, subscription_tier);

-- API key auth: hash lookup returning store_id + active flag without table fetch
CREATE INDEX IF NOT EXISTS idx_store_api_keys_hash_covering
  ON public.store_api_keys(key_hash)
  INCLUDE (store_id, is_active);

-- =============================================================================
-- 4. Drop redundant B-tree indexes replaced by BRIN or partial indexes
-- =============================================================================

-- The B-tree on store_credit_transactions(created_at DESC) is replaced by BRIN
DROP INDEX IF EXISTS idx_store_credit_transactions_created_at;

-- The B-tree on billing_webhook_events(processed_at DESC) is replaced by BRIN
DROP INDEX IF EXISTS idx_billing_webhook_events_processed_at;

-- The B-tree on store_generation_sessions(status) is mostly replaced by partial index
DROP INDEX IF EXISTS idx_store_generation_sessions_status;
