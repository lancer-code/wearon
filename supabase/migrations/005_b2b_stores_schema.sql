-- B2B Stores Schema
-- Migration: 005_b2b_stores_schema
-- Creates: stores, store_api_keys, store_credits, store_credit_transactions
-- Plus: RPC functions for atomic credit operations, auto-creation trigger

-- =============================================================================
-- Task 1.1: stores table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_domain TEXT NOT NULL UNIQUE,
  access_token_encrypted TEXT,
  billing_mode TEXT NOT NULL CHECK (billing_mode IN ('absorb_mode', 'resell_mode')) DEFAULT 'absorb_mode',
  retail_credit_price NUMERIC,
  subscription_tier TEXT,
  subscription_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Task 1.2: store_api_keys table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.store_api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  allowed_domains TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Task 1.3: store_credits table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.store_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  total_purchased INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id)
);

-- Trigger: auto-create store_credits row with 0 balance when a new store is inserted
CREATE OR REPLACE FUNCTION handle_new_store()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.store_credits (store_id, balance, total_purchased, total_spent)
  VALUES (NEW.id, 0, 0, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_store_created
  AFTER INSERT ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_store();

-- =============================================================================
-- Task 1.4: store_credit_transactions table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.store_credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deduction', 'refund', 'purchase', 'subscription', 'overage')),
  request_id TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- Task 1.5: RPC functions for atomic credit operations
-- =============================================================================

-- Deduct store credits (returns FALSE if insufficient balance)
CREATE OR REPLACE FUNCTION deduct_store_credits(
  p_store_id UUID,
  p_amount INTEGER,
  p_request_id TEXT,
  p_description TEXT DEFAULT 'Generation credit deduction'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_balance INTEGER;
BEGIN
  -- Validate positive amount
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be a positive integer, got: %', p_amount;
  END IF;

  -- Get current balance with row lock
  SELECT balance INTO v_current_balance
  FROM public.store_credits
  WHERE store_id = p_store_id
  FOR UPDATE;

  -- Check if store credits exist
  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'Store credits not found for store_id: %', p_store_id;
  END IF;

  -- Check if sufficient credits
  IF v_current_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  -- Deduct credits
  UPDATE public.store_credits
  SET balance = balance - p_amount,
      total_spent = total_spent + p_amount
  WHERE store_id = p_store_id;

  -- Log transaction
  INSERT INTO public.store_credit_transactions (store_id, amount, type, request_id, description)
  VALUES (p_store_id, -p_amount, 'deduction', p_request_id, p_description);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Refund store credits
CREATE OR REPLACE FUNCTION refund_store_credits(
  p_store_id UUID,
  p_amount INTEGER,
  p_request_id TEXT,
  p_description TEXT DEFAULT 'Generation failed - refund'
)
RETURNS VOID AS $$
BEGIN
  -- Validate positive amount
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be a positive integer, got: %', p_amount;
  END IF;

  -- Add credits back
  UPDATE public.store_credits
  SET balance = balance + p_amount,
      total_spent = total_spent - p_amount
  WHERE store_id = p_store_id;

  -- Log transaction
  INSERT INTO public.store_credit_transactions (store_id, amount, type, request_id, description)
  VALUES (p_store_id, p_amount, 'refund', p_request_id, p_description);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Task 1.6: Indexes and updated_at triggers
-- =============================================================================

-- Indexes
CREATE INDEX IF NOT EXISTS idx_store_api_keys_key_hash ON public.store_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_store_api_keys_store_id ON public.store_api_keys(store_id);
CREATE INDEX IF NOT EXISTS idx_store_credit_transactions_store_id ON public.store_credit_transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_store_credit_transactions_created_at ON public.store_credit_transactions(created_at DESC);

-- updated_at triggers (reuses update_updated_at_column() from migration 001)
CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_credits_updated_at
  BEFORE UPDATE ON public.store_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON TABLE public.stores IS 'B2B merchant stores registered via Shopify OAuth';
COMMENT ON TABLE public.store_api_keys IS 'SHA-256 hashed API keys for B2B plugin authentication';
COMMENT ON TABLE public.store_credits IS 'B2B store credit balances (wholesale pool)';
COMMENT ON TABLE public.store_credit_transactions IS 'B2B credit transaction audit trail with correlation IDs';
COMMENT ON FUNCTION handle_new_store IS 'Auto-creates store_credits row with 0 balance on store insert';
COMMENT ON FUNCTION deduct_store_credits IS 'Atomically deduct credits from store balance with row lock';
COMMENT ON FUNCTION refund_store_credits IS 'Refund credits to store (e.g., on generation failure)';
