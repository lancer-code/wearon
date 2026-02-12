-- Add owner_user_id to stores table for Supabase Auth linkage
-- Migration: 017_stores_owner_user_id
-- Links merchant stores to Supabase Auth users for dashboard access

-- Add owner_user_id column to stores table
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for faster user-to-store lookups
CREATE INDEX IF NOT EXISTS idx_stores_owner_user_id ON public.stores(owner_user_id);

-- Comment
COMMENT ON COLUMN public.stores.owner_user_id IS 'Supabase Auth user ID of the store owner (linked during OAuth)';
