-- Shopify order webhook credit transfer RPC
-- Migration: 011_shopify_order_credit_transfer_rpc
-- Adds: process_store_shopper_purchase() for atomic transfer + idempotency

CREATE OR REPLACE FUNCTION process_store_shopper_purchase(
  p_store_id UUID,
  p_shopper_email TEXT,
  p_shopify_order_id TEXT,
  p_credits_purchased INTEGER,
  p_amount_paid NUMERIC,
  p_currency TEXT DEFAULT 'USD',
  p_request_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  status TEXT,
  purchase_id UUID,
  store_id UUID,
  shopper_email TEXT,
  shopify_order_id TEXT,
  credits_purchased INTEGER,
  amount_paid NUMERIC,
  currency TEXT
) AS $$
DECLARE
  v_existing_purchase public.store_shopper_purchases%ROWTYPE;
  v_inserted_purchase public.store_shopper_purchases%ROWTYPE;
  v_deducted BOOLEAN;
  v_request_id TEXT := COALESCE(p_request_id, p_shopify_order_id);
BEGIN
  IF p_credits_purchased <= 0 THEN
    RAISE EXCEPTION 'Credits purchased must be positive';
  END IF;

  IF p_shopper_email IS NULL OR LENGTH(TRIM(p_shopper_email)) = 0 THEN
    RAISE EXCEPTION 'Shopper email is required';
  END IF;

  SELECT *
    INTO v_existing_purchase
  FROM public.store_shopper_purchases
  WHERE shopify_order_id = p_shopify_order_id;

  IF FOUND THEN
    RETURN QUERY
    SELECT
      'duplicate'::TEXT,
      v_existing_purchase.id,
      v_existing_purchase.store_id,
      v_existing_purchase.shopper_email,
      v_existing_purchase.shopify_order_id,
      v_existing_purchase.credits_purchased,
      v_existing_purchase.amount_paid,
      v_existing_purchase.currency;
    RETURN;
  END IF;

  v_deducted := deduct_store_credits(
    p_store_id,
    p_credits_purchased,
    v_request_id,
    format('Shopper credit purchase for order %s', p_shopify_order_id)
  );

  IF NOT v_deducted THEN
    RETURN QUERY
    SELECT
      'insufficient'::TEXT,
      NULL::UUID,
      p_store_id,
      p_shopper_email,
      p_shopify_order_id,
      p_credits_purchased,
      p_amount_paid,
      COALESCE(p_currency, 'USD');
    RETURN;
  END IF;

  INSERT INTO public.store_shopper_purchases (
    store_id,
    shopper_email,
    shopify_order_id,
    credits_purchased,
    amount_paid,
    currency
  ) VALUES (
    p_store_id,
    p_shopper_email,
    p_shopify_order_id,
    p_credits_purchased,
    p_amount_paid,
    COALESCE(p_currency, 'USD')
  )
  ON CONFLICT (shopify_order_id) DO NOTHING
  RETURNING * INTO v_inserted_purchase;

  IF NOT FOUND THEN
    PERFORM refund_store_credits(
      p_store_id,
      p_credits_purchased,
      v_request_id,
      format('Race-condition refund for order %s', p_shopify_order_id)
    );

    SELECT *
      INTO v_existing_purchase
    FROM public.store_shopper_purchases
    WHERE shopify_order_id = p_shopify_order_id;

    RETURN QUERY
    SELECT
      'duplicate'::TEXT,
      v_existing_purchase.id,
      v_existing_purchase.store_id,
      v_existing_purchase.shopper_email,
      v_existing_purchase.shopify_order_id,
      v_existing_purchase.credits_purchased,
      v_existing_purchase.amount_paid,
      v_existing_purchase.currency;
    RETURN;
  END IF;

  INSERT INTO public.store_shopper_credits (
    store_id,
    shopper_email,
    balance,
    total_purchased,
    total_spent
  ) VALUES (
    p_store_id,
    p_shopper_email,
    p_credits_purchased,
    p_credits_purchased,
    0
  )
  ON CONFLICT (store_id, shopper_email) DO UPDATE
    SET balance = public.store_shopper_credits.balance + EXCLUDED.balance,
        total_purchased = public.store_shopper_credits.total_purchased + EXCLUDED.total_purchased,
        updated_at = NOW();

  RETURN QUERY
  SELECT
    'processed'::TEXT,
    v_inserted_purchase.id,
    v_inserted_purchase.store_id,
    v_inserted_purchase.shopper_email,
    v_inserted_purchase.shopify_order_id,
    v_inserted_purchase.credits_purchased,
    v_inserted_purchase.amount_paid,
    v_inserted_purchase.currency;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_store_shopper_purchase IS
  'Atomically transfers purchased credits from store pool to shopper balance with idempotent order handling';
