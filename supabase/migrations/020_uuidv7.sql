-- Switch all tables from UUIDv4 (gen_random_uuid) to UUIDv7 (time-ordered)
-- Migration: 020_uuidv7
-- Benefits: sequential index inserts, no page splits, better cache locality

-- =============================================================================
-- Step 1: Create uuid_generate_v7() function (pure SQL, no extension needed)
-- Based on RFC 9562. Works on PostgreSQL 13+.
-- =============================================================================
CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS UUID AS $$
DECLARE
  unix_ts_ms BYTEA;
  uuid_bytes BYTEA;
BEGIN
  -- Get current unix timestamp in milliseconds (48 bits)
  unix_ts_ms = substring(
    int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint)
    FROM 3
  );

  -- Start with a random UUID for the random bits
  uuid_bytes = uuid_send(gen_random_uuid());

  -- Overlay first 6 bytes with timestamp
  uuid_bytes = overlay(uuid_bytes PLACING unix_ts_ms FROM 1 FOR 6);

  -- Set version to 7 (bits 48-51 = 0111)
  uuid_bytes = set_byte(
    uuid_bytes, 6,
    (b'0111' || get_byte(uuid_bytes, 6)::bit(4))::bit(8)::int
  );

  -- Set variant to RFC 4122 (bits 64-65 = 10)
  uuid_bytes = set_byte(
    uuid_bytes, 8,
    (b'10' || get_byte(uuid_bytes, 8)::bit(6))::bit(8)::int
  );

  RETURN encode(uuid_bytes, 'hex')::uuid;
END
$$ LANGUAGE plpgsql VOLATILE;

COMMENT ON FUNCTION uuid_generate_v7 IS
  'Generate RFC 9562 UUIDv7: time-ordered (ms precision) + random. Optimized for B-tree indexes.';

-- =============================================================================
-- Step 2: Switch all table defaults from gen_random_uuid() to uuid_generate_v7()
-- =============================================================================

-- 001: Initial schema
ALTER TABLE public.user_credits ALTER COLUMN id SET DEFAULT uuid_generate_v7();
ALTER TABLE public.credit_transactions ALTER COLUMN id SET DEFAULT uuid_generate_v7();
ALTER TABLE public.generation_sessions ALTER COLUMN id SET DEFAULT uuid_generate_v7();
ALTER TABLE public.analytics_events ALTER COLUMN id SET DEFAULT uuid_generate_v7();

-- 003: RBAC
ALTER TABLE public.roles ALTER COLUMN id SET DEFAULT uuid_generate_v7();
ALTER TABLE public.permissions ALTER COLUMN id SET DEFAULT uuid_generate_v7();
-- role_permissions and user_roles use composite PKs, no id column

-- 005: B2B stores
ALTER TABLE public.stores ALTER COLUMN id SET DEFAULT uuid_generate_v7();
ALTER TABLE public.store_api_keys ALTER COLUMN id SET DEFAULT uuid_generate_v7();
ALTER TABLE public.store_credits ALTER COLUMN id SET DEFAULT uuid_generate_v7();
ALTER TABLE public.store_credit_transactions ALTER COLUMN id SET DEFAULT uuid_generate_v7();

-- 006: B2B generation
ALTER TABLE public.store_generation_sessions ALTER COLUMN id SET DEFAULT uuid_generate_v7();
ALTER TABLE public.store_analytics_events ALTER COLUMN id SET DEFAULT uuid_generate_v7();

-- 007: B2B resell
ALTER TABLE public.store_shopper_credits ALTER COLUMN id SET DEFAULT uuid_generate_v7();
ALTER TABLE public.store_shopper_purchases ALTER COLUMN id SET DEFAULT uuid_generate_v7();

-- 008: Paddle billing
ALTER TABLE public.billing_webhook_events ALTER COLUMN id SET DEFAULT uuid_generate_v7();

-- 012: User body profiles
ALTER TABLE public.user_body_profiles ALTER COLUMN id SET DEFAULT uuid_generate_v7();
