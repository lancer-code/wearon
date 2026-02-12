-- Store shopper credit RPC functions
-- Migration: 013_store_shopper_credit_rpc
-- Adds: deduct_store_shopper_credits, refund_store_shopper_credits

CREATE OR REPLACE FUNCTION deduct_store_shopper_credits(
  p_store_id UUID,
  p_shopper_email TEXT,
  p_amount INTEGER,
  p_request_id TEXT,
  p_description TEXT DEFAULT 'Shopper credit deduction'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_balance INTEGER;
  v_email TEXT := LOWER(TRIM(p_shopper_email));
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Deduction amount must be positive';
  END IF;

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Shopper email is required';
  END IF;

  SELECT balance
    INTO v_current_balance
  FROM public.store_shopper_credits
  WHERE store_id = p_store_id
    AND shopper_email = v_email
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  UPDATE public.store_shopper_credits
  SET balance = balance - p_amount,
      total_spent = total_spent + p_amount
  WHERE store_id = p_store_id
    AND shopper_email = v_email;

  INSERT INTO public.store_credit_transactions (store_id, amount, type, request_id, description)
  VALUES (
    p_store_id,
    -p_amount,
    'deduction',
    p_request_id,
    COALESCE(p_description, 'Shopper credit deduction') || ' [shopper_hash=' || SUBSTRING(MD5(v_email), 1, 12) || ']'
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refund_store_shopper_credits(
  p_store_id UUID,
  p_shopper_email TEXT,
  p_amount INTEGER,
  p_request_id TEXT,
  p_description TEXT DEFAULT 'Shopper credit refund'
)
RETURNS VOID AS $$
DECLARE
  v_email TEXT := LOWER(TRIM(p_shopper_email));
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be positive';
  END IF;

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Shopper email is required';
  END IF;

  INSERT INTO public.store_shopper_credits (
    store_id,
    shopper_email,
    balance,
    total_purchased,
    total_spent
  ) VALUES (
    p_store_id,
    v_email,
    p_amount,
    0,
    0
  )
  ON CONFLICT (store_id, shopper_email) DO UPDATE
  SET balance = public.store_shopper_credits.balance + p_amount,
      total_spent = GREATEST(public.store_shopper_credits.total_spent - p_amount, 0),
      updated_at = NOW();

  INSERT INTO public.store_credit_transactions (store_id, amount, type, request_id, description)
  VALUES (
    p_store_id,
    p_amount,
    'refund',
    p_request_id,
    COALESCE(p_description, 'Shopper credit refund') || ' [shopper_hash=' || SUBSTRING(MD5(v_email), 1, 12) || ']'
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION deduct_store_shopper_credits IS
  'Atomically deducts shopper credits for resell-mode generation requests';
COMMENT ON FUNCTION refund_store_shopper_credits IS
  'Refunds shopper credits when resell-mode generation fails before completion';
