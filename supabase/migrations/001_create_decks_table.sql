-- Decks table migration
-- Run this in your Supabase SQL Editor to add the decks table

-- Decks table - stores user-created decks for deck building
CREATE TABLE IF NOT EXISTS decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  game_id VARCHAR(20) NOT NULL,  -- 'yugioh', 'mtg', 'pokemon', 'hearthstone'
  cube_id UUID,  -- Optional: if deck was built from a cube
  creator_id TEXT,  -- User ID from auth
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  card_count INTEGER NOT NULL DEFAULT 0,
  card_data JSONB NOT NULL DEFAULT '{}',  -- Stores card details keyed by instanceId
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user lookups (most common query)
CREATE INDEX IF NOT EXISTS idx_decks_creator_id ON decks(creator_id);

-- Index for game filtering
CREATE INDEX IF NOT EXISTS idx_decks_game_id ON decks(game_id);

-- Index for public deck browsing
CREATE INDEX IF NOT EXISTS idx_decks_is_public ON decks(is_public) WHERE is_public = TRUE;

-- Index for cube-based deck lookups
CREATE INDEX IF NOT EXISTS idx_decks_cube_id ON decks(cube_id) WHERE cube_id IS NOT NULL;

-- Composite index for common query pattern (user's decks by game)
CREATE INDEX IF NOT EXISTS idx_decks_creator_game ON decks(creator_id, game_id);

-- Enable Row Level Security
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for decks

-- Anyone can view public decks
CREATE POLICY "Public decks are viewable by everyone"
  ON decks FOR SELECT
  USING (is_public = TRUE);

-- Users can view their own decks
CREATE POLICY "Users can view own decks"
  ON decks FOR SELECT
  USING (creator_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Users can create decks
CREATE POLICY "Users can create decks"
  ON decks FOR INSERT
  WITH CHECK (
    creator_id = current_setting('request.jwt.claims', true)::json->>'sub'
    OR creator_id IS NULL  -- Allow anonymous decks for testing
  );

-- Users can update their own decks
CREATE POLICY "Users can update own decks"
  ON decks FOR UPDATE
  USING (creator_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Users can delete their own decks
CREATE POLICY "Users can delete own decks"
  ON decks FOR DELETE
  USING (creator_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_decks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on changes
DROP TRIGGER IF EXISTS trigger_decks_updated_at ON decks;
CREATE TRIGGER trigger_decks_updated_at
  BEFORE UPDATE ON decks
  FOR EACH ROW
  EXECUTE FUNCTION update_decks_updated_at();

-- Grant access (adjust based on your auth setup)
-- For anon and authenticated users
GRANT SELECT ON decks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON decks TO authenticated;
