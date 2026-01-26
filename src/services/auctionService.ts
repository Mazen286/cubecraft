// Auction Grid Drafting Service
// Handles all auction-specific logic for the auction-grid draft mode

import { getSupabase, generateRoomCode } from '../lib/supabase';
import type {
  DraftSessionRow,
  DraftSessionInsert,
  DraftPlayerRow,
  DraftPlayerInsert,
  DraftPickInsert,
  GridData,
  AuctionStateData,
  AuctionBidData,
  AuctionBidInsert,
} from '../lib/database.types';
import type { DraftSettings } from '../types';
import { shuffleArray } from '../lib/utils';
import { cubeService } from './cubeService';
import { getActiveGameConfig } from '../context/GameContext';
import { getPlayerName } from './draftService';

// =============================================================================
// Constants (defaults)
// =============================================================================

const DEFAULT_BIDDING_POINTS = 100;
const DEFAULT_SELECTION_TIMER_SECONDS = 30;
const DEFAULT_CARDS_PER_PLAYER = 60;
const DEFAULT_CARDS_ACQUIRED_PER_GRID = 10;
const DEFAULT_BURNED_PER_GRID = 10;

// =============================================================================
// Helper Functions
// =============================================================================

function getStoragePrefix(): string {
  try {
    return getActiveGameConfig().storageKeyPrefix;
  } catch {
    return 'yugioh-draft';
  }
}

function getUserId(): string {
  const key = `${getStoragePrefix()}-user-id`;
  let userId = localStorage.getItem(key);
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem(key, userId);
  }
  return userId;
}

/**
 * Calculate the number of grids needed for auction drafting
 * Formula: ceil(cardsPerPlayer / cardsAcquiredPerGrid)
 */
function calculateGridCount(cardsPerPlayer: number, cardsAcquiredPerGrid: number): number {
  return Math.ceil(cardsPerPlayer / cardsAcquiredPerGrid);
}

/**
 * Calculate the number of cards per grid for auction drafting
 * Formula: (playerCount * cardsAcquiredPerGrid) + burnedPerGrid
 */
function calculateCardsPerGrid(playerCount: number, cardsAcquiredPerGrid: number, burnedPerGrid: number): number {
  return (playerCount * cardsAcquiredPerGrid) + burnedPerGrid;
}

/**
 * Calculate total cards needed for auction drafting
 * Formula: cardsPerGrid * gridCount
 */
function calculateTotalCardsNeeded(playerCount: number, cardsPerPlayer: number, cardsAcquiredPerGrid: number, burnedPerGrid: number): number {
  const gridCount = calculateGridCount(cardsPerPlayer, cardsAcquiredPerGrid);
  const cardsPerGrid = calculateCardsPerGrid(playerCount, cardsAcquiredPerGrid, burnedPerGrid);
  return cardsPerGrid * gridCount;
}

/**
 * Get the next seat position in clockwise order
 */
function getNextSeat(currentSeat: number, totalPlayers: number): number {
  return (currentSeat + 1) % totalPlayers;
}

/**
 * Calculate bot bid amount based on card score and remaining points
 */
function calculateBotBid(
  cardScore: number | undefined,
  remainingPoints: number,
  currentBid: number,
  gridNumber: number,
  cardsAcquiredThisGrid: number
): number | null {
  const score = cardScore ?? 50;

  // Base willingness based on card tier
  const baseWillingness = score >= 90 ? 18  // S-tier
    : score >= 75 ? 12                       // A-tier
    : score >= 60 ? 8                        // B-tier
    : score >= 40 ? 4                        // C-tier
    : 2;                                     // Lower tier

  // Adjust based on remaining grids (save more points for later)
  const gridMultiplier = 1 - (gridNumber - 1) * 0.05; // 1.0 to 0.75

  // Increase urgency if we haven't acquired many cards yet
  const urgency = cardsAcquiredThisGrid < 5 ? 1.1 : 1.0;

  // Calculate maximum bid we're willing to make
  const maxBid = Math.floor(baseWillingness * gridMultiplier * urgency);

  // Calculate the minimum bid required
  const minBidRequired = currentBid + 1;

  // Only bid if we can afford it and it's worth it
  if (minBidRequired > maxBid || minBidRequired > remainingPoints) {
    return null; // Pass
  }

  // Add some randomness to bot bids (50% chance to bid higher than minimum)
  if (Math.random() > 0.5 && minBidRequired + 1 <= maxBid && minBidRequired + 1 <= remainingPoints) {
    return minBidRequired + Math.floor(Math.random() * 2); // +0 or +1
  }

  return minBidRequired;
}

// =============================================================================
// Auction Service
// =============================================================================

export const auctionService = {
  /**
   * Create a new auction grid draft session
   */
  async createSession(
    settings: DraftSettings,
    cubeId: string,
    cubeCardIds: number[]
  ): Promise<{ session: DraftSessionRow; player: DraftPlayerRow; roomCode: string }> {
    const supabase = getSupabase();
    const userId = getUserId();
    const roomCode = generateRoomCode();

    // Get settings (shared with pack drafting, plus auction-specific)
    const cardsPerPlayer = settings.cardsPerPlayer || DEFAULT_CARDS_PER_PLAYER;
    const cardsAcquiredPerGrid = settings.packSize || DEFAULT_CARDS_ACQUIRED_PER_GRID; // packSize = cards acquired per grid
    const burnedPerGrid = settings.burnedPerPack ?? DEFAULT_BURNED_PER_GRID; // burnedPerPack = burned per grid
    const biddingPoints = settings.auctionBiddingPoints ?? DEFAULT_BIDDING_POINTS;
    const selectionTimer = settings.timerSeconds || DEFAULT_SELECTION_TIMER_SECONDS;
    const bidTimer = settings.auctionBidTimerSeconds ?? 15;

    // Calculate total players (for solo: 1 human + bots)
    const totalPlayers = settings.playerCount === 1
      ? 1 + settings.botCount
      : settings.playerCount;

    if (!cubeCardIds || cubeCardIds.length === 0) {
      throw new Error('No cube cards provided');
    }

    // Calculate grid layout
    const gridCount = calculateGridCount(cardsPerPlayer, cardsAcquiredPerGrid);
    const cardsPerGrid = calculateCardsPerGrid(totalPlayers, cardsAcquiredPerGrid, burnedPerGrid);
    const totalCardsNeeded = calculateTotalCardsNeeded(totalPlayers, cardsPerPlayer, cardsAcquiredPerGrid, burnedPerGrid);

    if (cubeCardIds.length < totalCardsNeeded) {
      throw new Error(
        `Cube has ${cubeCardIds.length} cards but needs ${totalCardsNeeded} for auction grid draft ` +
        `(${totalPlayers} players × ${gridCount} grids × ${cardsPerGrid} cards/grid)`
      );
    }

    // Shuffle cube and prepare grid data
    const shuffledCards = shuffleArray(cubeCardIds);
    const gridData: GridData[] = [];

    for (let i = 0; i < gridCount; i++) {
      const startIdx = i * cardsPerGrid;
      const gridCards = shuffledCards.slice(startIdx, startIdx + cardsPerGrid);
      gridData.push({
        gridNumber: i + 1,
        cards: gridCards,
        remainingCards: [...gridCards],
        graveyardCards: [],
      });
    }

    // Initial auction state with settings (phase will change when draft starts)
    const initialAuctionState: AuctionStateData = {
      phase: 'selecting', // Will be properly initialized when draft starts
      cardId: null,
      currentBid: 0,
      currentBidderId: null,
      bids: [],
      passedPlayerIds: [],
      nextBidderSeat: null,
      bidTimerSeconds: bidTimer, // Store bid timer setting
    };

    // Create the session
    const sessionData: DraftSessionInsert = {
      room_code: roomCode,
      host_id: userId,
      cube_id: cubeId,
      mode: 'auction-grid',
      player_count: totalPlayers,
      cards_per_player: cardsPerPlayer,
      pack_size: cardsAcquiredPerGrid, // Cards each player acquires per grid
      burned_per_pack: burnedPerGrid, // Cards that go to graveyard per grid
      timer_seconds: selectionTimer,
      status: 'waiting',
      current_pack: 1, // Not used in auction mode
      current_pick: 1, // Not used in auction mode
      direction: 'left',
      // Auction-specific fields
      current_grid: 1,
      current_selector_seat: null, // Will be set when draft starts
      grid_data: gridData,
      auction_state: initialAuctionState,
    };

    const { data: session, error: sessionError } = await supabase
      .from('draft_sessions')
      .insert(sessionData)
      .select()
      .single();

    if (sessionError) throw sessionError;

    // Add host as first player
    const playerData: DraftPlayerInsert = {
      session_id: session.id,
      user_id: userId,
      name: getPlayerName(),
      seat_position: 0,
      is_host: true,
      is_bot: false,
      is_connected: true,
      current_hand: [],
      pick_made: false,
      bidding_points: biddingPoints,
      cards_acquired_this_grid: 0,
    };

    const { data: player, error: playerError } = await supabase
      .from('draft_players')
      .insert(playerData)
      .select()
      .single();

    if (playerError) throw playerError;

    // Create bot players for solo mode
    if (settings.playerCount === 1 && settings.botCount > 0) {
      const gameConfig = getActiveGameConfig();
      const botNames = gameConfig.botNames || [
        'Bot 1', 'Bot 2', 'Bot 3', 'Bot 4', 'Bot 5', 'Bot 6',
        'Bot 7', 'Bot 8', 'Bot 9', 'Bot 10', 'Bot 11', 'Bot 12'
      ];
      const botPlayers: DraftPlayerInsert[] = [];

      for (let i = 0; i < settings.botCount; i++) {
        botPlayers.push({
          session_id: session.id,
          user_id: `bot-${i + 1}`,
          name: botNames[i % botNames.length],
          seat_position: i + 1,
          is_host: false,
          is_bot: true,
          is_connected: true,
          current_hand: [],
          pick_made: false,
          bidding_points: biddingPoints,
          cards_acquired_this_grid: 0,
        });
      }

      const { error: botError } = await supabase
        .from('draft_players')
        .insert(botPlayers);

      if (botError) throw botError;
    }

    return { session, player, roomCode };
  },

  /**
   * Start the auction grid draft
   * Sets the first selector and initializes the first auction
   */
  async startDraft(sessionId: string): Promise<void> {
    const supabase = getSupabase();

    // Get all players sorted by seat
    const { data: players, error: playersError } = await supabase
      .from('draft_players')
      .select()
      .eq('session_id', sessionId)
      .order('seat_position', { ascending: true });

    if (playersError) throw playersError;
    if (!players || players.length === 0) {
      throw new Error('No players in session');
    }

    // First selector is seat 0 (can be randomized later via die roll)
    const firstSelectorSeat = 0;

    // Initialize auction state for selection phase
    const initialAuctionState: AuctionStateData = {
      phase: 'selecting',
      cardId: null,
      currentBid: 0,
      currentBidderId: null,
      bids: [],
      passedPlayerIds: [],
      nextBidderSeat: null,
    };

    // Update session to start draft
    const { error: updateError } = await supabase
      .from('draft_sessions')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
        current_grid: 1,
        current_selector_seat: firstSelectorSeat,
        auction_state: initialAuctionState,
        selection_started_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) throw updateError;
  },

  /**
   * Select a card for auction (called by the current selector)
   */
  async selectCardForAuction(
    sessionId: string,
    playerId: string,
    cardId: number
  ): Promise<void> {
    const supabase = getSupabase();

    // Get current session and player
    const { data: session } = await supabase
      .from('draft_sessions')
      .select()
      .eq('id', sessionId)
      .single();

    const { data: player } = await supabase
      .from('draft_players')
      .select()
      .eq('id', playerId)
      .single();

    if (!session || !player) {
      throw new Error('Session or player not found');
    }

    // Verify this player is the current selector
    if (player.seat_position !== session.current_selector_seat) {
      throw new Error('Not your turn to select a card');
    }

    // Verify card is in the current grid's remaining cards
    const currentGrid = session.grid_data?.find(
      (g: GridData) => g.gridNumber === session.current_grid
    );
    if (!currentGrid || !currentGrid.remainingCards.includes(cardId)) {
      throw new Error('Card is not available for selection');
    }

    // Get all players for the session
    const { data: allPlayers } = await supabase
      .from('draft_players')
      .select()
      .eq('session_id', sessionId)
      .order('seat_position', { ascending: true });

    // Get max cards per grid setting
    const maxCardsPerGrid = session.pack_size || DEFAULT_CARDS_ACQUIRED_PER_GRID;

    // Find next bidder (clockwise from selector, skip players with max cards)
    let nextBidderSeat = getNextSeat(player.seat_position, allPlayers!.length);
    let attempts = 0;
    while (attempts < allPlayers!.length) {
      const nextPlayer = allPlayers?.find(p => p.seat_position === nextBidderSeat);
      const hasMaxCards = nextPlayer && nextPlayer.cards_acquired_this_grid >= maxCardsPerGrid;
      if (nextPlayer && !hasMaxCards) {
        break;
      }
      nextBidderSeat = getNextSeat(nextBidderSeat, allPlayers!.length);
      attempts++;
    }

    // Preserve bid timer setting from existing auction state
    const existingAuctionState = session.auction_state as AuctionStateData | null;
    const bidTimerSeconds = existingAuctionState?.bidTimerSeconds;

    // Initialize bidding phase
    const auctionState: AuctionStateData = {
      phase: 'bidding',
      cardId: cardId,
      currentBid: 0,
      currentBidderId: null,
      bids: [],
      passedPlayerIds: [],
      nextBidderSeat: nextBidderSeat,
      bidTimerSeconds: bidTimerSeconds,
    };

    // Update session with auction state
    const { error: updateError } = await supabase
      .from('draft_sessions')
      .update({
        auction_state: auctionState,
        selection_started_at: null, // Clear selection timer
      })
      .eq('id', sessionId);

    if (updateError) throw updateError;

    // If next bidder is a bot, trigger bot bid
    const nextBidder = allPlayers?.find(p => p.seat_position === nextBidderSeat);
    if (nextBidder?.is_bot) {
      await this.makeBotBid(sessionId, session.current_grid, cardId);
    }
  },

  /**
   * Place a bid on the current auction
   */
  async placeBid(
    sessionId: string,
    playerId: string,
    amount: number
  ): Promise<void> {
    const supabase = getSupabase();

    // Get current session and player
    const { data: session } = await supabase
      .from('draft_sessions')
      .select()
      .eq('id', sessionId)
      .single();

    const { data: player } = await supabase
      .from('draft_players')
      .select()
      .eq('id', playerId)
      .single();

    if (!session || !player) {
      throw new Error('Session or player not found');
    }

    const auctionState = session.auction_state as AuctionStateData | null;
    if (!auctionState || auctionState.phase !== 'bidding') {
      throw new Error('No active bidding phase');
    }

    // Verify it's this player's turn to bid
    if (player.seat_position !== auctionState.nextBidderSeat) {
      throw new Error('Not your turn to bid');
    }

    // Verify player hasn't passed
    if (auctionState.passedPlayerIds.includes(playerId)) {
      throw new Error('You have already passed');
    }

    // Verify bid is higher than current
    if (amount <= auctionState.currentBid) {
      throw new Error('Bid must be higher than current bid');
    }

    // Verify player has enough points
    if (amount > player.bidding_points) {
      throw new Error('Insufficient bidding points');
    }

    // Verify player hasn't reached max cards for this grid
    const maxCardsPerGrid = session.pack_size || DEFAULT_CARDS_ACQUIRED_PER_GRID;
    if (player.cards_acquired_this_grid >= maxCardsPerGrid) {
      throw new Error('You have already acquired the maximum cards for this grid');
    }

    // Record the bid
    const newBid: AuctionBidData = {
      playerId: playerId,
      playerName: player.name,
      seatPosition: player.seat_position,
      amount: amount,
      timestamp: new Date().toISOString(),
    };

    // Get all players
    const { data: allPlayers } = await supabase
      .from('draft_players')
      .select()
      .eq('session_id', sessionId)
      .order('seat_position', { ascending: true });

    // Find next bidder (skip passed players and players with max cards)
    let nextSeat = getNextSeat(player.seat_position, allPlayers!.length);
    let attempts = 0;
    while (attempts < allPlayers!.length) {
      const nextPlayer = allPlayers?.find(p => p.seat_position === nextSeat);
      const hasMaxCards = nextPlayer && nextPlayer.cards_acquired_this_grid >= maxCardsPerGrid;
      if (nextPlayer && !auctionState.passedPlayerIds.includes(nextPlayer.id) && !hasMaxCards) {
        break;
      }
      nextSeat = getNextSeat(nextSeat, allPlayers!.length);
      attempts++;
    }

    // Update auction state
    const updatedAuctionState: AuctionStateData = {
      ...auctionState,
      currentBid: amount,
      currentBidderId: playerId,
      bids: [...auctionState.bids, newBid],
      nextBidderSeat: nextSeat,
    };

    // Check if this player is the only one who hasn't passed and doesn't have max cards (they win)
    const activeBidders = allPlayers!.filter(
      p => !auctionState.passedPlayerIds.includes(p.id) &&
           p.id !== playerId &&
           p.cards_acquired_this_grid < maxCardsPerGrid
    );

    if (activeBidders.length === 0) {
      // Player wins the auction
      await this.resolveAuction(sessionId, playerId, amount);
      return;
    }

    // Update session
    const { error: updateError } = await supabase
      .from('draft_sessions')
      .update({ auction_state: updatedAuctionState })
      .eq('id', sessionId);

    if (updateError) throw updateError;

    // Record bid in audit table
    const bidInsert: AuctionBidInsert = {
      session_id: sessionId,
      grid_number: session.current_grid,
      card_id: auctionState.cardId!,
      player_id: playerId,
      bid_amount: amount,
      is_pass: false,
    };

    await supabase.from('draft_auction_bids').insert(bidInsert);

    // If next bidder is a bot, trigger bot bid
    const nextBidder = allPlayers?.find(p => p.seat_position === nextSeat);
    if (nextBidder?.is_bot) {
      await this.makeBotBid(sessionId, session.current_grid, auctionState.cardId!);
    }
  },

  /**
   * Pass on the current auction
   */
  async passBid(sessionId: string, playerId: string): Promise<void> {
    const supabase = getSupabase();

    // Get current session and player
    const { data: session } = await supabase
      .from('draft_sessions')
      .select()
      .eq('id', sessionId)
      .single();

    const { data: player } = await supabase
      .from('draft_players')
      .select()
      .eq('id', playerId)
      .single();

    if (!session || !player) {
      throw new Error('Session or player not found');
    }

    const auctionState = session.auction_state as AuctionStateData | null;
    if (!auctionState || auctionState.phase !== 'bidding') {
      throw new Error('No active bidding phase');
    }

    // Verify it's this player's turn
    if (player.seat_position !== auctionState.nextBidderSeat) {
      throw new Error('Not your turn to bid/pass');
    }

    // Add player to passed list
    const passedPlayerIds = [...auctionState.passedPlayerIds, playerId];

    // Get all players
    const { data: allPlayers } = await supabase
      .from('draft_players')
      .select()
      .eq('session_id', sessionId)
      .order('seat_position', { ascending: true });

    // Get max cards per grid setting
    const maxCardsPerGrid = session.pack_size || DEFAULT_CARDS_ACQUIRED_PER_GRID;

    // Find active bidders (not passed, not the passer, and doesn't have max cards)
    const activeBidders = allPlayers!.filter(
      p => !passedPlayerIds.includes(p.id) &&
           p.cards_acquired_this_grid < maxCardsPerGrid
    );

    // If only one player remains, they win
    if (activeBidders.length === 1 && auctionState.currentBidderId) {
      // Current high bidder wins
      await this.resolveAuction(
        sessionId,
        auctionState.currentBidderId,
        auctionState.currentBid
      );
      return;
    }

    // If no active bidders remain and there's a high bidder, they win
    if (activeBidders.length === 0 && auctionState.currentBidderId) {
      await this.resolveAuction(
        sessionId,
        auctionState.currentBidderId,
        auctionState.currentBid
      );
      return;
    }

    // If no one bid and everyone passed/maxed out, selector gets the card for free
    if (activeBidders.length === 0 && !auctionState.currentBidderId) {
      // Find the selector (player who chose this card)
      const selector = allPlayers?.find(p => p.seat_position === session.current_selector_seat);
      if (selector) {
        await this.resolveAuction(sessionId, selector.id, 0);
      } else {
        // Fallback: discard to graveyard if selector not found
        await this.discardCardToGraveyard(sessionId, auctionState.cardId!);
      }
      return;
    }

    // Find next bidder (skip passed players and players with max cards)
    let nextSeat = getNextSeat(player.seat_position, allPlayers!.length);
    let attempts = 0;
    while (attempts < allPlayers!.length) {
      const nextPlayer = allPlayers?.find(p => p.seat_position === nextSeat);
      const hasMaxCards = nextPlayer && nextPlayer.cards_acquired_this_grid >= maxCardsPerGrid;
      if (nextPlayer && !passedPlayerIds.includes(nextPlayer.id) && !hasMaxCards) {
        break;
      }
      nextSeat = getNextSeat(nextSeat, allPlayers!.length);
      attempts++;
    }

    // Update auction state
    const updatedAuctionState: AuctionStateData = {
      ...auctionState,
      passedPlayerIds: passedPlayerIds,
      nextBidderSeat: nextSeat,
    };

    const { error: updateError } = await supabase
      .from('draft_sessions')
      .update({ auction_state: updatedAuctionState })
      .eq('id', sessionId);

    if (updateError) throw updateError;

    // Record pass in audit table
    const bidInsert: AuctionBidInsert = {
      session_id: sessionId,
      grid_number: session.current_grid,
      card_id: auctionState.cardId!,
      player_id: playerId,
      bid_amount: 0,
      is_pass: true,
    };

    await supabase.from('draft_auction_bids').insert(bidInsert);

    // If next bidder is a bot, trigger bot bid
    const nextBidder = allPlayers?.find(p => p.seat_position === nextSeat);
    if (nextBidder?.is_bot) {
      await this.makeBotBid(sessionId, session.current_grid, auctionState.cardId!);
    }
  },

  /**
   * Resolve the auction - award card to winner
   */
  async resolveAuction(
    sessionId: string,
    winnerId: string,
    winningBid: number
  ): Promise<void> {
    const supabase = getSupabase();

    // Get session and winner
    const { data: session } = await supabase
      .from('draft_sessions')
      .select()
      .eq('id', sessionId)
      .single();

    const { data: winner } = await supabase
      .from('draft_players')
      .select()
      .eq('id', winnerId)
      .single();

    if (!session || !winner) {
      throw new Error('Session or winner not found');
    }

    const auctionState = session.auction_state as AuctionStateData;
    const cardId = auctionState.cardId!;

    // Deduct points from winner
    const newPoints = winner.bidding_points - winningBid;
    const newCardsAcquired = winner.cards_acquired_this_grid + 1;

    // Update winner's state
    await supabase
      .from('draft_players')
      .update({
        bidding_points: newPoints,
        cards_acquired_this_grid: newCardsAcquired,
      })
      .eq('id', winnerId);

    // Record the pick
    const pickData: DraftPickInsert = {
      session_id: sessionId,
      player_id: winnerId,
      card_id: cardId,
      pack_number: session.current_grid, // Using pack_number for grid_number
      pick_number: 1, // Not really applicable for auction
      pick_time_seconds: 0,
      was_auto_pick: false,
    };

    await supabase.from('draft_picks').insert(pickData);

    // Remove card from remaining cards
    const gridData = [...(session.grid_data as GridData[])];
    const currentGridIdx = gridData.findIndex(g => g.gridNumber === session.current_grid);
    gridData[currentGridIdx] = {
      ...gridData[currentGridIdx],
      remainingCards: gridData[currentGridIdx].remainingCards.filter(id => id !== cardId),
    };

    // Check if grid is complete and advance to next auction
    await this.advanceToNextAuction(sessionId, gridData, session.current_grid);
  },

  /**
   * Discard a card to graveyard (when no one bids)
   */
  async discardCardToGraveyard(sessionId: string, cardId: number): Promise<void> {
    const supabase = getSupabase();

    const { data: session } = await supabase
      .from('draft_sessions')
      .select()
      .eq('id', sessionId)
      .single();

    if (!session) {
      throw new Error('Session not found');
    }

    // Update grid data
    const gridData = [...(session.grid_data as GridData[])];
    const currentGridIdx = gridData.findIndex(g => g.gridNumber === session.current_grid);
    gridData[currentGridIdx] = {
      ...gridData[currentGridIdx],
      remainingCards: gridData[currentGridIdx].remainingCards.filter(id => id !== cardId),
      graveyardCards: [...gridData[currentGridIdx].graveyardCards, cardId],
    };

    // Advance to next auction
    await this.advanceToNextAuction(sessionId, gridData, session.current_grid);
  },

  /**
   * Advance to the next auction or complete the grid/draft
   */
  async advanceToNextAuction(
    sessionId: string,
    gridData: GridData[],
    currentGridNumber: number
  ): Promise<void> {
    const supabase = getSupabase();

    // Get session and players
    const { data: session } = await supabase
      .from('draft_sessions')
      .select()
      .eq('id', sessionId)
      .single();

    const { data: allPlayers } = await supabase
      .from('draft_players')
      .select()
      .eq('session_id', sessionId)
      .order('seat_position', { ascending: true });

    if (!session || !allPlayers) {
      throw new Error('Session or players not found');
    }

    // Derive settings from session (pack_size stores cardsAcquiredPerGrid)
    const cardsAcquiredPerGrid = session.pack_size || DEFAULT_CARDS_ACQUIRED_PER_GRID;
    const totalGrids = gridData.length;

    const currentGrid = gridData.find(g => g.gridNumber === currentGridNumber);

    // Check if all players have max cards this grid
    const allPlayersMaxCards = allPlayers.every(
      p => p.cards_acquired_this_grid >= cardsAcquiredPerGrid
    );

    // Check if no more cards remain
    const noCardsRemain = !currentGrid || currentGrid.remainingCards.length === 0;

    // If grid is complete
    if (allPlayersMaxCards || noCardsRemain) {
      // Move remaining cards to graveyard
      if (currentGrid && currentGrid.remainingCards.length > 0) {
        gridData[currentGridNumber - 1] = {
          ...currentGrid,
          graveyardCards: [...currentGrid.graveyardCards, ...currentGrid.remainingCards],
          remainingCards: [],
        };
      }

      // Check if this was the last grid
      if (currentGridNumber >= totalGrids) {
        // Draft complete!
        await supabase
          .from('draft_sessions')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            grid_data: gridData,
            auction_state: { phase: 'grid-complete' } as AuctionStateData,
          })
          .eq('id', sessionId);
        return;
      }

      // Move to next grid
      const nextGrid = currentGridNumber + 1;

      // Reset cards_acquired_this_grid for all players
      for (const player of allPlayers) {
        await supabase
          .from('draft_players')
          .update({ cards_acquired_this_grid: 0 })
          .eq('id', player.id);
      }

      // Set new selector (rotate from previous grid's first selector)
      const nextSelector = getNextSeat(session.current_selector_seat ?? 0, allPlayers.length);

      // Preserve bid timer setting from existing auction state
      const existingAuctionState = session.auction_state as AuctionStateData | null;
      const bidTimerSeconds = existingAuctionState?.bidTimerSeconds;

      // Initialize new selection phase
      const newAuctionState: AuctionStateData = {
        phase: 'selecting',
        cardId: null,
        currentBid: 0,
        currentBidderId: null,
        bids: [],
        passedPlayerIds: [],
        nextBidderSeat: null,
        bidTimerSeconds: bidTimerSeconds,
      };

      await supabase
        .from('draft_sessions')
        .update({
          current_grid: nextGrid,
          current_selector_seat: nextSelector,
          grid_data: gridData,
          auction_state: newAuctionState,
          selection_started_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      // If selector is a bot, auto-select
      const selectorPlayer = allPlayers.find(p => p.seat_position === nextSelector);
      if (selectorPlayer?.is_bot) {
        await this.autoSelectForBot(sessionId, selectorPlayer.id, nextGrid, gridData);
      }

      return;
    }

    // Continue with current grid - rotate selector
    const nextSelector = getNextSeat(session.current_selector_seat ?? 0, allPlayers.length);

    // Skip players who have max cards
    let actualNextSelector = nextSelector;
    let attempts = 0;
    while (attempts < allPlayers.length) {
      const player = allPlayers.find(p => p.seat_position === actualNextSelector);
      if (player && player.cards_acquired_this_grid < cardsAcquiredPerGrid) {
        break;
      }
      actualNextSelector = getNextSeat(actualNextSelector, allPlayers.length);
      attempts++;
    }

    // Preserve bid timer setting from existing auction state
    const existingAuctionState = session.auction_state as AuctionStateData | null;
    const bidTimerSeconds = existingAuctionState?.bidTimerSeconds;

    // Initialize new selection phase
    const newAuctionState: AuctionStateData = {
      phase: 'selecting',
      cardId: null,
      currentBid: 0,
      currentBidderId: null,
      bids: [],
      passedPlayerIds: [],
      nextBidderSeat: null,
      bidTimerSeconds: bidTimerSeconds,
    };

    await supabase
      .from('draft_sessions')
      .update({
        current_selector_seat: actualNextSelector,
        grid_data: gridData,
        auction_state: newAuctionState,
        selection_started_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    // If selector is a bot, auto-select
    const selectorPlayer = allPlayers.find(p => p.seat_position === actualNextSelector);
    if (selectorPlayer?.is_bot) {
      await this.autoSelectForBot(sessionId, selectorPlayer.id, currentGridNumber, gridData);
    }
  },

  /**
   * Auto-select a card for a bot
   */
  async autoSelectForBot(
    sessionId: string,
    botPlayerId: string,
    gridNumber: number,
    gridData: GridData[]
  ): Promise<void> {
    const currentGrid = gridData.find(g => g.gridNumber === gridNumber);
    if (!currentGrid || currentGrid.remainingCards.length === 0) return;

    // Get session to find cube
    const supabase = getSupabase();
    const { data: session } = await supabase
      .from('draft_sessions')
      .select()
      .eq('id', sessionId)
      .single();

    if (!session) return;

    // Load cards and find highest scored card
    const remainingCards = currentGrid.remainingCards;
    let bestCardId = remainingCards[0];
    let bestScore = 0;

    for (const cardId of remainingCards) {
      const card = cubeService.getCardFromAnyCube(cardId);
      if (card && (card.score ?? 0) > bestScore) {
        bestScore = card.score ?? 0;
        bestCardId = cardId;
      }
    }

    // Select the card with a small delay for UX
    setTimeout(async () => {
      await this.selectCardForAuction(sessionId, botPlayerId, bestCardId);
    }, 1000);
  },

  /**
   * Make a bot bid on the current auction
   */
  async makeBotBid(
    sessionId: string,
    gridNumber: number,
    cardId: number
  ): Promise<void> {
    const supabase = getSupabase();

    // Get session and auction state
    const { data: session } = await supabase
      .from('draft_sessions')
      .select()
      .eq('id', sessionId)
      .single();

    if (!session) return;

    const auctionState = session.auction_state as AuctionStateData | null;
    if (!auctionState || auctionState.phase !== 'bidding') return;

    // Get all players
    const { data: allPlayers } = await supabase
      .from('draft_players')
      .select()
      .eq('session_id', sessionId)
      .order('seat_position', { ascending: true });

    // Find the bot whose turn it is
    const botPlayer = allPlayers?.find(
      p => p.seat_position === auctionState.nextBidderSeat && p.is_bot
    );

    if (!botPlayer) return;

    // Get card info for scoring
    const card = cubeService.getCardFromAnyCube(cardId);
    const cardScore = card?.score;

    // Calculate bot bid
    const bidAmount = calculateBotBid(
      cardScore,
      botPlayer.bidding_points,
      auctionState.currentBid,
      gridNumber,
      botPlayer.cards_acquired_this_grid
    );

    // Add a small delay for UX
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    if (bidAmount !== null) {
      await this.placeBid(sessionId, botPlayer.id, bidAmount);
    } else {
      await this.passBid(sessionId, botPlayer.id);
    }
  },

  /**
   * Get session with players
   */
  async getSession(sessionId: string): Promise<DraftSessionRow | null> {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('draft_sessions')
      .select()
      .eq('id', sessionId)
      .single();
    return data;
  },

  /**
   * Get all players for a session
   */
  async getPlayers(sessionId: string): Promise<DraftPlayerRow[]> {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('draft_players')
      .select()
      .eq('session_id', sessionId)
      .order('seat_position', { ascending: true });
    return data || [];
  },

  /**
   * Get drafted cards for a player
   */
  async getPlayerDraftedCards(sessionId: string, playerId: string): Promise<number[]> {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('draft_picks')
      .select('card_id')
      .eq('session_id', sessionId)
      .eq('player_id', playerId);
    return data?.map(p => p.card_id) || [];
  },

  /**
   * Subscribe to auction session updates
   */
  subscribeToSession(
    sessionId: string,
    onSessionUpdate: (session: DraftSessionRow) => void,
    onPlayersUpdate: (players: DraftPlayerRow[]) => void
  ) {
    const supabase = getSupabase();

    const channel = supabase
      .channel(`auction:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'draft_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.new) {
            onSessionUpdate(payload.new as DraftSessionRow);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'draft_players',
          filter: `session_id=eq.${sessionId}`,
        },
        async () => {
          const players = await this.getPlayers(sessionId);
          onPlayersUpdate(players);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
