-- ArkhamDB OAuth2 Integration
-- Stores OAuth tokens and adds sync fields to arkham_decks table

-- Create table for storing ArkhamDB OAuth tokens
CREATE TABLE IF NOT EXISTS arkhamdb_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  arkhamdb_user_id INTEGER,
  arkhamdb_username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE arkhamdb_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own tokens
CREATE POLICY "Users can manage own arkhamdb tokens"
  ON arkhamdb_tokens
  FOR ALL
  USING (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_arkhamdb_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER arkhamdb_tokens_updated_at
  BEFORE UPDATE ON arkhamdb_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_arkhamdb_tokens_updated_at();

-- Add ArkhamDB sync fields to arkham_decks table
ALTER TABLE arkham_decks ADD COLUMN IF NOT EXISTS arkhamdb_id INTEGER;
ALTER TABLE arkham_decks ADD COLUMN IF NOT EXISTS arkhamdb_decklist_id INTEGER;
ALTER TABLE arkham_decks ADD COLUMN IF NOT EXISTS arkhamdb_url TEXT;
ALTER TABLE arkham_decks ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Index for looking up decks by arkhamdb_id
CREATE INDEX IF NOT EXISTS idx_arkham_decks_arkhamdb_id ON arkham_decks(arkhamdb_id) WHERE arkhamdb_id IS NOT NULL;

-- Comments
COMMENT ON TABLE arkhamdb_tokens IS 'OAuth2 tokens for ArkhamDB integration';
COMMENT ON COLUMN arkhamdb_tokens.arkhamdb_user_id IS 'User ID on ArkhamDB';
COMMENT ON COLUMN arkhamdb_tokens.arkhamdb_username IS 'Username on ArkhamDB';
COMMENT ON COLUMN arkham_decks.arkhamdb_id IS 'Private deck ID on ArkhamDB (for sync)';
COMMENT ON COLUMN arkham_decks.arkhamdb_decklist_id IS 'Published decklist ID on ArkhamDB (for TTS)';
COMMENT ON COLUMN arkham_decks.arkhamdb_url IS 'URL to view deck on ArkhamDB';
COMMENT ON COLUMN arkham_decks.last_synced_at IS 'Timestamp of last sync with ArkhamDB';
