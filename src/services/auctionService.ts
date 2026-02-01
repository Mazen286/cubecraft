// Grid-based Drafting Service
// Handles all grid-specific logic for auction-grid and open draft modes

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
import type { DraftSettings, YuGiOhCard } from '../types';
import { shuffleArray } from '../lib/utils';
import { cubeService } from './cubeService';
import { getPlayerName } from './draftService';
import { getUserId } from './utils';
import { getActiveGameConfig } from '../context/GameContext';

// =============================================================================
// Constants (defaults)
// =============================================================================

const DEFAULT_BIDDING_POINTS = 100;
const DEFAULT_BID_TIMER_SECONDS = 20;
const DEFAULT_SELECTION_TIMER_SECONDS = 30;
const DEFAULT_CARDS_PER_PLAYER = 60;
const DEFAULT_CARDS_ACQUIRED_PER_GRID = 5;
const DEFAULT_BURNED_PER_GRID = 5;

// =============================================================================
// Helper Functions
// =============================================================================

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
 * Get bidding direction for a grid
 * Odd grids (1, 3, 5...): clockwise
 * Even grids (2, 4, 6...): counter-clockwise
 */
function getBiddingDirection(gridNumber: number): 'cw' | 'ccw' {
  return gridNumber % 2 === 1 ? 'cw' : 'ccw';
}

/**
 * Get the next seat position based on direction
 * @param direction 'cw' for clockwise, 'ccw' for counter-clockwise
 */
function getNextSeat(currentSeat: number, totalPlayers: number, direction: 'cw' | 'ccw' = 'cw'): number {
  if (direction === 'cw') {
    return (currentSeat + 1) % totalPlayers;
  } else {
    return (currentSeat - 1 + totalPlayers) % totalPlayers;
  }
}

/**
 * Analyze a bot's drafted cards for strategic decision making
 */
interface BotCollectionAnalysis {
  // Yu-Gi-Oh specific
  archetypes: Map<string, number>; // archetype -> count
  topArchetype: string | null;
  monsterCount: number;
  spellCount: number;
  trapCount: number;
  totalCards: number;
  monsterRatio: number;
  spellRatio: number;
  trapRatio: number;
  // MTG specific - color tracking
  mtgColors: Map<string, number>; // color (W/U/B/R/G) -> count of cards with that color
  mtgCommittedColors: string[]; // The 1-2 colors the bot is "locked into" (empty if not committed yet)
  mtgColorlessCount: number; // Artifacts and colorless cards
  mtgCreatureCount: number;
  mtgNonCreatureCount: number;
}

function analyzeBotCollection(draftedCards: YuGiOhCard[]): BotCollectionAnalysis {
  const archetypes = new Map<string, number>();
  let monsterCount = 0;
  let spellCount = 0;
  let trapCount = 0;

  // MTG color tracking
  const mtgColors = new Map<string, number>();
  let mtgColorlessCount = 0;
  let mtgCreatureCount = 0;
  let mtgNonCreatureCount = 0;

  for (const card of draftedCards) {
    // Count card types (Yu-Gi-Oh)
    const type = card.type.toLowerCase();
    if (type.includes('spell')) {
      spellCount++;
    } else if (type.includes('trap')) {
      trapCount++;
    } else {
      monsterCount++;
    }

    // Track archetypes (Yu-Gi-Oh)
    if (card.archetype) {
      archetypes.set(card.archetype, (archetypes.get(card.archetype) || 0) + 1);
    }

    // MTG color tracking - check card.attributes for colors
    const attrs = card.attributes as Record<string, unknown> | undefined;
    if (attrs) {
      const colors = attrs.colors as string[] | undefined;
      if (colors && colors.length > 0) {
        // Card has colors - count each color
        for (const color of colors) {
          mtgColors.set(color, (mtgColors.get(color) || 0) + 1);
        }
      } else {
        // Colorless card (artifact, land, etc.)
        mtgColorlessCount++;
      }

      // MTG creature vs non-creature tracking
      if (type.includes('creature')) {
        mtgCreatureCount++;
      } else if (type.includes('instant') || type.includes('sorcery') ||
                 type.includes('enchantment') || type.includes('artifact') ||
                 type.includes('planeswalker')) {
        mtgNonCreatureCount++;
      }
    }
  }

  const totalCards = draftedCards.length;

  // Find top archetype (Yu-Gi-Oh)
  let topArchetype: string | null = null;
  let topCount = 0;
  for (const [archetype, count] of archetypes) {
    if (count > topCount && count >= 2) { // Only consider if we have 2+ cards
      topCount = count;
      topArchetype = archetype;
    }
  }

  // Determine MTG committed colors
  // After drafting 4+ colored cards, commit to the top 1-2 colors
  const mtgCommittedColors: string[] = [];
  const coloredCardCount = totalCards - mtgColorlessCount;

  if (coloredCardCount >= 4) {
    // Sort colors by count (descending)
    const sortedColors = Array.from(mtgColors.entries())
      .sort((a, b) => b[1] - a[1]);

    if (sortedColors.length > 0) {
      // Always commit to primary color if we have 3+ cards
      if (sortedColors[0][1] >= 3) {
        mtgCommittedColors.push(sortedColors[0][0]);

        // Consider second color if we have 2+ cards AND it's close to primary
        if (sortedColors.length > 1 && sortedColors[1][1] >= 2) {
          // Only add second color if it's at least 40% as prevalent as primary
          if (sortedColors[1][1] >= sortedColors[0][1] * 0.4) {
            mtgCommittedColors.push(sortedColors[1][0]);
          }
        }
      }
    }
  }

  return {
    archetypes,
    topArchetype,
    monsterCount,
    spellCount,
    trapCount,
    totalCards,
    monsterRatio: totalCards > 0 ? monsterCount / totalCards : 0,
    spellRatio: totalCards > 0 ? spellCount / totalCards : 0,
    trapRatio: totalCards > 0 ? trapCount / totalCards : 0,
    // MTG specific
    mtgColors,
    mtgCommittedColors,
    mtgColorlessCount,
    mtgCreatureCount,
    mtgNonCreatureCount,
  };
}

/**
 * Calculate bot interest modifiers based on synergy and balance
 */
interface BotInterestResult {
  interested: boolean;
  interestMultiplier: number;
  isBluff: boolean;
  reason: string;
}

function calculateBotInterest(
  card: YuGiOhCard,
  collection: BotCollectionAnalysis,
  score: number
): BotInterestResult {
  let interestMultiplier = 1.0;
  let reason = 'base interest';

  // === TIER-BASED INTEREST ===
  // Lower tier cards have a chance to be ignored entirely
  const tierInterestChance = score >= 95 ? 1.0    // S-tier: always interested
    : score >= 90 ? 0.95   // A-tier: 95% interested
    : score >= 75 ? 0.80   // B-tier: 80% interested
    : score >= 60 ? 0.55   // C-tier: 55% interested
    : score >= 50 ? 0.30   // E-tier: 30% interested
    : 0.15;                // F-tier: 15% interested

  // Random check for low-tier disinterest
  if (Math.random() > tierInterestChance) {
    return { interested: false, interestMultiplier: 0, isBluff: false, reason: 'not interested in low tier' };
  }

  // === ARCHETYPE SYNERGY ===
  if (card.archetype && collection.topArchetype) {
    if (card.archetype === collection.topArchetype) {
      // Card matches our archetype - very interested!
      interestMultiplier *= 1.5;
      reason = `synergy with ${collection.topArchetype}`;
    } else if (collection.archetypes.has(card.archetype)) {
      // We have some cards of this archetype
      const count = collection.archetypes.get(card.archetype)!;
      if (count >= 2) {
        interestMultiplier *= 1.3;
        reason = `building ${card.archetype}`;
      }
    }
  } else if (card.archetype && collection.totalCards >= 5) {
    // New archetype when we already have cards - slightly less interested
    interestMultiplier *= 0.85;
    reason = 'new archetype';
  }

  // === CARD TYPE BALANCE ===
  const cardType = card.type.toLowerCase();
  const isSpell = cardType.includes('spell');
  const isTrap = cardType.includes('trap');
  const isMonster = !isSpell && !isTrap;

  // Target ratios: ~55% monsters, ~30% spells, ~15% traps
  if (collection.totalCards >= 5) {
    if (isSpell && collection.spellRatio < 0.25) {
      // Need more spells
      interestMultiplier *= 1.3;
      reason = 'needs spells';
    } else if (isTrap && collection.trapRatio < 0.10) {
      // Need more traps
      interestMultiplier *= 1.2;
      reason = 'needs traps';
    } else if (isMonster && collection.monsterRatio > 0.70) {
      // Too many monsters, less interested in more
      interestMultiplier *= 0.7;
      reason = 'too many monsters';
    } else if (isSpell && collection.spellRatio > 0.40) {
      // Too many spells
      interestMultiplier *= 0.8;
      reason = 'enough spells';
    }
  }

  // === MTG COLOR COMPATIBILITY ===
  const attrs = card.attributes as Record<string, unknown> | undefined;
  const cardColors = attrs?.colors as string[] | undefined;
  const isColorless = !cardColors || cardColors.length === 0;

  // If we have committed colors (MTG), check color compatibility
  if (collection.mtgCommittedColors.length > 0 && !isColorless) {
    // Check if card's colors overlap with our committed colors
    const onColor = cardColors!.some(c => collection.mtgCommittedColors.includes(c));

    if (onColor) {
      // Card matches our colors - boost interest
      interestMultiplier *= 1.4;
      reason = `on-color (${collection.mtgCommittedColors.join('/')})`;
    } else {
      // Off-color card - heavily penalize unless it's a bomb (S-tier)
      if (score >= 95) {
        // Bombs are worth considering for hate-drafting
        const hateDraftChance = 0.25; // 25% chance to hate-draft a bomb
        if (Math.random() < hateDraftChance) {
          interestMultiplier *= 0.7; // Still interested but won't overpay
          reason = 'hate-drafting bomb';
        } else {
          // Pass on off-color bomb
          return { interested: false, interestMultiplier: 0, isBluff: false, reason: 'off-color bomb, not hate-drafting' };
        }
      } else {
        // Regular off-color card - almost never want it
        return { interested: false, interestMultiplier: 0, isBluff: false, reason: `off-color (need ${collection.mtgCommittedColors.join('/')})` };
      }
    }
  } else if (collection.mtgCommittedColors.length === 0 && !isColorless && collection.totalCards >= 2) {
    // Not committed yet but have some cards - prefer cards that match existing colors
    if (cardColors && cardColors.length > 0) {
      const matchesExisting = cardColors.some(c => collection.mtgColors.has(c));
      if (matchesExisting) {
        // Matches a color we've already started
        interestMultiplier *= 1.2;
        reason = 'builds toward color commitment';
      }
    }
  }

  // Colorless cards (artifacts, lands) are always fair game
  if (isColorless && attrs) {
    // Slight bonus for colorless flexibility
    interestMultiplier *= 1.1;
    if (reason === 'base interest') {
      reason = 'colorless - flexible pick';
    }
  }

  // === MTG CREATURE/SPELL BALANCE ===
  const isMtgCreature = cardType.includes('creature');
  const isMtgNonCreature = cardType.includes('instant') || cardType.includes('sorcery') ||
                           cardType.includes('enchantment') || cardType.includes('planeswalker');

  if (collection.totalCards >= 8 && attrs) {
    const creatureRatio = collection.mtgCreatureCount / collection.totalCards;

    // Target: ~60% creatures, ~40% non-creatures for most decks
    if (isMtgCreature && creatureRatio > 0.70) {
      // Too creature-heavy
      interestMultiplier *= 0.8;
      reason = 'enough creatures';
    } else if (isMtgNonCreature && creatureRatio < 0.45) {
      // Need more creatures
      interestMultiplier *= 0.85;
      reason = 'needs creatures';
    }
  }

  // === BLUFFING ===
  // Small chance to bid on cards we don't really want to drain opponent resources
  // Only bluff on mid-tier cards (not trash, not bombs)
  const isBluffCandidate = score >= 50 && score < 85;
  const bluffChance = 0.08; // 8% chance to bluff

  if (isBluffCandidate && Math.random() < bluffChance) {
    return {
      interested: true,
      interestMultiplier: 0.5, // Won't bid too high on a bluff
      isBluff: true,
      reason: 'bluffing',
    };
  }

  return { interested: true, interestMultiplier, isBluff: false, reason };
}

/**
 * Calculate bot bid amount with intelligent decision making
 * Considers: card tier, archetype synergy, card type balance, bluffing
 */
function calculateBotBid(
  card: YuGiOhCard | null,
  remainingPoints: number,
  currentBid: number,
  gridNumber: number,
  cardsAcquiredThisGrid: number,
  totalPoints: number,
  draftedCards: YuGiOhCard[]
): number | null {
  if (!card) return null;

  const score = card.score ?? 50;

  // Analyze bot's collection
  const collection = analyzeBotCollection(draftedCards);

  // Determine interest level
  const interest = calculateBotInterest(card, collection, score);

  if (!interest.interested) {
    return null; // Pass - not interested
  }

  // Base willingness as percentage of total points, based on tier
  // Keep these low so bots don't run out of points halfway through
  const basePercentage = score >= 95 ? 0.08  // S-tier (was 0.18)
    : score >= 90 ? 0.06                      // A-tier (was 0.14)
    : score >= 75 ? 0.04                      // B-tier (was 0.10)
    : score >= 60 ? 0.025                     // C-tier (was 0.06)
    : score >= 50 ? 0.015                     // E-tier (was 0.03)
    : 0.01;                                   // F-tier (was 0.02)

  // Calculate base willingness scaled by total points and interest
  const baseWillingness = Math.floor(totalPoints * basePercentage * interest.interestMultiplier);

  // Adjust based on remaining grids (save more points for later)
  // More aggressive decay: 1.0 down to 0.55 by grid 10
  const gridMultiplier = 1 - (gridNumber - 1) * 0.05;

  // Only increase urgency if we have very few cards
  const urgency = cardsAcquiredThisGrid < 2 ? 1.15 : 1.0;

  // Calculate maximum bid we're willing to make
  let maxBid = Math.floor(baseWillingness * gridMultiplier * urgency);

  // Bluffs have a hard cap to avoid wasting too many points
  if (interest.isBluff) {
    maxBid = Math.min(maxBid, Math.floor(totalPoints * 0.02)); // Max 2% of total on bluffs
  }

  // Calculate the minimum bid required
  const minBidRequired = currentBid + 1;

  // Only bid if we can afford it and it's worth it
  if (minBidRequired > maxBid || minBidRequired > remainingPoints) {
    return null; // Pass
  }

  // Add some randomness to bot bids
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
   * Create a new grid draft session (auction-grid or open)
   */
  async createSession(
    settings: DraftSettings,
    cubeId: string,
    cubeCardIds: number[]
  ): Promise<{ session: DraftSessionRow; player: DraftPlayerRow; roomCode: string }> {
    const supabase = getSupabase();
    const userId = getUserId();
    const roomCode = generateRoomCode();

    // Determine mode (auction-grid or open)
    const mode = settings.mode === 'open' ? 'open' : 'auction-grid';
    const isOpenMode = mode === 'open';

    // Get settings (shared with pack drafting, plus auction-specific)
    const cardsPerPlayer = settings.cardsPerPlayer || DEFAULT_CARDS_PER_PLAYER;
    const cardsAcquiredPerGrid = settings.packSize || DEFAULT_CARDS_ACQUIRED_PER_GRID; // packSize = cards acquired per grid
    const burnedPerGrid = settings.burnedPerPack ?? DEFAULT_BURNED_PER_GRID; // burnedPerPack = burned per grid
    const biddingPoints = isOpenMode ? 0 : (settings.auctionBiddingPoints ?? DEFAULT_BIDDING_POINTS);
    const selectionTimer = settings.timerSeconds || DEFAULT_SELECTION_TIMER_SECONDS;
    const bidTimer = isOpenMode ? 0 : (settings.auctionBidTimerSeconds ?? DEFAULT_BID_TIMER_SECONDS);

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
      totalBiddingPoints: biddingPoints, // Store total points for bot bid scaling
    };

    // Create the session
    const sessionData: DraftSessionInsert = {
      room_code: roomCode,
      host_id: userId,
      cube_id: cubeId,
      mode: mode,
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
      hide_scores: settings.hideScores ?? false,
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

    // Get session to preserve auction state settings
    const { data: existingSession } = await supabase
      .from('draft_sessions')
      .select('auction_state')
      .eq('id', sessionId)
      .single();

    const existingAuctionState = existingSession?.auction_state as AuctionStateData | null;

    // Get all players
    const { data: players, error: playersError } = await supabase
      .from('draft_players')
      .select()
      .eq('session_id', sessionId);

    if (playersError) throw playersError;
    if (!players || players.length === 0) {
      throw new Error('No players in session');
    }

    // Randomize player order by shuffling and reassigning seat positions
    const shuffledPlayers = shuffleArray([...players]);
    for (let i = 0; i < shuffledPlayers.length; i++) {
      const player = shuffledPlayers[i];
      if (player.seat_position !== i) {
        await supabase
          .from('draft_players')
          .update({ seat_position: i })
          .eq('id', player.id);
      }
    }

    // First selector is seat 0 (now randomized)
    const firstSelectorSeat = 0;

    // Initialize auction state for selection phase, preserving settings from createSession
    const initialAuctionState: AuctionStateData = {
      phase: 'selecting',
      cardId: null,
      currentBid: 0,
      currentBidderId: null,
      bids: [],
      passedPlayerIds: [],
      nextBidderSeat: null,
      bidTimerSeconds: existingAuctionState?.bidTimerSeconds,
      totalBiddingPoints: existingAuctionState?.totalBiddingPoints,
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
   * Select a card (called by the current selector)
   * In 'auction-grid' mode: starts bidding phase
   * In 'open' mode: directly awards card to selector
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

    // Check if this is Open Draft mode (no bidding)
    if (session.mode === 'open') {
      // In open mode, selector just gets the card directly (no bidding)
      // Set the cardId in auction state for consistency
      const existingAuctionState = session.auction_state as AuctionStateData | null;
      const openAuctionState: AuctionStateData = {
        ...existingAuctionState,
        phase: 'selecting',
        cardId: cardId,
        currentBid: 0,
        currentBidderId: null,
        bids: [],
        passedPlayerIds: [],
        nextBidderSeat: null,
      };

      await supabase
        .from('draft_sessions')
        .update({ auction_state: openAuctionState })
        .eq('id', sessionId);

      // Award card directly to selector - pass cardId directly to avoid race condition
      await this.resolveAuction(sessionId, playerId, 0, cardId);
      return;
    }

    // Auction mode: start bidding phase
    // Get all players for the session
    const { data: allPlayers } = await supabase
      .from('draft_players')
      .select()
      .eq('session_id', sessionId)
      .order('seat_position', { ascending: true });

    // Get max cards per grid setting
    const maxCardsPerGrid = session.pack_size || DEFAULT_CARDS_ACQUIRED_PER_GRID;

    // Check if selector is the only player who can still acquire cards
    // If so, skip bidding entirely and award the card directly
    const eligibleBidders = allPlayers!.filter(
      p => p.cards_acquired_this_grid < maxCardsPerGrid
    );

    if (eligibleBidders.length === 1 && eligibleBidders[0].id === playerId) {
      // Selector is the only one who can acquire cards - skip bidding
      console.log(`[selectCardForAuction] Only ${player.name} can acquire cards, skipping bidding`);
      await this.resolveAuction(sessionId, playerId, 0, cardId);
      return;
    }

    // Get bidding direction for this grid (alternates between grids)
    const biddingDirection = getBiddingDirection(session.current_grid);

    // Find next bidder (skip players with max cards)
    let nextBidderSeat = getNextSeat(player.seat_position, allPlayers!.length, biddingDirection);
    let attempts = 0;
    while (attempts < allPlayers!.length) {
      const nextPlayer = allPlayers?.find(p => p.seat_position === nextBidderSeat);
      const hasMaxCards = nextPlayer && nextPlayer.cards_acquired_this_grid >= maxCardsPerGrid;
      if (nextPlayer && !hasMaxCards) {
        break;
      }
      nextBidderSeat = getNextSeat(nextBidderSeat, allPlayers!.length, biddingDirection);
      attempts++;
    }

    // Preserve settings from existing auction state
    const existingAuctionState = session.auction_state as AuctionStateData | null;
    const bidTimerSeconds = existingAuctionState?.bidTimerSeconds;
    const totalBiddingPoints = existingAuctionState?.totalBiddingPoints;

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
      totalBiddingPoints: totalBiddingPoints,
      bidStartedAt: new Date().toISOString(),
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
      try {
        await this.makeBotBid(sessionId, session.current_grid, cardId, nextBidder.id);
      } catch (err) {
        console.error('[selectCardForAuction] Bot bid failed:', err);
      }
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

    // Get all players to check if this bidder is the only eligible one
    const { data: allPlayersCheck } = await supabase
      .from('draft_players')
      .select()
      .eq('session_id', sessionId);

    // Check if this player is the only one who can acquire cards
    const eligiblePlayers = allPlayersCheck?.filter(
      p => p.cards_acquired_this_grid < maxCardsPerGrid &&
           !auctionState.passedPlayerIds.includes(p.id)
    ) || [];

    if (eligiblePlayers.length === 1 && eligiblePlayers[0].id === playerId) {
      // This player is the only one who can acquire cards - auto-win at minimum bid
      console.log(`[placeBid] ${player.name} is the only eligible bidder, auto-winning`);
      await this.resolveAuction(sessionId, playerId, amount, auctionState.cardId!);
      return;
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

    // Get bidding direction for this grid
    const biddingDirection = getBiddingDirection(session.current_grid);

    // Find next bidder (skip passed players and players with max cards)
    let nextSeat = getNextSeat(player.seat_position, allPlayers!.length, biddingDirection);
    let attempts = 0;
    while (attempts < allPlayers!.length) {
      const nextPlayer = allPlayers?.find(p => p.seat_position === nextSeat);
      const hasMaxCards = nextPlayer && nextPlayer.cards_acquired_this_grid >= maxCardsPerGrid;
      if (nextPlayer && !auctionState.passedPlayerIds.includes(nextPlayer.id) && !hasMaxCards) {
        break;
      }
      nextSeat = getNextSeat(nextSeat, allPlayers!.length, biddingDirection);
      attempts++;
    }

    // Update auction state (reset bid timer when bidder changes)
    const updatedAuctionState: AuctionStateData = {
      ...auctionState,
      currentBid: amount,
      currentBidderId: playerId,
      bids: [...auctionState.bids, newBid],
      nextBidderSeat: nextSeat,
      bidStartedAt: new Date().toISOString(),
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
      try {
        await this.makeBotBid(sessionId, session.current_grid, auctionState.cardId!, nextBidder.id);
      } catch (err) {
        console.error('[placeBid] Bot bid failed:', err);
      }
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
    if (activeBidders.length === 1) {
      // The last remaining eligible player wins
      const winner = activeBidders[0];
      // If someone has bid, use that bid amount. Otherwise, give it for free.
      const winningBid = auctionState.currentBidderId ? auctionState.currentBid : 0;
      console.log(`[passBid] Only ${winner.name} remains eligible, auto-winning for ${winningBid}`);
      await this.resolveAuction(sessionId, winner.id, winningBid);
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

    // Get bidding direction for this grid
    const biddingDirection = getBiddingDirection(session.current_grid);

    // Find next bidder (skip passed players and players with max cards)
    let nextSeat = getNextSeat(player.seat_position, allPlayers!.length, biddingDirection);
    let attempts = 0;
    while (attempts < allPlayers!.length) {
      const nextPlayer = allPlayers?.find(p => p.seat_position === nextSeat);
      const hasMaxCards = nextPlayer && nextPlayer.cards_acquired_this_grid >= maxCardsPerGrid;
      if (nextPlayer && !passedPlayerIds.includes(nextPlayer.id) && !hasMaxCards) {
        break;
      }
      nextSeat = getNextSeat(nextSeat, allPlayers!.length, biddingDirection);
      attempts++;
    }

    // Update auction state (reset bid timer when bidder changes)
    const updatedAuctionState: AuctionStateData = {
      ...auctionState,
      passedPlayerIds: passedPlayerIds,
      nextBidderSeat: nextSeat,
      bidStartedAt: new Date().toISOString(),
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
      try {
        await this.makeBotBid(sessionId, session.current_grid, auctionState.cardId!, nextBidder.id);
      } catch (err) {
        console.error('[passBid] Bot bid failed:', err);
      }
    }
  },

  /**
   * Resolve the auction - award card to winner
   * @param cardIdOverride - Optional: Pass cardId directly to avoid race conditions (for open mode)
   */
  async resolveAuction(
    sessionId: string,
    winnerId: string,
    winningBid: number,
    cardIdOverride?: number
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
    const cardId = cardIdOverride ?? auctionState.cardId!;

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

    // Record the pick - use cards_acquired as pick_number to ensure uniqueness
    const pickData: DraftPickInsert = {
      session_id: sessionId,
      player_id: winnerId,
      card_id: cardId,
      pack_number: session.current_grid, // Using pack_number for grid_number
      pick_number: newCardsAcquired, // Use card count as pick number for uniqueness
      pick_time_seconds: 0,
      was_auto_pick: false,
    };

    const { error: pickError } = await supabase.from('draft_picks').insert(pickData);
    if (pickError) {
      console.error('[resolveAuction] Failed to insert pick:', pickError);
      // If it's a duplicate constraint, the card might already be picked
      // Log details for debugging
      console.error('[resolveAuction] Pick data was:', {
        sessionId,
        playerId: winnerId,
        playerName: winner.name,
        cardId,
        gridNumber: session.current_grid,
        pickNumber: newCardsAcquired,
        currentCardsThisGrid: winner.cards_acquired_this_grid,
      });
      // Don't throw - we've already updated the player state, so continue
      // The card count will be tracked even if the pick record fails
    }

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

    // Debug logging
    console.log(`[advanceToNextAuction] Grid ${currentGridNumber}/${totalGrids}:`, {
      cardsAcquiredPerGrid,
      remainingCards: currentGrid?.remainingCards.length ?? 0,
      playerCards: allPlayers.map(p => ({ name: p.name, acquired: p.cards_acquired_this_grid })),
      allPlayersMaxCards,
      noCardsRemain,
      shouldTransition: allPlayersMaxCards || noCardsRemain,
    });

    // Safety check: warn if transitioning while any player has fewer cards than expected
    const playersWithFewerCards = allPlayers.filter(p => p.cards_acquired_this_grid < cardsAcquiredPerGrid);
    if ((allPlayersMaxCards || noCardsRemain) && playersWithFewerCards.length > 0) {
      console.warn(`[advanceToNextAuction] WARNING: Grid ${currentGridNumber} transitioning but some players have fewer cards:`,
        playersWithFewerCards.map(p => ({ name: p.name, acquired: p.cards_acquired_this_grid, expected: cardsAcquiredPerGrid }))
      );
    }

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

      // IMPORTANT: Update session FIRST, then reset players
      // This prevents race condition where UI sees 0/5 but still shows old grid
      console.log(`[advanceToNextAuction] Transitioning to Grid ${nextGrid}`);
      const { error: sessionUpdateError } = await supabase
        .from('draft_sessions')
        .update({
          current_grid: nextGrid,
          current_selector_seat: nextSelector,
          grid_data: gridData,
          auction_state: newAuctionState,
          selection_started_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (sessionUpdateError) {
        console.error('[advanceToNextAuction] Failed to update session:', sessionUpdateError);
        throw sessionUpdateError;
      }

      // Reset cards_acquired_this_grid for all players AFTER session update
      // Use a single batch update for all players to avoid race conditions
      console.log(`[advanceToNextAuction] Resetting cards_acquired_this_grid for ${allPlayers.length} players`);
      const playerIds = allPlayers.map(p => p.id);
      const { error: resetError } = await supabase
        .from('draft_players')
        .update({ cards_acquired_this_grid: 0 })
        .in('id', playerIds);

      if (resetError) {
        console.error('[advanceToNextAuction] Failed to reset player card counts:', resetError);
        // Try individual updates as fallback
        for (const player of allPlayers) {
          const { error: individualError } = await supabase
            .from('draft_players')
            .update({ cards_acquired_this_grid: 0 })
            .eq('id', player.id);
          if (individualError) {
            console.error(`[advanceToNextAuction] Failed to reset ${player.name}:`, individualError);
          }
        }
      }

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
   * Prioritizes on-color cards (MTG) while considering card score
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

    // Get bot's drafted cards for color analysis
    const draftedCardIds = await this.getPlayerDraftedCards(sessionId, botPlayerId);
    const draftedCards = draftedCardIds
      .map(id => cubeService.getCardFromAnyCube(id))
      .filter((c): c is YuGiOhCard => c !== null);
    const collection = analyzeBotCollection(draftedCards);

    // Load cards and score them considering color compatibility
    const remainingCards = currentGrid.remainingCards;
    let bestCardId = remainingCards[0];
    let bestAdjustedScore = -1;

    for (const cardId of remainingCards) {
      const card = cubeService.getCardFromAnyCube(cardId);
      if (!card) continue;

      let adjustedScore = card.score ?? 50;
      const attrs = card.attributes as Record<string, unknown> | undefined;
      const cardColors = attrs?.colors as string[] | undefined;
      const isColorless = !cardColors || cardColors.length === 0;

      // MTG color consideration
      if (collection.mtgCommittedColors.length > 0 && !isColorless) {
        const onColor = cardColors!.some(c => collection.mtgCommittedColors.includes(c));
        if (onColor) {
          // Boost on-color cards
          adjustedScore *= 1.3;
        } else {
          // Penalize off-color cards heavily (but still consider bombs)
          adjustedScore *= 0.4;
        }
      } else if (!isColorless && collection.totalCards >= 2) {
        // Not committed yet - slight bonus for cards matching existing colors
        const matchesExisting = cardColors!.some(c => collection.mtgColors.has(c));
        if (matchesExisting) {
          adjustedScore *= 1.15;
        }
      }

      // Colorless cards get a small flexibility bonus
      if (isColorless && attrs) {
        adjustedScore *= 1.1;
      }

      if (adjustedScore > bestAdjustedScore) {
        bestAdjustedScore = adjustedScore;
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
   * @param botPlayerId - Optional: Pass the bot player ID directly to avoid race conditions
   */
  async makeBotBid(
    sessionId: string,
    gridNumber: number,
    cardId: number,
    botPlayerId?: string
  ): Promise<void> {
    try {
      const supabase = getSupabase();

      // Get session and auction state
      const { data: session } = await supabase
        .from('draft_sessions')
        .select()
        .eq('id', sessionId)
        .single();

      if (!session) {
        console.log('[makeBotBid] Session not found, aborting');
        return;
      }

      // Don't act while paused
      if (session.paused) {
        console.log('[makeBotBid] Session is paused, aborting');
        return;
      }

      const auctionState = session.auction_state as AuctionStateData | null;
      if (!auctionState || auctionState.phase !== 'bidding') {
        console.log('[makeBotBid] Not in bidding phase, aborting. Phase:', auctionState?.phase);
        return;
      }

      // Get all players
      const { data: allPlayers } = await supabase
        .from('draft_players')
        .select()
        .eq('session_id', sessionId)
        .order('seat_position', { ascending: true });

      // Find the bot - use passed ID if available, otherwise look up by seat
      let botPlayer: typeof allPlayers extends (infer T)[] | null ? T : never;
      if (botPlayerId) {
        botPlayer = allPlayers?.find(p => p.id === botPlayerId && p.is_bot);
      } else {
        botPlayer = allPlayers?.find(
          p => p.seat_position === auctionState.nextBidderSeat && p.is_bot
        );
      }

      if (!botPlayer) {
        console.log('[makeBotBid] Bot player not found. botPlayerId:', botPlayerId, 'nextBidderSeat:', auctionState.nextBidderSeat);
        return;
      }

      console.log(`[makeBotBid] ${botPlayer.name} deciding on card ${cardId}`);

      // Get card info - if card not found, bot will pass
      const card = cubeService.getCardFromAnyCube(cardId);

      // Get bot's drafted cards for intelligent bidding
      const draftedCardIds = await this.getPlayerDraftedCards(sessionId, botPlayer.id);
      const draftedCards = draftedCardIds
        .map(id => cubeService.getCardFromAnyCube(id))
        .filter((c): c is YuGiOhCard => c !== null);

      // Get total bidding points from auction state (defaults to 100)
      const totalPoints = auctionState.totalBiddingPoints ?? DEFAULT_BIDDING_POINTS;

      // Calculate bot bid with intelligent decision making
      // If card is null (not loaded), bot will pass (calculateBotBid returns null)
      const bidAmount = calculateBotBid(
        card,
        botPlayer.bidding_points,
        auctionState.currentBid,
        gridNumber,
        botPlayer.cards_acquired_this_grid,
        totalPoints,
        draftedCards
      );

      // Add a small delay for UX
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

      if (bidAmount !== null) {
        console.log(`[makeBotBid] ${botPlayer.name} bidding ${bidAmount}`);
        await this.placeBid(sessionId, botPlayer.id, bidAmount);
      } else {
        console.log(`[makeBotBid] ${botPlayer.name} passing`);
        await this.passBid(sessionId, botPlayer.id);
      }
    } catch (error) {
      console.error('[makeBotBid] Error:', error);
      // On error, try to pass so the auction can continue
      if (botPlayerId) {
        try {
          console.log('[makeBotBid] Attempting emergency pass after error');
          await this.passBid(sessionId, botPlayerId);
        } catch (passError) {
          console.error('[makeBotBid] Emergency pass also failed:', passError);
        }
      }
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
   * Note: We re-fetch the full session on updates because Supabase Realtime
   * doesn't always include large JSONB columns (like grid_data) in the payload
   */
  subscribeToSession(
    sessionId: string,
    onSessionUpdate: (session: DraftSessionRow) => void,
    onPlayersUpdate: (players: DraftPlayerRow[]) => void,
    onPicksUpdate?: () => void
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
        async () => {
          // Re-fetch the full session to ensure we have all JSONB data (grid_data, auction_state)
          const session = await this.getSession(sessionId);
          if (session) {
            onSessionUpdate(session);
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
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'draft_picks',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          // Notify when new picks are inserted (card won)
          onPicksUpdate?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Check for timed-out bidders and auto-pass or trigger bot bids
   * Should be called on an interval from the client
   */
  async checkAndAutoPassTimedOut(sessionId: string): Promise<void> {
    const supabase = getSupabase();

    // Get current session
    const { data: session } = await supabase
      .from('draft_sessions')
      .select()
      .eq('id', sessionId)
      .single();

    if (!session || session.status !== 'in_progress') return;
    if (session.paused) return; // Don't take action while paused

    const auctionState = session.auction_state as AuctionStateData | null;
    if (!auctionState || auctionState.phase !== 'bidding') return;

    const bidTimerSeconds = auctionState.bidTimerSeconds ?? DEFAULT_BID_TIMER_SECONDS;
    const bidStartedAt = auctionState.bidStartedAt;

    if (!bidStartedAt) return;

    const startTime = new Date(bidStartedAt).getTime();
    const elapsed = (Date.now() - startTime) / 1000;

    // Get all players
    const { data: allPlayers } = await supabase
      .from('draft_players')
      .select()
      .eq('session_id', sessionId)
      .order('seat_position', { ascending: true });

    if (!allPlayers) return;

    // Find the current bidder
    const currentBidder = allPlayers.find(p => p.seat_position === auctionState.nextBidderSeat);
    if (!currentBidder) return;

    // Already passed?
    if (auctionState.passedPlayerIds.includes(currentBidder.id)) return;

    // For BOTS: Retry bot bid after just 5 seconds of inactivity
    // This catches cases where the initial bot bid trigger failed
    if (currentBidder.is_bot) {
      if (elapsed >= 5) {
        console.log(`[auctionService] Bot ${currentBidder.name} hasn't acted in ${elapsed.toFixed(1)}s, triggering retry`);
        await this.makeBotBid(sessionId, session.current_grid, auctionState.cardId!, currentBidder.id);
      }
      return;
    }

    // For HUMANS: Wait for full timer + grace period before auto-passing
    if (elapsed < bidTimerSeconds + 2) return;

    console.log(`[auctionService] Bid timer expired for ${currentBidder.name}, elapsed: ${elapsed}s`);
    console.log(`[auctionService] Auto-passing for timed-out player ${currentBidder.name}`);
    await this.passBid(sessionId, currentBidder.id);
  },

  /**
   * Toggle pause state for a session (host only)
   */
  async togglePause(sessionId: string, currentTimeRemaining?: number): Promise<boolean> {
    const supabase = getSupabase();
    const userId = getUserId();

    // Get current session state
    const { data: session, error: fetchError } = await supabase
      .from('draft_sessions')
      .select()
      .eq('id', sessionId)
      .single();

    if (fetchError) {
      console.error('[auctionService] Failed to fetch session for pause:', fetchError);
      throw new Error(`Failed to fetch session: ${fetchError.message}`);
    }

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.host_id !== userId) {
      throw new Error('Only the host can pause/unpause the draft');
    }

    const newPausedState = !session.paused;

    // Build update data
    const updateData: {
      paused: boolean;
      time_remaining_at_pause?: number | null;
      resume_at?: string | null;
      paused_at?: string | null;
    } = {
      paused: newPausedState,
    };

    if (newPausedState && currentTimeRemaining !== undefined) {
      // Pausing - save current time remaining, clear resume_at, set paused_at
      updateData.time_remaining_at_pause = currentTimeRemaining;
      updateData.resume_at = null;
      updateData.paused_at = new Date().toISOString();
    } else if (!newPausedState) {
      // Resuming - set resume_at to 5 seconds from now (server timestamp)
      // All clients will sync to this absolute time for the countdown
      const resumeTime = new Date(Date.now() + 5000).toISOString();
      updateData.resume_at = resumeTime;
      // Keep time_remaining_at_pause - clients need it after countdown ends
    }

    const { error } = await supabase
      .from('draft_sessions')
      .update(updateData)
      .eq('id', sessionId);

    if (error) {
      console.error('[auctionService] Failed to toggle pause:', error);
      throw new Error(`Failed to pause: ${error.message}`);
    }

    return newPausedState;
  },
};
