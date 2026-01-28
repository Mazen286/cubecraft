-- Add hide_scores column for competitive mode
-- When true, card scores/ratings are hidden during the draft

ALTER TABLE draft_sessions ADD COLUMN IF NOT EXISTS hide_scores BOOLEAN NOT NULL DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN draft_sessions.hide_scores IS 'Competitive mode: hides card scores/ratings during draft';
