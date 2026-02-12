-- Store API key hash format guard
-- Migration: 009_store_api_keys_hash_guard
-- Enforces SHA-256 hex hash format for store_api_keys.key_hash

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'store_api_keys_key_hash_sha256_chk'
  ) THEN
    ALTER TABLE public.store_api_keys
      ADD CONSTRAINT store_api_keys_key_hash_sha256_chk
      CHECK (key_hash ~ '^[a-f0-9]{64}$') NOT VALID;
  END IF;
END
$$;

DO $$
DECLARE
  invalid_hash_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO invalid_hash_count
  FROM public.store_api_keys
  WHERE key_hash !~ '^[a-f0-9]{64}$';

  IF invalid_hash_count = 0 THEN
    ALTER TABLE public.store_api_keys
      VALIDATE CONSTRAINT store_api_keys_key_hash_sha256_chk;
  ELSE
    RAISE NOTICE 'store_api_keys_key_hash_sha256_chk left NOT VALID due to % invalid existing rows',
      invalid_hash_count;
  END IF;
END
$$;

COMMENT ON CONSTRAINT store_api_keys_key_hash_sha256_chk ON public.store_api_keys IS
  'Ensures key_hash is a 64-character lowercase SHA-256 hex digest';
