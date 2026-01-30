import type { Card } from '../types/card';

/**
 * Defines a group for pile view (e.g., Level 1 monsters, CMC 2)
 */
export interface PileGroup {
  id: string;
  label: string;
  matches: (card: Card) => boolean;
  order: number;
}

/**
 * Configuration for pile/stacked view of cards
 */
export interface PileViewConfig {
  groups: PileGroup[];
}

/**
 * Defines a zone/section of a deck (e.g., Main Deck, Extra Deck, Sideboard)
 */
export interface DeckZone {
  id: string;
  name: string;
  minCards?: number;
  maxCards?: number;
  /** Function to determine if a card belongs in this zone */
  cardBelongsTo: (card: Card) => boolean;
}

/**
 * Defines how to display a stat or info field on a card
 */
export interface CardStatDisplay {
  label: string;
  getValue: (card: Card) => string;
  color?: string;  // Tailwind color class or hex
}

/**
 * Defines a visual indicator on the card (e.g., Extra Deck dot)
 */
export interface CardIndicator {
  /** Function to determine if this indicator should show */
  show: (card: Card) => boolean;
  /** Color of the indicator */
  color: string;
  /** Tooltip text */
  tooltip?: string;
}

/**
 * Configuration for how cards are displayed
 */
export interface CardDisplay {
  /** Primary stats shown prominently (e.g., ATK/DEF for YGO, P/T for MTG) */
  primaryStats?: CardStatDisplay[];
  /** Secondary info shown below primary (e.g., Level, Mana Cost) */
  secondaryInfo?: CardStatDisplay[];
  /** Visual indicators on the card (e.g., Extra Deck indicator) */
  indicators?: CardIndicator[];
  /** Fields to show in detailed card view/tooltip */
  detailFields?: CardStatDisplay[];
}

/**
 * Defines an export format for decks
 */
export interface ExportFormat {
  id: string;
  name: string;
  extension: string;
  /** Generate the export content from cards */
  generate: (cards: Card[], deckZones: DeckZone[]) => string;
}

/**
 * Theme configuration for a card game
 */
export interface GameTheme {
  /** Primary accent color (hex) */
  primaryColor: string;
  /** Secondary accent color (hex) */
  accentColor: string;
  /** URL to card back image */
  cardBackImage?: string;
  /** URL to game logo */
  logoUrl?: string;
  /** Background gradient or color */
  backgroundColor?: string;
}

/**
 * Card classification functions
 */
export interface CardClassifiers {
  /** Check if card goes in extra/side deck */
  isExtraDeck?: (card: Card) => boolean;
  /** Check if card is a creature/monster type */
  isCreature?: (card: Card) => boolean;
  /** Check if card is a spell/instant/sorcery type */
  isSpell?: (card: Card) => boolean;
  /** Check if card is a trap/enchantment type */
  isTrap?: (card: Card) => boolean;
  /** Check if card is a land type (MTG) */
  isLand?: (card: Card) => boolean;
  /** Check if card is a Pokemon (Pokemon TCG) */
  isPokemon?: (card: Card) => boolean;
  /** Check if card is a Trainer (Pokemon TCG) */
  isTrainer?: (card: Card) => boolean;
  /** Check if card is an Energy (Pokemon TCG) */
  isEnergy?: (card: Card) => boolean;
}

/**
 * Filter option for card filtering UI
 */
export interface FilterOption {
  id: string;
  label: string;
  filter: (card: Card) => boolean;
}

/**
 * Sort option for card sorting UI
 */
export interface SortOption {
  id: string;
  label: string;
  compare: (a: Card, b: Card) => number;
}

/**
 * Filter group type - determines how the filter is rendered
 */
export type FilterGroupType = 'multi-select' | 'single-select' | 'range';

/**
 * Option for multi-select or single-select filter groups
 */
export interface FilterGroupOption {
  id: string;
  label: string;
  /** Short label for compact display (e.g., "W" for "White") */
  shortLabel?: string;
  /** Color for visual representation */
  color?: string;
  filter: (card: Card) => boolean;
}

/**
 * Range filter configuration
 */
export interface RangeFilterConfig {
  min: number;
  max: number;
  step?: number;
  getValue: (card: Card) => number | undefined;
  /** Format the value for display */
  formatValue?: (value: number) => string;
}

/**
 * Advanced filter group for game-specific filtering
 */
export interface FilterGroup {
  id: string;
  label: string;
  type: FilterGroupType;
  /** Options for multi-select or single-select types */
  options?: FilterGroupOption[];
  /** Configuration for range type */
  rangeConfig?: RangeFilterConfig;
}

/**
 * Basic resource card (e.g., Basic Lands in MTG, Basic Energy in Pokemon)
 * These are freely available after drafting and not drafted themselves
 */
export interface BasicResource {
  id: string | number;
  name: string;
  type: string;
  description?: string;
  /** Image URL for this basic resource */
  imageUrl?: string;
  /** Game-specific attributes */
  attributes: Record<string, unknown>;
}

/**
 * Main game configuration interface.
 * Each card game implements this to define its specific behavior.
 */
export interface GameConfig {
  /** Unique identifier for the game */
  id: string;
  /** Full name of the game */
  name: string;
  /** Short name/abbreviation (e.g., "YGO", "MTG", "PTCG") */
  shortName: string;

  /** Visual theme settings */
  theme: GameTheme;

  /** How cards are displayed */
  cardDisplay: CardDisplay;

  /** Deck structure (zones like Main Deck, Extra Deck, etc.) */
  deckZones: DeckZone[];

  /** Default player name for this game */
  defaultPlayerName: string;

  /** Bot names for AI players */
  botNames?: string[];

  /** Available card types for filtering */
  cardTypes: readonly string[];

  /** Available attributes/colors for filtering (optional) */
  cardAttributes?: readonly string[];

  /** Get image URL for a card */
  getCardImageUrl: (card: Card, size: 'sm' | 'md' | 'lg') => string;

  /** Available export formats */
  exportFormats: ExportFormat[];

  /** Card classification functions */
  cardClassifiers: CardClassifiers;

  /** LocalStorage key prefix */
  storageKeyPrefix: string;

  /** Filter options for the card filter UI */
  filterOptions?: FilterOption[];

  /** Advanced filter groups for detailed filtering */
  filterGroups?: FilterGroup[];

  /** Sort options for the card sort UI */
  sortOptions?: SortOption[];

  /**
   * Basic resources that are freely available after drafting (not drafted)
   * e.g., Basic Lands in MTG, Basic Energy in Pokemon
   */
  basicResources?: BasicResource[];

  /**
   * Default draft settings for this game
   * These override the global defaults when a cube of this game is selected
   */
  draftDefaults?: {
    playerCount?: number;
    cardsPerPlayer?: number;
    packSize?: number;
    burnedPerPack?: number;
    timerSeconds?: number;
  };

  /**
   * Configuration for pile/stacked view grouping
   * If defined, enables pile view toggle in card displays
   */
  pileViewConfig?: PileViewConfig;

  /** API configuration (optional, for fetching card data) */
  api?: {
    baseUrl: string;
    searchEndpoint?: string;
    getCardEndpoint?: (cardId: string | number) => string;
  };
}

/**
 * Type guard to check if a value is a valid GameConfig
 */
export function isGameConfig(value: unknown): value is GameConfig {
  if (typeof value !== 'object' || value === null) return false;
  const config = value as Partial<GameConfig>;
  return (
    typeof config.id === 'string' &&
    typeof config.name === 'string' &&
    typeof config.shortName === 'string' &&
    typeof config.theme === 'object' &&
    typeof config.cardDisplay === 'object' &&
    Array.isArray(config.deckZones) &&
    typeof config.defaultPlayerName === 'string' &&
    Array.isArray(config.cardTypes) &&
    typeof config.getCardImageUrl === 'function' &&
    Array.isArray(config.exportFormats) &&
    typeof config.cardClassifiers === 'object' &&
    typeof config.storageKeyPrefix === 'string'
  );
}
