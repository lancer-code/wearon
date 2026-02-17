-- Fix generation_sessions status check constraint to allow 'queued'
-- Migration: 023_fix_generation_status

-- 1. Drop the old constraint
ALTER TABLE public.generation_sessions
  DROP CONSTRAINT IF EXISTS generation_sessions_status_check;

-- 2. Add new constraint allowing 'queued' (and keeping 'pending' for backward compatibility)
ALTER TABLE public.generation_sessions
  ADD CONSTRAINT generation_sessions_status_check
  CHECK (status IN ('queued', 'pending', 'processing', 'completed', 'failed'));

-- 3. Update default value to 'queued' to match code
ALTER TABLE public.generation_sessions
  ALTER COLUMN status SET DEFAULT 'queued';

-- 4. Update any existing 'pending' to 'queued' for consistency
UPDATE public.generation_sessions
SET status = 'queued'
WHERE status = 'pending';

-- Comments
COMMENT ON COLUMN public.generation_sessions.status IS 'Status: queued, processing, completed, failed (pending deprecated)';
