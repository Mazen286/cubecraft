/**
 * Arkham Horror LCG specific types
 */

/**
 * Arkham Horror card factions
 */
export type ArkhamFaction =
  | 'guardian'
  | 'seeker'
  | 'rogue'
  | 'mystic'
  | 'survivor'
  | 'neutral'
  | 'mythos';

/**
 * Arkham Horror card types
 */
export type ArkhamCardType =
  | 'investigator'
  | 'asset'
  | 'event'
  | 'skill'
  | 'treachery'
  | 'enemy'
  | 'location'
  | 'story';

/**
 * Slot types for assets
 */
export type ArkhamSlot =
  | 'Hand'
  | 'Hand x2'
  | 'Accessory'
  | 'Body'
  | 'Ally'
  | 'Arcane'
  | 'Arcane x2'
  | 'Tarot';

/**
 * Level restriction for deck options
 */
export interface LevelRestriction {
  min: number;
  max: number;
}

/**
 * Deck building option - defines what cards an investigator can include
 */
export interface DeckOption {
  /** Allowed factions */
  faction?: string[];
  /** Level restrictions */
  level?: LevelRestriction;
  /** Maximum number of cards matching this option */
  limit?: number;
  /** Required card types */
  type?: string[];
  /** Required traits */
  trait?: string[];
  /** Specific card names allowed */
  name?: string[];
  /** Text description of special rules */
  option_select?: { name: string; id: string }[];
  /** Whether this is "not" - cards that don't match */
  not?: boolean;
  /** Deck size modifier */
  deck_size_select?: { name: string; id: string }[];
  /** Base value for deck building */
  base_level?: number;
  /** Permanent cards only */
  permanent?: boolean;
  /** Uses (charges, secrets, etc.) */
  uses?: string[];
  /** Error message for invalid selection */
  error?: string;
  /** Size modifier */
  size?: number;
  /** ID for tracking purposes */
  id?: string;
}

/**
 * Deck requirements (signature cards, weaknesses)
 */
export interface DeckRequirements {
  /** Size of the deck */
  size: number;
  /** Required cards (signature assets) */
  card?: Record<string, Record<string, string>>;
  /** Random basic weakness requirements */
  random?: { target: string; value: string }[];
}

/**
 * Investigator data from ArkhamDB
 */
export interface Investigator {
  code: string;
  name: string;
  real_name?: string;
  subname?: string;
  faction_code: ArkhamFaction;
  faction2_code?: ArkhamFaction;
  faction3_code?: ArkhamFaction;
  health: number;
  sanity: number;
  skill_willpower: number;
  skill_intellect: number;
  skill_combat: number;
  skill_agility: number;
  traits?: string;
  text?: string;
  back_text?: string;
  deck_requirements?: DeckRequirements;
  deck_options?: DeckOption[];
  pack_code: string;
  pack_name?: string;
  position?: number;
  spoiler?: number;
  /** Double-sided card back code */
  back_link?: string;
  /** Parallel investigator front */
  alternate_of_code?: string;
  /** Is a parallel investigator */
  alternate_required_code?: string;
  /** Hidden from normal search */
  hidden?: boolean;
}

/**
 * Arkham Horror card from API
 */
export interface ArkhamCard {
  code: string;
  name: string;
  real_name?: string;
  subname?: string;
  type_code: ArkhamCardType;
  type_name?: string;
  faction_code: ArkhamFaction;
  faction2_code?: ArkhamFaction;
  faction3_code?: ArkhamFaction;
  faction_name?: string;
  pack_code: string;
  pack_name?: string;
  position?: number;

  // Card stats
  cost?: number | null;
  xp?: number;
  skill_willpower?: number;
  skill_intellect?: number;
  skill_combat?: number;
  skill_agility?: number;
  skill_wild?: number;

  // Asset-specific
  slot?: ArkhamSlot;
  health?: number;
  sanity?: number;

  // Text
  traits?: string;
  text?: string;
  flavor?: string;

  // Deck building
  deck_limit?: number;
  subtype_code?: 'weakness' | 'basicweakness';
  restrictions?: {
    investigator?: Record<string, string>;
  };

  // Metadata
  illustrator?: string;
  is_unique?: boolean;
  permanent?: boolean;
  double_sided?: boolean;
  back_link?: string;
  back_text?: string;
  hidden?: boolean;
  spoiler?: number;

  /** Bonded cards (summoned by this card) */
  bonded_to?: string;
  bonded_count?: number;

  /** Encounter set */
  encounter_code?: string;
  encounter_name?: string;
  encounter_position?: number;

  /** Quantity in set */
  quantity?: number;

  /** Taboo info */
  taboo_text_change?: string;
  taboo_xp?: number;

  /** Errata */
  errata_date?: string;

  /** Customizable cards */
  customization_text?: string;
  customization_options?: CustomizationOption[];

  /** Image URL (constructed from code) */
  imagesrc?: string;
  backimagesrc?: string;
}

/**
 * Customization option for customizable cards
 */
export interface CustomizationOption {
  xp: number;
  text?: string;
  position: number;
  choice?: string;
  deck_limit?: number;
  card?: { type: string[] };
  health?: number;
  sanity?: number;
  cost?: number;
  real_slot?: string;
  real_traits?: string;
  text_change?: string;
}

/**
 * Card in an Arkham deck with quantity and customizations
 */
export interface ArkhamDeckCard {
  code: string;
  quantity: number;
  /** Customizations for customizable cards */
  customizations?: string;
  /** Ignore deck building rules (for special cases) */
  ignoreDeckLimit?: boolean;
}

/**
 * Validation error for deck building
 */
export interface ArkhamValidationError {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  cardCode?: string;
}

/**
 * Result of deck validation
 */
export interface ArkhamValidationResult {
  valid: boolean;
  errors: ArkhamValidationError[];
  warnings: ArkhamValidationError[];
  deckSize: number;
  requiredSize: number;
  totalXp: number;
}

/**
 * Arkham deck data for storage
 */
export interface ArkhamDeckData {
  id: string;
  name: string;
  description?: string;
  investigator_code: string;
  investigator_name: string;

  /** XP tracking */
  xp_earned: number;
  xp_spent: number;

  /** Campaign tracking */
  campaign_id?: string;
  version: number;
  previous_version_id?: string;

  /** Card data: code -> quantity */
  slots: Record<string, number>;
  /** Side deck slots */
  sideSlots?: Record<string, number>;
  /** Ignored deck building errors */
  ignoreDeckLimitSlots?: Record<string, number>;

  /** Taboo list ID */
  taboo_id?: number;

  /** Metadata */
  creator_id?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;

  /** Tags for organization */
  tags?: string;
}

/**
 * Deck info for list displays
 */
export interface ArkhamDeckInfo {
  id: string;
  name: string;
  description?: string;
  investigator_code: string;
  investigator_name: string;
  xp_earned: number;
  xp_spent: number;
  version: number;
  previous_version_id?: string;
  card_count: number;
  creator_id?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Card attributes for the Card type
 */
export interface ArkhamCardAttributes {
  code: string;
  faction_code: ArkhamFaction;
  faction2_code?: ArkhamFaction;
  type_code: ArkhamCardType;
  cost?: number | null;
  xp?: number;
  slot?: ArkhamSlot;
  traits?: string;
  skill_willpower?: number;
  skill_intellect?: number;
  skill_combat?: number;
  skill_agility?: number;
  skill_wild?: number;
  health?: number;
  sanity?: number;
  is_unique?: boolean;
  permanent?: boolean;
  deck_limit?: number;
  subtype_code?: 'weakness' | 'basicweakness';
  restrictions?: {
    investigator?: Record<string, string>;
  };
  pack_code?: string;
  bonded_to?: string;
  hidden?: boolean;
  subname?: string;
}

/**
 * Pack/expansion data
 */
export interface ArkhamPack {
  code: string;
  name: string;
  position: number;
  cycle_position: number;
  cycle_code?: string;
  cycle_name?: string;
  date_release?: string;
  size?: number;
}

/**
 * Cycle data
 */
export interface ArkhamCycle {
  code: string;
  name: string;
  position: number;
  size?: number;
}
