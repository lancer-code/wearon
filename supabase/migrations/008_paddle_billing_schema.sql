-- Paddle Billing Schema
-- Migration: 008_paddle_billing_schema
-- Adds: Paddle store metadata, webhook idempotency table, and atomic credit add RPC

-- =============================================================================
-- Stores metadata for Paddle billing lifecycle
-- =============================================================================
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS paddle_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_stores_paddle_customer_id ON public.stores(paddle_customer_id);
CREATE INDEX IF NOT EXISTS idx_stores_subscription_status ON public.stores(subscription_status);

-- =============================================================================
-- Atomic credit add operation for purchases/subscription top-ups
-- =============================================================================
CREATE OR REPLACE FUNCTION add_store_credits(
  p_store_id UUID,
  p_amount INTEGER,
  p_type TEXT,
  p_request_id TEXT,
  p_description TEXT DEFAULT 'Store credit purchase'
)
RETURNS VOID AS $$
DECLARE
  v_current_balance INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Credit amount must be positive';
  END IF;

  IF p_type NOT IN ('purchase', 'subscription') THEN
    RAISE EXCEPTION 'Unsupported credit transaction type: %', p_type;
  END IF;

  SELECT balance INTO v_current_balance
  FROM public.store_credits
  WHERE store_id = p_store_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'Store credits not found for store_id: %', p_store_id;
  END IF;

  UPDATE public.store_credits
  SET balance = balance + p_amount,
      total_purchased = total_purchased + p_amount
  WHERE store_id = p_store_id;

  INSERT INTO public.store_credit_transactions (store_id, amount, type, request_id, description)
  VALUES (p_store_id, p_amount, p_type, p_request_id, p_description);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION add_store_credits IS
  'Atomically adds store credits and logs purchase/subscription transaction';

-- =============================================================================
-- Webhook idempotency table (Paddle event processing)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('paddle')),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  request_id TEXT,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_provider
  ON public.billing_webhook_events(provider);
CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_store_id
  ON public.billing_webhook_events(store_id);
CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_processed_at
  ON public.billing_webhook_events(processed_at DESC);

COMMENT ON TABLE public.billing_webhook_events IS
  'Webhook event idempotency and audit log for billing providers';
