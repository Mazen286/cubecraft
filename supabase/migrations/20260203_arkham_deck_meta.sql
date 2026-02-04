-- Add meta column for additional deck settings
-- Stores: ignoreDeckSizeSlots, xpDiscountSlots, etc.

ALTER TABLE arkham_decks
ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT NULL;

COMMENT ON COLUMN arkham_decks.meta IS 'Additional deck settings (XP discounts, deck size overrides, etc.)';
