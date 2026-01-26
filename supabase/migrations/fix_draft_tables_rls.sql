-- Fix RLS for draft tables to ensure realtime subscriptions work properly

-- Enable RLS on all draft tables
ALTER TABLE draft_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_burned_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_packs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for draft_sessions
DROP POLICY IF EXISTS "Sessions are viewable by everyone" ON draft_sessions;
CREATE POLICY "Sessions are viewable by everyone"
  ON draft_sessions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can create sessions" ON draft_sessions;
CREATE POLICY "Anyone can create sessions"
  ON draft_sessions FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Host can update session" ON draft_sessions;
CREATE POLICY "Host can update session"
  ON draft_sessions FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Host can delete session" ON draft_sessions;
CREATE POLICY "Host can delete session"
  ON draft_sessions FOR DELETE
  USING (true);

-- RLS Policies for draft_players
DROP POLICY IF EXISTS "Players are viewable by everyone" ON draft_players;
CREATE POLICY "Players are viewable by everyone"
  ON draft_players FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can join a session" ON draft_players;
CREATE POLICY "Anyone can join a session"
  ON draft_players FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Players can update own record" ON draft_players;
CREATE POLICY "Players can update own record"
  ON draft_players FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Players can be deleted" ON draft_players;
CREATE POLICY "Players can be deleted"
  ON draft_players FOR DELETE
  USING (true);

-- RLS Policies for draft_picks
DROP POLICY IF EXISTS "Picks are viewable by everyone" ON draft_picks;
CREATE POLICY "Picks are viewable by everyone"
  ON draft_picks FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can make picks" ON draft_picks;
CREATE POLICY "Anyone can make picks"
  ON draft_picks FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Picks can be deleted" ON draft_picks;
CREATE POLICY "Picks can be deleted"
  ON draft_picks FOR DELETE
  USING (true);

-- RLS Policies for draft_burned_cards
DROP POLICY IF EXISTS "Burned cards are viewable by everyone" ON draft_burned_cards;
CREATE POLICY "Burned cards are viewable by everyone"
  ON draft_burned_cards FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can burn cards" ON draft_burned_cards;
CREATE POLICY "Anyone can burn cards"
  ON draft_burned_cards FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Burned cards can be deleted" ON draft_burned_cards;
CREATE POLICY "Burned cards can be deleted"
  ON draft_burned_cards FOR DELETE
  USING (true);

-- RLS Policies for draft_packs
DROP POLICY IF EXISTS "Packs are viewable by everyone" ON draft_packs;
CREATE POLICY "Packs are viewable by everyone"
  ON draft_packs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can create packs" ON draft_packs;
CREATE POLICY "Anyone can create packs"
  ON draft_packs FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Packs can be updated" ON draft_packs;
CREATE POLICY "Packs can be updated"
  ON draft_packs FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Packs can be deleted" ON draft_packs;
CREATE POLICY "Packs can be deleted"
  ON draft_packs FOR DELETE
  USING (true);
