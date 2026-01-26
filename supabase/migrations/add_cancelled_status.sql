-- Add 'cancelled' as a valid status for draft_sessions
-- This allows the host to cancel a draft and notify all players via realtime

-- Drop the existing constraint and add a new one with 'cancelled' included
ALTER TABLE draft_sessions DROP CONSTRAINT IF EXISTS draft_sessions_status_check;
ALTER TABLE draft_sessions ADD CONSTRAINT draft_sessions_status_check
  CHECK (status IN ('waiting', 'in_progress', 'completed', 'cancelled'));
