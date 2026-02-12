-- Store shopper credit atomic RPCs
-- Migration: 011_store_shopper_credit_rpcs
-- Adds: deduct_store_shopper_credits, refund_store_shopper_credits

CREATE OR REPLACE FUNCTION deduct_store_shopper_credits(
  p_store_id UUID,
  p_shopper_email TEXT,
  p_amount INTEGER,
  p_request_id TEXT,
  p_description TEXT DEFAULT 'B2B shopper generation'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_balance INTEGER;
  v_normalized_email TEXT;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Deduction amount must be positive';
  END IF;

  v_normalized_email := LOWER(TRIM(p_shopper_email));
  IF v_normalized_email = '' THEN
    RAISE EXCEPTION 'Shopper email is required';
  END IF;

  SELECT balance INTO v_current_balance
  FROM public.store_shopper_credits
  WHERE store_id = p_store_id
    AND shopper_email = v_normalized_email
  FOR UPDATE;

  IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  UPDATE public.store_shopper_credits
  SET balance = balance - p_amount,
      total_spent = total_spent + p_amount
  WHERE store_id = p_store_id
    AND shopper_email = v_normalized_email;

  INSERT INTO public.store_credit_transactions (store_id, amount, type, request_id, description)
  VALUES (
    p_store_id,
    -p_amount,
    'deduction',
    p_request_id,
    CONCAT(p_description, ' (shopper=', v_normalized_email, ')')
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refund_store_shopper_credits(
  p_store_id UUID,
  p_shopper_email TEXT,
  p_amount INTEGER,
  p_request_id TEXT,
  p_description TEXT DEFAULT 'B2B shopper generation failed - refund'
)
RETURNS VOID AS $$
DECLARE
  v_normalized_email TEXT;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be positive';
  END IF;

  v_normalized_email := LOWER(TRIM(p_shopper_email));
  IF v_normalized_email = '' THEN
    RAISE EXCEPTION 'Shopper email is required';
  END IF;

  UPDATE public.store_shopper_credits
  SET balance = balance + p_amount,
      total_spent = GREATEST(total_spent - p_amount, 0)
  WHERE store_id = p_store_id
    AND shopper_email = v_normalized_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shopper credits not found for store_id: %, shopper_email: %', p_store_id, v_normalized_email;
  END IF;

  INSERT INTO public.store_credit_transactions (store_id, amount, type, request_id, description)
  VALUES (
    p_store_id,
    p_amount,
    'refund',
    p_request_id,
    CONCAT(p_description, ' (shopper=', v_normalized_email, ')')
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION deduct_store_shopper_credits IS
  'Atomically deduct shopper credits in resell mode and log a transaction row';

COMMENT ON FUNCTION refund_store_shopper_credits IS
  'Refund shopper credits in resell mode and log a transaction row';
