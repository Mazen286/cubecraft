-- Yu-Gi-Oh! Cube Draft - Supabase Schema
-- Run this in your Supabase SQL Editor to set up the database
-- This will DROP existing tables and recreate them fresh

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables (cascade to handle foreign keys)
DROP TABLE IF EXISTS draft_burned_cards CASCADE;
DROP TABLE IF EXISTS draft_picks CASCADE;
DROP TABLE IF EXISTS draft_players CASCADE;
DROP TABLE IF EXISTS draft_sessions CASCADE;

-- Draft Sessions table
CREATE TABLE IF NOT EXISTS draft_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code VARCHAR(4) NOT NULL UNIQUE,
  host_id TEXT NOT NULL,
  cube_id TEXT NOT NULL,
  mode VARCHAR(10) NOT NULL CHECK (mode IN ('pack', 'open')),
  player_count INTEGER NOT NULL CHECK (player_count >= 1 AND player_count <= 12),
  cards_per_player INTEGER NOT NULL,
  pack_size INTEGER NOT NULL,
  burned_per_pack INTEGER NOT NULL DEFAULT 0,
  timer_seconds INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'completed', 'cancelled')),
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  current_pack INTEGER NOT NULL DEFAULT 1,
  current_pick INTEGER NOT NULL DEFAULT 1,
  direction VARCHAR(5) NOT NULL DEFAULT 'left' CHECK (direction IN ('left', 'right')),
  pack_data JSONB,
  pick_started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  time_remaining_at_pause INTEGER,
  resume_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Index for room code lookups
CREATE INDEX IF NOT EXISTS idx_draft_sessions_room_code ON draft_sessions(room_code);

-- Index for cleaning up old sessions
CREATE INDEX IF NOT EXISTS idx_draft_sessions_created_at ON draft_sessions(created_at);

-- Draft Players table
CREATE TABLE IF NOT EXISTS draft_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES draft_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  name VARCHAR(50) NOT NULL,
  seat_position INTEGER NOT NULL CHECK (seat_position >= 0 AND seat_position < 12),
  is_host BOOLEAN NOT NULL DEFAULT FALSE,
  is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  is_connected BOOLEAN NOT NULL DEFAULT TRUE,
  current_hand INTEGER[] NOT NULL DEFAULT '{}',
  pick_made BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Each user can only be in a session once
  UNIQUE(session_id, user_id),
  -- Each seat can only be occupied once per session
  UNIQUE(session_id, seat_position)
);

-- Index for session lookups
CREATE INDEX IF NOT EXISTS idx_draft_players_session_id ON draft_players(session_id);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_draft_players_user_id ON draft_players(user_id);

-- Draft Picks table
CREATE TABLE IF NOT EXISTS draft_picks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES draft_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES draft_players(id) ON DELETE CASCADE,
  card_id INTEGER NOT NULL,
  pack_number INTEGER NOT NULL,
  pick_number INTEGER NOT NULL,
  pick_time_seconds INTEGER NOT NULL DEFAULT 0,
  was_auto_pick BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Each card can only be picked once per session
  UNIQUE(session_id, card_id),
  -- Each player can only make one pick per round
  UNIQUE(session_id, player_id, pack_number, pick_number)
);

-- Index for player picks lookups
CREATE INDEX IF NOT EXISTS idx_draft_picks_player_id ON draft_picks(player_id);

-- Draft Burned Cards table - tracks cards discarded after each pack
CREATE TABLE IF NOT EXISTS draft_burned_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES draft_sessions(id) ON DELETE CASCADE,
  card_id INTEGER NOT NULL,
  pack_number INTEGER NOT NULL,
  burned_from_seat INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for session lookups on burned cards
CREATE INDEX IF NOT EXISTS idx_draft_burned_cards_session_id ON draft_burned_cards(session_id);

-- Enable Row Level Security
ALTER TABLE draft_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_burned_cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for draft_sessions
-- Anyone can read sessions (needed for joining)
CREATE POLICY "Sessions are viewable by everyone"
  ON draft_sessions FOR SELECT
  USING (true);

-- Anyone can create sessions
CREATE POLICY "Anyone can create sessions"
  ON draft_sessions FOR INSERT
  WITH CHECK (true);

-- Only host can update session
CREATE POLICY "Host can update session"
  ON draft_sessions FOR UPDATE
  USING (true); -- We'll verify host in application code for simplicity

-- RLS Policies for draft_players
-- Anyone can view players in a session
CREATE POLICY "Players are viewable by everyone"
  ON draft_players FOR SELECT
  USING (true);

-- Anyone can join a session
CREATE POLICY "Anyone can join a session"
  ON draft_players FOR INSERT
  WITH CHECK (true);

-- Players can update their own record
CREATE POLICY "Players can update own record"
  ON draft_players FOR UPDATE
  USING (true); -- We'll verify in application code

-- RLS Policies for draft_picks
-- Anyone can view picks
CREATE POLICY "Picks are viewable by everyone"
  ON draft_picks FOR SELECT
  USING (true);

-- Anyone can make picks
CREATE POLICY "Anyone can make picks"
  ON draft_picks FOR INSERT
  WITH CHECK (true);

-- RLS Policies for draft_burned_cards
-- Anyone can view burned cards
CREATE POLICY "Burned cards are viewable by everyone"
  ON draft_burned_cards FOR SELECT
  USING (true);

-- Anyone can record burned cards
CREATE POLICY "Anyone can record burned cards"
  ON draft_burned_cards FOR INSERT
  WITH CHECK (true);

-- Enable Realtime for these tables (safe to run multiple times)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'draft_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE draft_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'draft_players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE draft_players;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'draft_picks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE draft_picks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'draft_burned_cards'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE draft_burned_cards;
  END IF;
END $$;

-- Function to clean up old sessions (run as a scheduled job)
CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM draft_sessions
  WHERE created_at < NOW() - INTERVAL '24 hours'
    AND status IN ('waiting', 'completed');
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Decks table - stores user-created decks for deck building
-- =============================================================================

DROP TABLE IF EXISTS decks CASCADE;

CREATE TABLE IF NOT EXISTS decks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Grant access
GRANT SELECT ON decks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON decks TO authenticated;
