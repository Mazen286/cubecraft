-- Add unique constraint to prevent duplicate picks per player per round
-- This prevents race conditions from causing a player to pick multiple cards in the same round

-- First, find and delete duplicate picks (keep only the earliest one per player/pack/pick)
-- Using a CTE to identify duplicates
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY session_id, player_id, pack_number, pick_number
           ORDER BY created_at ASC
         ) as rn
  FROM draft_picks
)
DELETE FROM draft_picks
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Add the unique constraint
ALTER TABLE draft_picks
  ADD CONSTRAINT draft_picks_player_round_unique
  UNIQUE (session_id, player_id, pack_number, pick_number);

-- Also add an index to speed up lookups
CREATE INDEX IF NOT EXISTS idx_draft_picks_session_pack_pick
  ON draft_picks(session_id, pack_number, pick_number);
