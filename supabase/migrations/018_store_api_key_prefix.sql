-- Migration: Add key_prefix column to store_api_keys for masked display
-- Issue: Masked key preview was derived from hash instead of actual key prefix
-- Solution: Store first 16 chars of real key for dashboard display (e.g., "wk_a1b2c3d4e5f6")

ALTER TABLE public.store_api_keys
ADD COLUMN IF NOT EXISTS key_prefix TEXT;

CREATE INDEX IF NOT EXISTS idx_store_api_keys_prefix
ON public.store_api_keys(key_prefix);

COMMENT ON COLUMN public.store_api_keys.key_prefix IS
'First 16 characters of the API key for masked display (e.g., wk_a1b2c3d4e5f6). Combined with suffix mask shows as wk_a1b2c3d4...****';
