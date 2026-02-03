-- Arkham Horror LCG Decks Table
-- Stores deck data with XP tracking and campaign progression support

CREATE TABLE IF NOT EXISTS arkham_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Investigator info
  investigator_code VARCHAR(10) NOT NULL,
  investigator_name VARCHAR(100) NOT NULL,

  -- Campaign and XP tracking
  campaign_id UUID,
  xp_earned INTEGER DEFAULT 0,
  xp_spent INTEGER DEFAULT 0,

  -- Version tracking for deck upgrades
  version INTEGER DEFAULT 1,
  previous_version_id UUID REFERENCES arkham_decks(id) ON DELETE SET NULL,

  -- Card data stored as JSONB (code -> quantity)
  card_data JSONB NOT NULL DEFAULT '{}',
  side_slots JSONB DEFAULT NULL,

  -- Optional taboo list
  taboo_id INTEGER,

  -- Card count (computed from card_data but stored for quick queries)
  card_count INTEGER DEFAULT 0,

  -- Ownership and visibility
  creator_id TEXT,
  is_public BOOLEAN DEFAULT FALSE,

  -- Organization
  tags TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_arkham_decks_creator ON arkham_decks(creator_id);
CREATE INDEX IF NOT EXISTS idx_arkham_decks_investigator ON arkham_decks(investigator_code);
CREATE INDEX IF NOT EXISTS idx_arkham_decks_campaign ON arkham_decks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_arkham_decks_public ON arkham_decks(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_arkham_decks_updated ON arkham_decks(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE arkham_decks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own decks
CREATE POLICY "Users can read own arkham decks"
  ON arkham_decks
  FOR SELECT
  USING (creator_id = auth.uid()::text);

-- Policy: Anyone can read public decks
CREATE POLICY "Anyone can read public arkham decks"
  ON arkham_decks
  FOR SELECT
  USING (is_public = TRUE);

-- Policy: Users can insert their own decks
CREATE POLICY "Users can insert own arkham decks"
  ON arkham_decks
  FOR INSERT
  WITH CHECK (creator_id = auth.uid()::text);

-- Policy: Users can update their own decks
CREATE POLICY "Users can update own arkham decks"
  ON arkham_decks
  FOR UPDATE
  USING (creator_id = auth.uid()::text);

-- Policy: Users can delete their own decks
CREATE POLICY "Users can delete own arkham decks"
  ON arkham_decks
  FOR DELETE
  USING (creator_id = auth.uid()::text);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_arkham_decks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER arkham_decks_updated_at
  BEFORE UPDATE ON arkham_decks
  FOR EACH ROW
  EXECUTE FUNCTION update_arkham_decks_updated_at();

-- Comment on table
COMMENT ON TABLE arkham_decks IS 'Arkham Horror LCG deck storage with XP tracking and campaign progression';
COMMENT ON COLUMN arkham_decks.card_data IS 'JSONB object mapping card codes to quantities';
COMMENT ON COLUMN arkham_decks.side_slots IS 'Optional side deck for card upgrades during campaigns';
COMMENT ON COLUMN arkham_decks.previous_version_id IS 'Links to previous version of this deck for campaign progression';
