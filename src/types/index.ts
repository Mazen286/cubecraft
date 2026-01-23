// Yu-Gi-Oh! Card Types
export interface YuGiOhCard {
  id: number;
  name: string;
  type: string;
  desc: string;
  atk?: number;
  def?: number;
  level?: number;
  race: string;
  attribute?: string;
  archetype?: string;
  card_images: CardImage[];
  card_prices?: CardPrice[];
}

export interface CardImage {
  id: number;
  image_url: string;
  image_url_small: string;
  image_url_cropped: string;
}

export interface CardPrice {
  cardmarket_price: string;
  tcgplayer_price: string;
  ebay_price: string;
  amazon_price: string;
  coolstuffinc_price: string;
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
export type DraftMode = 'pack' | 'open';
export type DraftStatus = 'waiting' | 'in_progress' | 'completed';

export interface DraftSettings {
  mode: DraftMode;
  playerCount: number;
  cardsPerPlayer: number;
  packSize: number;
  timerSeconds: number;
  isMultiplayer: boolean;
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
  name: string;
  seatPosition: number;
  isHost: boolean;
  isConnected: boolean;
  draftedCards: YuGiOhCard[];
  currentPack: YuGiOhCard[];
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
