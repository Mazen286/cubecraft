-- Cubes table - stores user-uploaded cube definitions
-- This table allows users to create and share their own cubes

CREATE TABLE IF NOT EXISTS cubes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  game_id TEXT NOT NULL,
  creator_id TEXT, -- User ID (anonymous uploads allowed initially)
  is_public BOOLEAN NOT NULL DEFAULT false,
  card_count INTEGER NOT NULL,
  card_data JSONB NOT NULL, -- The card map with all card data
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for game-specific cube lookups
CREATE INDEX IF NOT EXISTS idx_cubes_game_id ON cubes(game_id);

-- Index for public cube listings
CREATE INDEX IF NOT EXISTS idx_cubes_is_public ON cubes(is_public) WHERE is_public = true;

-- Index for creator lookups
CREATE INDEX IF NOT EXISTS idx_cubes_creator_id ON cubes(creator_id) WHERE creator_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE cubes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cubes

-- Anyone can view public cubes
CREATE POLICY "Public cubes are viewable by everyone"
  ON cubes FOR SELECT
  USING (is_public = true);

-- Creators can view their own cubes (including private ones)
CREATE POLICY "Creators can view own cubes"
  ON cubes FOR SELECT
  USING (creator_id IS NOT NULL AND creator_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Anyone can create cubes (for now, no auth required)
CREATE POLICY "Anyone can create cubes"
  ON cubes FOR INSERT
  WITH CHECK (true);

-- Creators can update their own cubes
CREATE POLICY "Creators can update own cubes"
  ON cubes FOR UPDATE
  USING (creator_id IS NOT NULL AND creator_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Creators can delete their own cubes
CREATE POLICY "Creators can delete own cubes"
  ON cubes FOR DELETE
  USING (creator_id IS NOT NULL AND creator_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cubes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS cubes_updated_at ON cubes;
CREATE TRIGGER cubes_updated_at
  BEFORE UPDATE ON cubes
  FOR EACH ROW
  EXECUTE FUNCTION update_cubes_updated_at();
