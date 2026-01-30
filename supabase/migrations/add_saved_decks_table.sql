-- Add saved_decks table for persisting deck configurations
-- This stores deck builder configurations for each player in a session

CREATE TABLE IF NOT EXISTS saved_decks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES draft_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES draft_players(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  deck_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Each player can only have one save with a given name per session
  UNIQUE(session_id, player_id, name)
);

-- Index for player lookups
CREATE INDEX IF NOT EXISTS idx_saved_decks_player_id ON saved_decks(player_id);

-- Index for session lookups
CREATE INDEX IF NOT EXISTS idx_saved_decks_session_id ON saved_decks(session_id);

-- Enable Row Level Security
ALTER TABLE saved_decks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for saved_decks
-- Anyone can view saved decks (needed for loading)
CREATE POLICY "Saved decks are viewable by everyone"
  ON saved_decks FOR SELECT
  USING (true);

-- Anyone can create saved decks
CREATE POLICY "Anyone can create saved decks"
  ON saved_decks FOR INSERT
  WITH CHECK (true);

-- Anyone can update saved decks (we verify ownership in application code)
CREATE POLICY "Anyone can update saved decks"
  ON saved_decks FOR UPDATE
  USING (true);

-- Anyone can delete saved decks (we verify ownership in application code)
CREATE POLICY "Anyone can delete saved decks"
  ON saved_decks FOR DELETE
  USING (true);
