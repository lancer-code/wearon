-- Store Churn Detection Columns
-- Migration: 015_store_churn_detection
-- Adds: is_churn_risk boolean and churn_flagged_at timestamptz to stores table

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS is_churn_risk BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS churn_flagged_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_stores_is_churn_risk ON public.stores(is_churn_risk) WHERE is_churn_risk = true;

COMMENT ON COLUMN public.stores.is_churn_risk IS 'Flag indicating store has >50% week-over-week generation drop';
COMMENT ON COLUMN public.stores.churn_flagged_at IS 'Timestamp when churn risk was last detected';
