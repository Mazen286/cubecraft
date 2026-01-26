-- Data Retention Cleanup Migration
-- Adds configurable retention policies for draft data

-- Create app_settings table for configurable values
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default retention settings (in hours)
INSERT INTO app_settings (key, value) VALUES
  ('retention_completed_hours', '72'::jsonb),      -- 3 days for completed drafts
  ('retention_abandoned_hours', '6'::jsonb),       -- 6 hours for waiting/abandoned
  ('retention_cancelled_hours', '24'::jsonb)       -- 24 hours for cancelled
ON CONFLICT (key) DO NOTHING;

-- RLS for app_settings (read-only for everyone, we'll update via admin)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Settings are viewable by everyone"
  ON app_settings FOR SELECT
  USING (true);

CREATE POLICY "Settings can be updated"
  ON app_settings FOR UPDATE
  USING (true);

-- Add index on status + created_at for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_draft_sessions_status_created
  ON draft_sessions(status, created_at);

-- Improved cleanup function with configurable retention
CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS TABLE(
  deleted_completed INTEGER,
  deleted_abandoned INTEGER,
  deleted_cancelled INTEGER
) AS $$
DECLARE
  retention_completed INTEGER;
  retention_abandoned INTEGER;
  retention_cancelled INTEGER;
  count_completed INTEGER;
  count_abandoned INTEGER;
  count_cancelled INTEGER;
BEGIN
  -- Get retention settings (default fallbacks if not set)
  SELECT COALESCE((SELECT (value)::integer FROM app_settings WHERE key = 'retention_completed_hours'), 72) INTO retention_completed;
  SELECT COALESCE((SELECT (value)::integer FROM app_settings WHERE key = 'retention_abandoned_hours'), 6) INTO retention_abandoned;
  SELECT COALESCE((SELECT (value)::integer FROM app_settings WHERE key = 'retention_cancelled_hours'), 24) INTO retention_cancelled;

  -- Delete completed sessions older than retention period
  WITH deleted AS (
    DELETE FROM draft_sessions
    WHERE status = 'completed'
      AND completed_at < NOW() - (retention_completed || ' hours')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO count_completed FROM deleted;

  -- Delete waiting (abandoned) sessions older than retention period
  WITH deleted AS (
    DELETE FROM draft_sessions
    WHERE status = 'waiting'
      AND created_at < NOW() - (retention_abandoned || ' hours')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO count_abandoned FROM deleted;

  -- Delete cancelled sessions older than retention period
  WITH deleted AS (
    DELETE FROM draft_sessions
    WHERE status = 'cancelled'
      AND created_at < NOW() - (retention_cancelled || ' hours')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO count_cancelled FROM deleted;

  -- Return counts
  deleted_completed := count_completed;
  deleted_abandoned := count_abandoned;
  deleted_cancelled := count_cancelled;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current database stats
CREATE OR REPLACE FUNCTION get_draft_stats()
RETURNS TABLE(
  total_sessions BIGINT,
  waiting_sessions BIGINT,
  in_progress_sessions BIGINT,
  completed_sessions BIGINT,
  cancelled_sessions BIGINT,
  total_picks BIGINT,
  total_players BIGINT,
  oldest_session_days NUMERIC
) AS $$
BEGIN
  SELECT COUNT(*) INTO total_sessions FROM draft_sessions;
  SELECT COUNT(*) INTO waiting_sessions FROM draft_sessions WHERE status = 'waiting';
  SELECT COUNT(*) INTO in_progress_sessions FROM draft_sessions WHERE status = 'in_progress';
  SELECT COUNT(*) INTO completed_sessions FROM draft_sessions WHERE status = 'completed';
  SELECT COUNT(*) INTO cancelled_sessions FROM draft_sessions WHERE status = 'cancelled';
  SELECT COUNT(*) INTO total_picks FROM draft_picks;
  SELECT COUNT(*) INTO total_players FROM draft_players;
  SELECT COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(created_at))) / 86400, 0) INTO oldest_session_days FROM draft_sessions;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION cleanup_old_sessions() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_draft_stats() TO anon, authenticated;

-- To schedule automatic cleanup, use one of these options:
--
-- Option 1: Supabase pg_cron (if available on your plan)
-- SELECT cron.schedule('cleanup-drafts', '0 */6 * * *', 'SELECT cleanup_old_sessions()');
--
-- Option 2: Call via Supabase Edge Function with cron trigger
-- Option 3: External cron service calling the function via REST API
