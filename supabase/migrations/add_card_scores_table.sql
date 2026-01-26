-- Add card_scores table for admin-editable card scores
-- Run this migration in your Supabase SQL editor

-- Create card_scores table
CREATE TABLE IF NOT EXISTS card_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cube_id TEXT NOT NULL,
  card_id INTEGER NOT NULL,
  score INTEGER NOT NULL DEFAULT 50 CHECK (score >= 0 AND score <= 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Unique constraint for cube_id + card_id combination
  UNIQUE (cube_id, card_id)
);

-- Create index for faster lookups by cube_id
CREATE INDEX IF NOT EXISTS idx_card_scores_cube_id ON card_scores(cube_id);

-- Create index for faster lookups by card_id
CREATE INDEX IF NOT EXISTS idx_card_scores_card_id ON card_scores(card_id);

-- Enable Row Level Security
ALTER TABLE card_scores ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read card scores
DROP POLICY IF EXISTS "Anyone can view card scores" ON card_scores;
CREATE POLICY "Anyone can view card scores" ON card_scores
  FOR SELECT USING (true);

-- Policy: Only admins can insert/update/delete card scores
DROP POLICY IF EXISTS "Admins can manage card scores" ON card_scores;
CREATE POLICY "Admins can manage card scores" ON card_scores
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_card_scores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_card_scores_updated_at ON card_scores;
CREATE TRIGGER update_card_scores_updated_at
  BEFORE UPDATE ON card_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_card_scores_updated_at();

-- Grant permissions
GRANT SELECT ON card_scores TO anon;
GRANT SELECT ON card_scores TO authenticated;
GRANT ALL ON card_scores TO authenticated;
