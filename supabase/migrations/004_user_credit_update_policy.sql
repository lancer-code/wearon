-- Allow users to update their own credits via RPC functions
-- Migration: 004_user_credit_update_policy
--
-- This adds UPDATE/INSERT policies so deduct_credits and refund_credits
-- can work without SECURITY DEFINER when called by authenticated users.

-- Allow users to update their own credits (for deduct/refund operations)
CREATE POLICY "Users can update own credits"
  ON public.user_credits
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to insert their own credit transactions (for audit logging)
CREATE POLICY "Users can insert own transactions"
  ON public.credit_transactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "Users can update own credits" ON public.user_credits IS 'Allow credit deduction/refund via RPC functions';
COMMENT ON POLICY "Users can insert own transactions" ON public.credit_transactions IS 'Allow transaction logging via RPC functions';
