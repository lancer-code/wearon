-- B2B Resell Mode Schema
-- Migration: 007_b2b_resell_schema
-- Creates: store_shopper_credits, store_shopper_purchases

-- =============================================================================
-- Task 3.1: store_shopper_credits table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.store_shopper_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  shopper_email TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  total_purchased INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, shopper_email)
);

-- updated_at trigger (reuses update_updated_at_column() from migration 001)
CREATE TRIGGER update_store_shopper_credits_updated_at
  BEFORE UPDATE ON public.store_shopper_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Task 3.2: store_shopper_purchases table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.store_shopper_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  shopper_email TEXT NOT NULL,
  shopify_order_id TEXT NOT NULL UNIQUE,
  credits_purchased INTEGER NOT NULL,
  amount_paid NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Task 3.3: Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_store_shopper_credits_store_email ON public.store_shopper_credits(store_id, shopper_email);
CREATE INDEX IF NOT EXISTS idx_store_shopper_purchases_store_id ON public.store_shopper_purchases(store_id);
CREATE INDEX IF NOT EXISTS idx_store_shopper_purchases_order_id ON public.store_shopper_purchases(shopify_order_id);

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON TABLE public.store_shopper_credits IS 'Per-shopper credit balances scoped to individual stores (resell mode)';
COMMENT ON TABLE public.store_shopper_purchases IS 'Shopify order-based credit purchase audit trail (idempotent via shopify_order_id)';
