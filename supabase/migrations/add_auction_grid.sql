-- Migration: Add Auction Grid Drafting Support
-- This adds support for the auction-grid draft mode where players bid on cards

-- =============================================================================
-- 1. Update mode constraint to allow 'auction-grid'
-- =============================================================================

ALTER TABLE draft_sessions
  DROP CONSTRAINT IF EXISTS draft_sessions_mode_check;

ALTER TABLE draft_sessions
  ADD CONSTRAINT draft_sessions_mode_check
  CHECK (mode IN ('pack', 'open', 'auction-grid'));

-- =============================================================================
-- 2. Add auction-specific columns to draft_sessions
-- =============================================================================

-- Current grid number (1-6, each grid has (n+1)*10 cards)
ALTER TABLE draft_sessions
  ADD COLUMN IF NOT EXISTS current_grid INTEGER NOT NULL DEFAULT 1;

-- Seat position of player currently selecting a card for auction
ALTER TABLE draft_sessions
  ADD COLUMN IF NOT EXISTS current_selector_seat INTEGER;

-- Grid data - stores all cards for each grid
-- Structure: { gridNumber: number, cards: number[], remainingCards: number[], graveyardCards: number[] }[]
ALTER TABLE draft_sessions
  ADD COLUMN IF NOT EXISTS grid_data JSONB;

-- Current auction state
-- Structure: { phase, cardId, currentBid, currentBidderId, bids, passedPlayerIds, nextBidderSeat }
ALTER TABLE draft_sessions
  ADD COLUMN IF NOT EXISTS auction_state JSONB;

-- When the current selection phase started (for 30s timer)
ALTER TABLE draft_sessions
  ADD COLUMN IF NOT EXISTS selection_started_at TIMESTAMPTZ;

-- =============================================================================
-- 3. Add auction-specific columns to draft_players
-- =============================================================================

-- Bidding points remaining (starts at 100, persists across all grids)
ALTER TABLE draft_players
  ADD COLUMN IF NOT EXISTS bidding_points INTEGER NOT NULL DEFAULT 100;

-- Cards acquired in current grid (max 10 per grid, resets each grid)
ALTER TABLE draft_players
  ADD COLUMN IF NOT EXISTS cards_acquired_this_grid INTEGER NOT NULL DEFAULT 0;

-- =============================================================================
-- 4. Create draft_auction_bids table for bid history
-- =============================================================================

CREATE TABLE IF NOT EXISTS draft_auction_bids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES draft_sessions(id) ON DELETE CASCADE,
  grid_number INTEGER NOT NULL,
  card_id INTEGER NOT NULL,
  player_id UUID NOT NULL REFERENCES draft_players(id) ON DELETE CASCADE,
  bid_amount INTEGER NOT NULL,
  is_pass BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Each player can only have one bid/pass action per card per grid
  UNIQUE(session_id, grid_number, card_id, player_id)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_draft_auction_bids_session
  ON draft_auction_bids(session_id);
CREATE INDEX IF NOT EXISTS idx_draft_auction_bids_card
  ON draft_auction_bids(session_id, grid_number, card_id);

-- =============================================================================
-- 5. Row Level Security for draft_auction_bids
-- =============================================================================

ALTER TABLE draft_auction_bids ENABLE ROW LEVEL SECURITY;

-- Everyone can view bids (public information during auction)
DROP POLICY IF EXISTS "Auction bids viewable by everyone" ON draft_auction_bids;
CREATE POLICY "Auction bids viewable by everyone"
  ON draft_auction_bids FOR SELECT
  USING (true);

-- Anyone can place bids (validation done in application layer)
DROP POLICY IF EXISTS "Anyone can place bids" ON draft_auction_bids;
CREATE POLICY "Anyone can place bids"
  ON draft_auction_bids FOR INSERT
  WITH CHECK (true);

-- =============================================================================
-- 6. Enable realtime for auction bids
-- =============================================================================

-- Note: Run this separately if it fails (table might already be in publication)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'draft_auction_bids'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE draft_auction_bids;
  END IF;
END $$;
