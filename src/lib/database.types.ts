// Database types for Supabase tables
// These match the schema we'll create in Supabase

import type {
  UserProfileRow,
  UserProfileInsert,
  UserProfileUpdate,
  AnonymousMigrationRow,
  AnonymousMigrationInsert,
} from '../types/auth';

export interface Database {
  public: {
    Tables: {
      draft_sessions: {
        Row: DraftSessionRow;
        Insert: DraftSessionInsert;
        Update: DraftSessionUpdate;
      };
      draft_players: {
        Row: DraftPlayerRow;
        Insert: DraftPlayerInsert;
        Update: DraftPlayerUpdate;
      };
      draft_picks: {
        Row: DraftPickRow;
        Insert: DraftPickInsert;
        Update: DraftPickUpdate;
      };
      draft_burned_cards: {
        Row: DraftBurnedCardRow;
        Insert: DraftBurnedCardInsert;
        Update: DraftBurnedCardUpdate;
      };
      cubes: {
        Row: CubeRow;
        Insert: CubeInsert;
        Update: CubeUpdate;
      };
      card_scores: {
        Row: CardScoreRow;
        Insert: CardScoreInsert;
        Update: CardScoreUpdate;
      };
      user_profiles: {
        Row: UserProfileRow;
        Insert: UserProfileInsert;
        Update: UserProfileUpdate;
      };
      anonymous_migrations: {
        Row: AnonymousMigrationRow;
        Insert: AnonymousMigrationInsert;
        Update: never;
      };
    };
  };
}

// Draft Sessions table
export interface DraftSessionRow {
  id: string;
  room_code: string;
  host_id: string;
  cube_id: string;
  mode: 'pack' | 'open' | 'auction-grid';
  player_count: number;
  cards_per_player: number;
  pack_size: number;
  burned_per_pack: number;
  timer_seconds: number;
  status: 'waiting' | 'in_progress' | 'completed' | 'cancelled';
  paused: boolean;
  current_pack: number;
  current_pick: number;
  direction: 'left' | 'right';
  pack_data: PackData[] | null; // JSON - shuffled packs for each player
  pick_started_at: string | null; // Server timestamp when current pick round started
  paused_at: string | null; // When the session was paused
  time_remaining_at_pause: number | null; // Seconds remaining when paused
  resume_at: string | null; // Timestamp when resume countdown ends
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  // Auction Grid specific fields
  current_grid: number; // Current grid number (1-6)
  current_selector_seat: number | null; // Seat of player selecting card for auction
  grid_data: GridData[] | null; // All grids data
  auction_state: AuctionStateData | null; // Current auction state
  selection_started_at: string | null; // When selection phase started
  // Competitive mode
  hide_scores: boolean; // Hide card scores/ratings during draft
}

export interface DraftSessionInsert {
  id?: string;
  room_code: string;
  host_id: string;
  cube_id: string;
  mode: 'pack' | 'open' | 'auction-grid';
  player_count: number;
  cards_per_player: number;
  pack_size: number;
  burned_per_pack?: number;
  timer_seconds: number;
  status?: 'waiting' | 'in_progress' | 'completed' | 'cancelled';
  paused?: boolean;
  current_pack?: number;
  current_pick?: number;
  direction?: 'left' | 'right';
  pack_data?: PackData[] | null;
  pick_started_at?: string | null;
  paused_at?: string | null;
  time_remaining_at_pause?: number | null;
  resume_at?: string | null;
  // Auction Grid specific fields
  current_grid?: number;
  current_selector_seat?: number | null;
  grid_data?: GridData[] | null;
  auction_state?: AuctionStateData | null;
  selection_started_at?: string | null;
  // Competitive mode
  hide_scores?: boolean;
}

export interface DraftSessionUpdate {
  status?: 'waiting' | 'in_progress' | 'completed' | 'cancelled';
  paused?: boolean;
  current_pack?: number;
  current_pick?: number;
  direction?: 'left' | 'right';
  pack_data?: PackData[] | null;
  pick_started_at?: string | null;
  paused_at?: string | null;
  time_remaining_at_pause?: number | null;
  resume_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  // Auction Grid specific fields
  current_grid?: number;
  current_selector_seat?: number | null;
  grid_data?: GridData[] | null;
  auction_state?: AuctionStateData | null;
  selection_started_at?: string | null;
  // Competitive mode
  hide_scores?: boolean;
}

// Draft Players table
export interface DraftPlayerRow {
  id: string;
  session_id: string;
  user_id: string;
  name: string;
  seat_position: number;
  is_host: boolean;
  is_bot: boolean; // AI player
  is_connected: boolean;
  current_hand: number[]; // Card IDs in current hand
  pick_made: boolean; // Has made pick for current round
  created_at: string;
  last_seen_at: string;
  // Auction Grid specific fields
  bidding_points: number; // Remaining bidding points (default 100)
  cards_acquired_this_grid: number; // Cards acquired in current grid (max 10)
}

export interface DraftPlayerInsert {
  id?: string;
  session_id: string;
  user_id: string;
  name: string;
  seat_position: number;
  is_host?: boolean;
  is_bot?: boolean;
  is_connected?: boolean;
  current_hand?: number[];
  pick_made?: boolean;
  // Auction Grid specific fields
  bidding_points?: number;
  cards_acquired_this_grid?: number;
}

export interface DraftPlayerUpdate {
  name?: string;
  is_connected?: boolean;
  current_hand?: number[];
  pick_made?: boolean;
  last_seen_at?: string;
  // Auction Grid specific fields
  bidding_points?: number;
  cards_acquired_this_grid?: number;
}

// Draft Picks table - records all picks made
export interface DraftPickRow {
  id: string;
  session_id: string;
  player_id: string;
  card_id: number;
  pack_number: number;
  pick_number: number;
  pick_time_seconds: number;
  was_auto_pick: boolean;
  created_at: string;
}

export interface DraftPickInsert {
  id?: string;
  session_id: string;
  player_id: string;
  card_id: number;
  pack_number: number;
  pick_number: number;
  pick_time_seconds?: number;
  was_auto_pick?: boolean;
}

export interface DraftPickUpdate {
  // Picks are immutable once made
}

// Draft Burned Cards table - tracks cards discarded after each pack
export interface DraftBurnedCardRow {
  id: string;
  session_id: string;
  card_id: number;
  pack_number: number;
  burned_from_seat: number;
  created_at: string;
}

export interface DraftBurnedCardInsert {
  id?: string;
  session_id: string;
  card_id: number;
  pack_number: number;
  burned_from_seat: number;
}

export interface DraftBurnedCardUpdate {
  // Burned cards are immutable once recorded
}

// Cubes table - user-uploaded cube definitions
export interface CubeRow {
  id: string;
  name: string;
  description: string | null;
  game_id: string;
  creator_id: string | null;
  is_public: boolean;
  card_count: number;
  card_data: Record<string, unknown>; // JSONB - the card map
  created_at: string;
  updated_at: string;
}

export interface CubeInsert {
  id?: string;
  name: string;
  description?: string | null;
  game_id: string;
  creator_id?: string | null;
  is_public?: boolean;
  card_count: number;
  card_data: Record<string, unknown>;
}

export interface CubeUpdate {
  name?: string;
  description?: string | null;
  is_public?: boolean;
  card_count?: number;
  card_data?: Record<string, unknown>;
  updated_at?: string;
}

// Helper types for pack data stored as JSON
export interface PackData {
  player_seat: number;
  pack_number: number; // 1-indexed pack number
  cards: number[]; // Card IDs
}

// =============================================================================
// Auction Grid Types
// =============================================================================

// Grid data stored as JSON in draft_sessions.grid_data
export interface GridData {
  gridNumber: number; // 1-6
  cards: number[]; // All card IDs originally in this grid
  remainingCards: number[]; // Card IDs not yet auctioned
  graveyardCards: number[]; // Card IDs that went to graveyard
}

// Bid data for auction state
export interface AuctionBidData {
  playerId: string;
  playerName: string;
  seatPosition: number;
  amount: number;
  timestamp: string; // ISO timestamp
}

// Auction state stored as JSON in draft_sessions.auction_state
export interface AuctionStateData {
  phase: 'selecting' | 'bidding' | 'resolved' | 'grid-complete';
  cardId: number | null; // Card being auctioned
  currentBid: number; // Current highest bid
  currentBidderId: string | null; // Player with highest bid
  bids: AuctionBidData[]; // All bids placed
  passedPlayerIds: string[]; // Players who have passed
  nextBidderSeat: number | null; // Next player to bid
  bidTimerSeconds?: number; // Seconds per bid turn (default 15)
  totalBiddingPoints?: number; // Total points each player started with (for bot bid scaling)
  bidStartedAt?: string; // ISO timestamp when current bidder's turn started
}

// Draft Auction Bids table
export interface AuctionBidRow {
  id: string;
  session_id: string;
  grid_number: number;
  card_id: number;
  player_id: string;
  bid_amount: number;
  is_pass: boolean;
  created_at: string;
}

export interface AuctionBidInsert {
  id?: string;
  session_id: string;
  grid_number: number;
  card_id: number;
  player_id: string;
  bid_amount: number;
  is_pass?: boolean;
}

// Card Scores table - admin-editable card scores per cube
export interface CardScoreRow {
  id: string;
  cube_id: string;
  card_id: number;
  score: number;
  created_at: string;
  updated_at: string;
}

export interface CardScoreInsert {
  id?: string;
  cube_id: string;
  card_id: number;
  score: number;
  created_at?: string;
  updated_at?: string;
}

export interface CardScoreUpdate {
  score?: number;
  updated_at?: string;
}

// Realtime payload types
export interface RealtimePayload<T> {
  commit_timestamp: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: T | null;
  schema: string;
  table: string;
}
