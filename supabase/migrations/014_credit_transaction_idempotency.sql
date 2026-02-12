-- Credit Transaction Idempotency Protection
-- Migration: 014_credit_transaction_idempotency
-- Fixes: HIGH #3 - Prevents duplicate credit grants on retry

-- Add unique constraint to prevent duplicate transactions for same request
ALTER TABLE public.store_credit_transactions
  ADD CONSTRAINT unique_credit_transaction_request
  UNIQUE (store_id, request_id, type);

CREATE INDEX IF NOT EXISTS idx_store_credit_transactions_request_lookup
  ON public.store_credit_transactions(store_id, request_id, type);

COMMENT ON CONSTRAINT unique_credit_transaction_request ON public.store_credit_transactions IS
  'Prevents duplicate credit transactions for the same request_id, providing idempotency protection for retries';

-- Update add_store_credits to handle idempotency gracefully
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
  v_existing_transaction UUID;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Credit amount must be positive';
  END IF;

  IF p_type NOT IN ('purchase', 'subscription') THEN
    RAISE EXCEPTION 'Unsupported credit transaction type: %', p_type;
  END IF;

  -- Check for existing transaction with same request_id (idempotency)
  SELECT id INTO v_existing_transaction
  FROM public.store_credit_transactions
  WHERE store_id = p_store_id
    AND request_id = p_request_id
    AND type = p_type
  LIMIT 1;

  -- If transaction already exists, this is a retry - return successfully without duplicate grant
  IF v_existing_transaction IS NOT NULL THEN
    RETURN;
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
  'Atomically adds store credits with idempotency protection - safe to retry with same request_id';
