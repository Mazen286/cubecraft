// Re-export generic card types
export type {
  Card,
  YuGiOhCardAttributes,
  MTGCardAttributes,
  PokemonCardAttributes,
  TypedCard,
  LegacyYuGiOhCard,
} from './card';

export { fromLegacyYuGiOhCard, toLegacyYuGiOhCard, toCardWithAttributes } from './card';

// Yu-Gi-Oh! Card Types - essential fields for drafting
// NOTE: This interface is kept for backward compatibility.
// New code should use the generic Card type with YuGiOhCardAttributes.
export interface YuGiOhCard {
  id: number;
  name: string;
  type: string;
  desc: string;
  atk?: number;
  def?: number;
  level?: number;
  attribute?: string;
  race?: string; // Monster type (Spellcaster, Dragon, etc.)
  linkval?: number; // Link rating for Link monsters
  archetype?: string;
  score?: number; // 0-100 rating for AI drafting
  // Generic attributes for non-YuGiOh games (MTG scryfallId, Pokemon setId, etc.)
  attributes?: Record<string, unknown>;
  // Image URL for non-YuGiOh games (stored directly from API)
  imageUrl?: string;
}

// Helper functions to get card image URLs (from local public/images folder)
export function getCardImageUrl(cardId: number): string {
  return `/images/cards/${cardId}.jpg`;
}

export function getCardImageUrlSmall(cardId: number): string {
  return `/images/cards_small/${cardId}.jpg`;
}

// Cube Types
export interface Cube {
  id: string;
  name: string;
  description?: string;
  cards: YuGiOhCard[];
  mainDeckCount: number;
  extraDeckCount: number;
  createdAt: string;
  updatedAt: string;
}

// Draft Types
export type DraftMode = 'pack' | 'open' | 'auction-grid';
export type DraftStatus = 'waiting' | 'in_progress' | 'completed' | 'cancelled';

// =============================================================================
// Auction Grid Types
// =============================================================================

/**
 * A single bid placed during an auction
 */
export interface AuctionBid {
  playerId: string;
  playerName: string;
  seatPosition: number;
  amount: number;
  timestamp: string; // ISO timestamp
}

/**
 * Current state of an auction for a single card
 */
export interface AuctionState {
  /** Current phase of the auction */
  phase: 'selecting' | 'bidding' | 'resolved' | 'grid-complete';
  /** Card ID being auctioned (null during selection phase) */
  cardId: number | null;
  /** Current highest bid amount */
  currentBid: number;
  /** Player ID with the current highest bid */
  currentBidderId: string | null;
  /** All bids placed for this card */
  bids: AuctionBid[];
  /** Player IDs who have passed (cannot bid again) */
  passedPlayerIds: string[];
  /** Seat position of next player to bid (for clockwise rotation) */
  nextBidderSeat: number | null;
}

/**
 * Data for a single grid in auction grid drafting
 */
export interface GridData {
  /** Grid number (1-6) */
  gridNumber: number;
  /** All card IDs originally in this grid */
  cards: number[];
  /** Card IDs not yet auctioned */
  remainingCards: number[];
  /** Card IDs that went to graveyard */
  graveyardCards: number[];
}

export interface DraftSettings {
  mode: DraftMode;
  playerCount: number;
  botCount: number; // Number of AI players (0 for multiplayer, 0-11 for solo)
  cardsPerPlayer: number; // Total cards each player drafts (used by both modes)
  packSize: number; // Pack: cards per pack. Auction: cards each player acquires per grid
  burnedPerPack: number; // Cards discarded per pack/grid (not selected, go to graveyard)
  timerSeconds: number;
  // Auction Grid specific settings
  auctionBiddingPoints?: number; // Starting bidding points (default 100)
  auctionBidTimerSeconds?: number; // Seconds per bid turn (default 15)
}

export interface DraftSession {
  id: string;
  roomCode: string;
  hostId: string;
  cubeId: string;
  settings: DraftSettings;
  status: DraftStatus;
  currentPack: number;
  currentPick: number;
  direction: 'left' | 'right';
  createdAt: string;
}

export interface DraftPlayer {
  id: string;
  sessionId: string;
  userId: string;
  name: string;
  seatPosition: number;
  isHost: boolean;
  isConnected: boolean;
  isBot: boolean;
  draftedCards: YuGiOhCard[];
  currentPack: YuGiOhCard[];
}

/**
 * Extended player interface for auction grid drafting
 */
export interface AuctionDraftPlayer extends DraftPlayer {
  /** Remaining bidding points (starts at 100) */
  biddingPoints: number;
  /** Cards acquired in current grid (max 10 per grid) */
  cardsAcquiredThisGrid: number;
}

/**
 * Auction grid session extends base session with auction-specific fields
 */
export interface AuctionDraftSession extends DraftSession {
  /** Current grid number (1-6) */
  currentGrid: number;
  /** Seat position of player currently selecting a card */
  currentSelectorSeat: number | null;
  /** All grids data */
  grids: GridData[];
  /** Current auction state */
  auctionState: AuctionState | null;
  /** When the selection phase started */
  selectionStartedAt: string | null;
}

export interface Pack {
  id: string;
  sessionId: string;
  packNumber: number;
  cards: YuGiOhCard[];
  currentHolder: string; // player id
}

// UI State Types
export interface CardFilter {
  search: string;
  type: string | null;
  attribute: string | null;
  level: number | null;
  race: string | null;
}

export type SortOption = 'name' | 'level' | 'atk' | 'def' | 'type';
export type SortDirection = 'asc' | 'desc';

// Draft Statistics Types
export interface PickRecord {
  cardId: number;
  cardName: string;
  cardType: string;
  cardLevel?: number; // Level/Rank for monsters
  cardScore?: number;
  packNumber: number;
  pickNumber: number; // Position in pack (1 = first pick, higher = wheeled)
  pickTime: number; // Time taken in seconds
  timestamp: number; // Unix timestamp
  wasAutoPick: boolean;
}

export interface DraftStatistics {
  sessionId: string;
  picks: PickRecord[];
  totalPickTime: number; // Total time spent picking (seconds)
  startTime: number;
  endTime?: number;
}

// API Response Types
export interface YGOProDeckResponse {
  data: YuGiOhCard[];
}

// Card type constants
export const CARD_TYPES = [
  'Normal Monster',
  'Effect Monster',
  'Ritual Monster',
  'Fusion Monster',
  'Synchro Monster',
  'XYZ Monster',
  'Pendulum Monster',
  'Link Monster',
  'Spell Card',
  'Trap Card',
] as const;

export const ATTRIBUTES = [
  'DARK',
  'DIVINE',
  'EARTH',
  'FIRE',
  'LIGHT',
  'WATER',
  'WIND',
] as const;

export const MONSTER_TYPES = [
  'Aqua',
  'Beast',
  'Beast-Warrior',
  'Cyberse',
  'Dinosaur',
  'Divine-Beast',
  'Dragon',
  'Fairy',
  'Fiend',
  'Fish',
  'Insect',
  'Machine',
  'Plant',
  'Psychic',
  'Pyro',
  'Reptile',
  'Rock',
  'Sea Serpent',
  'Spellcaster',
  'Thunder',
  'Warrior',
  'Winged Beast',
  'Wyrm',
  'Zombie',
] as const;
