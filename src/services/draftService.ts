import { getSupabase, generateRoomCode } from '../lib/supabase';
import type {
  DraftSessionRow,
  DraftSessionInsert,
  DraftPlayerRow,
  DraftPlayerInsert,
  DraftPickInsert,
  DraftBurnedCardInsert,
  PackData,
} from '../lib/database.types';
import type { DraftSettings } from '../types';
import { shuffleArray, createPacks } from '../lib/utils';
import { cubeService } from './cubeService';
import { getActiveGameConfig } from '../context/GameContext';

/**
 * Get the storage key prefix for the current game
 */
function getStoragePrefix(): string {
  try {
    return getActiveGameConfig().storageKeyPrefix;
  } catch {
    // Fallback if context not available
    return 'yugioh-draft';
  }
}

/**
 * Get the default player name for the current game
 */
function getDefaultPlayerName(): string {
  try {
    return getActiveGameConfig().defaultPlayerName;
  } catch {
    return 'Player';
  }
}

// Generate a unique user ID for this browser session
function getUserId(): string {
  const key = `${getStoragePrefix()}-user-id`;
  let userId = localStorage.getItem(key);
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem(key, userId);
  }
  return userId;
}

// Get or set player name
export function getPlayerName(): string {
  return localStorage.getItem(`${getStoragePrefix()}-player-name`) || getDefaultPlayerName();
}

export function setPlayerName(name: string): void {
  localStorage.setItem(`${getStoragePrefix()}-player-name`, name);
}

// Store and retrieve last active session for rejoin functionality
export function setLastSession(sessionId: string, roomCode: string): void {
  localStorage.setItem(`${getStoragePrefix()}-last-session`, JSON.stringify({ sessionId, roomCode }));
}

export function getLastSession(): { sessionId: string; roomCode: string } | null {
  const data = localStorage.getItem(`${getStoragePrefix()}-last-session`);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function clearLastSession(): void {
  localStorage.removeItem(`${getStoragePrefix()}-last-session`);
}

export const draftService = {
  /**
   * Create a new draft session
   */
  async createSession(
    settings: DraftSettings,
    cubeId: string,
    cubeCardIds: number[]
  ): Promise<{ session: DraftSessionRow; player: DraftPlayerRow; roomCode: string }> {
    const supabase = getSupabase();
    const userId = getUserId();
    const roomCode = generateRoomCode();

    // Calculate total players (for solo: 1 human + bots)
    const totalPlayers = settings.playerCount === 1
      ? 1 + settings.botCount
      : settings.playerCount;

    if (!cubeCardIds || cubeCardIds.length === 0) {
      throw new Error('No cube cards provided');
    }

    // Shuffle cube and create packs for all players
    // Account for burned cards: each pack gives (packSize - burnedPerPack) picks
    const shuffledCards = shuffleArray(cubeCardIds);
    const picksPerPack = settings.packSize - settings.burnedPerPack;
    const packsPerPlayer = Math.ceil(settings.cardsPerPlayer / picksPerPack);
    const totalPacks = packsPerPlayer * totalPlayers;
    const totalCardsNeeded = totalPacks * settings.packSize;
    const cardsToUse = shuffledCards.slice(0, totalCardsNeeded);

    // Create pack data for each player seat with pack numbers
    // Each player gets packsPerPlayer packs, each with packSize cards
    const cardsPerPlayerTotal = packsPerPlayer * settings.packSize;
    const packData: PackData[] = [];
    for (let seat = 0; seat < totalPlayers; seat++) {
      const startIdx = seat * cardsPerPlayerTotal;
      const playerCards = cardsToUse.slice(startIdx, startIdx + cardsPerPlayerTotal);
      const playerPacks = createPacks(playerCards, settings.packSize);

      playerPacks.forEach((pack, packIdx) => {
        packData.push({
          player_seat: seat,
          pack_number: packIdx + 1, // 1-indexed
          cards: pack,
        });
      });
    }

    // Create the session
    const sessionData: DraftSessionInsert = {
      room_code: roomCode,
      host_id: userId,
      cube_id: cubeId,
      mode: settings.mode,
      player_count: totalPlayers, // Store total including bots
      cards_per_player: settings.cardsPerPlayer,
      pack_size: settings.packSize,
      burned_per_pack: settings.burnedPerPack,
      timer_seconds: settings.timerSeconds,
      status: 'waiting',
      current_pack: 1,
      current_pick: 1,
      direction: 'left',
      pack_data: packData,
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
    };

    const { data: player, error: playerError } = await supabase
      .from('draft_players')
      .insert(playerData)
      .select()
      .single();

    if (playerError) throw playerError;

    // Create bot players for solo mode
    if (settings.playerCount === 1 && settings.botCount > 0) {
      // Get bot names from game config, with fallback
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
          seat_position: i + 1, // Human is seat 0
          is_host: false,
          is_bot: true,
          is_connected: true,
          current_hand: [],
          pick_made: false,
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
   * Join an existing draft session by room code
   */
  async joinSession(
    roomCode: string
  ): Promise<{ session: DraftSessionRow; player: DraftPlayerRow }> {
    const supabase = getSupabase();
    const userId = getUserId();

    // Find the session
    const { data: session, error: sessionError } = await supabase
      .from('draft_sessions')
      .select()
      .eq('room_code', roomCode.toUpperCase())
      .single();

    if (sessionError || !session) {
      throw new Error('Room not found');
    }

    // Check if user is already in this session (for reconnection)
    const { data: existingPlayer } = await supabase
      .from('draft_players')
      .select()
      .eq('session_id', session.id)
      .eq('user_id', userId)
      .single();

    if (existingPlayer) {
      // Allow reconnection even during in-progress drafts
      const { data: updatedPlayer } = await supabase
        .from('draft_players')
        .update({ is_connected: true, last_seen_at: new Date().toISOString() })
        .eq('id', existingPlayer.id)
        .select()
        .single();

      return { session, player: updatedPlayer || existingPlayer };
    }

    // Only allow new players to join during waiting phase
    if (session.status !== 'waiting') {
      throw new Error('Draft has already started');
    }

    // Get current player count
    const { count } = await supabase
      .from('draft_players')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id);

    if ((count || 0) >= session.player_count) {
      throw new Error('Room is full');
    }

    // Add new player
    const playerData: DraftPlayerInsert = {
      session_id: session.id,
      user_id: userId,
      name: getPlayerName(),
      seat_position: count || 0,
      is_host: false,
      is_connected: true,
      current_hand: [],
      pick_made: false,
    };

    const { data: player, error: playerError } = await supabase
      .from('draft_players')
      .insert(playerData)
      .select()
      .single();

    if (playerError) throw playerError;

    return { session, player };
  },

  /**
   * Get session by ID
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
   * Get all players in a session
   */
  async getPlayers(sessionId: string): Promise<DraftPlayerRow[]> {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('draft_players')
      .select()
      .eq('session_id', sessionId)
      .order('seat_position');
    return data || [];
  },

  /**
   * Get current user's player record for a session
   */
  async getCurrentPlayer(sessionId: string): Promise<DraftPlayerRow | null> {
    const supabase = getSupabase();
    const userId = getUserId();
    const { data } = await supabase
      .from('draft_players')
      .select()
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();
    return data;
  },

  /**
   * Start the draft (host only)
   */
  async startDraft(sessionId: string): Promise<void> {
    const supabase = getSupabase();
    const userId = getUserId();

    // Verify user is host
    const { data: session } = await supabase
      .from('draft_sessions')
      .select()
      .eq('id', sessionId)
      .single();

    if (!session || session.host_id !== userId) {
      throw new Error('Only the host can start the draft');
    }

    // Get all players
    const { data: players } = await supabase
      .from('draft_players')
      .select()
      .eq('session_id', sessionId)
      .order('seat_position');

    if (!players || players.length < session.player_count) {
      throw new Error('Waiting for more players');
    }

    // Get pack data
    const packData = session.pack_data as PackData[] | null;

    if (!packData || packData.length === 0) {
      throw new Error('No pack data found - session may be corrupted');
    }

    // Distribute first pack (pack_number: 1) to each player
    for (const player of players) {
      const playerPack = packData.find(
        (p) => p.player_seat === player.seat_position && p.pack_number === 1
      );

      if (playerPack) {
        await supabase
          .from('draft_players')
          .update({ current_hand: playerPack.cards, pick_made: false })
          .eq('id', player.id);
      }
    }

    // Update session status and set pick timer start
    const now = new Date().toISOString();
    await supabase
      .from('draft_sessions')
      .update({
        status: 'in_progress',
        started_at: now,
        pick_started_at: now,
      })
      .eq('id', sessionId);
  },

  /**
   * Toggle pause state (host only)
   * When pausing: saves the time remaining and clears resume_at
   * When resuming: sets resume_at to now + 5 seconds for synchronized countdown
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
      console.error('[draftService] Failed to fetch session for pause:', fetchError);
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
      console.error('[draftService] Failed to toggle pause:', error);
      throw new Error(`Failed to pause: ${error.message}`);
    }

    return newPausedState;
  },

  /**
   * Make a pick
   * Uses optimistic locking to prevent duplicate picks from race conditions
   */
  async makePick(
    sessionId: string,
    playerId: string,
    cardId: number,
    pickTimeSeconds: number = 0,
    wasAutoPick: boolean = false
  ): Promise<void> {
    const supabase = getSupabase();

    // Get current state
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

    if (player.pick_made) {
      throw new Error('Pick already made this round');
    }

    // Verify card is in hand
    if (!player.current_hand.includes(cardId)) {
      throw new Error('Card not in hand');
    }

    // Store the pack/pick numbers we read at the start
    const pickPack = session.current_pack;
    const pickNumber = session.current_pick;

    // IMPORTANT: Insert pick record FIRST, before updating player hand
    // This ensures we don't lose the card if the insert fails
    const pickData: DraftPickInsert = {
      session_id: sessionId,
      player_id: playerId,
      card_id: cardId,
      pack_number: pickPack,
      pick_number: pickNumber,
      pick_time_seconds: pickTimeSeconds,
      was_auto_pick: wasAutoPick,
    };

    const { error: pickError } = await supabase.from('draft_picks').insert(pickData);

    if (pickError) {
      // Check if it's a unique constraint violation
      if (pickError.code === '23505') {
        // Unique constraint - check which one
        if (pickError.message?.includes('card_id')) {
          // Card was already picked by someone else - shouldn't happen with proper pack management
          console.log('[makePick] Card already picked by another player:', cardId);
          throw new Error('Card already picked');
        } else {
          // Player already has a pick for this round - this is fine, means we already recorded it
          console.log('[makePick] Pick already recorded for this round');
        }
      } else {
        // Some other error - don't proceed
        console.error('[makePick] Failed to insert pick:', pickError);
        throw new Error('Failed to record pick');
      }
    }

    // Re-fetch current hand to avoid race conditions where another process updated it
    const { data: freshPlayer } = await supabase
      .from('draft_players')
      .select('current_hand')
      .eq('id', playerId)
      .single();

    // Compute new hand from fresh data, removing the picked card
    // Note: If fresh fetch fails, we still use the original data since the pick is recorded
    // (the hand update is best-effort at this point)
    if (!freshPlayer) {
      console.warn('[makePick] Could not fetch fresh player data, using original hand for update');
    }
    const currentHand = freshPlayer?.current_hand || player.current_hand;
    const newHand = currentHand.filter((id: number) => id !== cardId);
    await supabase
      .from('draft_players')
      .update({ current_hand: newHand, pick_made: true })
      .eq('id', playerId);

    // Trigger bot picks if there are bots in this session
    await this.makeBotPicks(sessionId, session.cube_id, session.current_pack, session.current_pick);

    // Check if all players have made their pick
    const { data: allPlayers } = await supabase
      .from('draft_players')
      .select()
      .eq('session_id', sessionId);

    const allPicked = allPlayers?.every((p) => p.pick_made);

    if (allPicked) {
      // Pass packs to next player
      await this.passPacks(sessionId);
    }
  },

  /**
   * Make picks for all bot players (AI picks highest-scored card)
   * Uses optimistic locking to prevent race conditions with multiple clients
   */
  async makeBotPicks(
    sessionId: string,
    _cubeId: string, // Reserved for future cube-specific AI strategies
    _packNumber: number, // Deprecated - we fetch fresh state
    _pickNumber: number  // Deprecated - we fetch fresh state
  ): Promise<void> {
    const supabase = getSupabase();

    // Get session to know burn threshold, paused state, and CURRENT pack/pick
    const { data: session } = await supabase
      .from('draft_sessions')
      .select('burned_per_pack, paused, status, current_pack, current_pick')
      .eq('id', sessionId)
      .single();

    // Don't make bot picks if session is paused or not in progress
    if (!session || session.paused || session.status !== 'in_progress') {
      console.log('[makeBotPicks] Session paused or not in progress, skipping');
      return;
    }

    const burnedPerPack = session?.burned_per_pack || 0;
    const currentPack = session.current_pack;
    const currentPick = session.current_pick;

    // Get all bot players who haven't picked yet
    const { data: bots, error: botsError } = await supabase
      .from('draft_players')
      .select()
      .eq('session_id', sessionId)
      .eq('is_bot', true)
      .eq('pick_made', false);

    if (botsError) {
      console.error('[makeBotPicks] Error fetching bots:', botsError);
      return;
    }

    if (!bots || bots.length === 0) {
      console.log('[makeBotPicks] No bots needing picks');
      return;
    }

    console.log(`[makeBotPicks] Found ${bots.length} bots needing picks`);

    for (const bot of bots) {
      // Re-check session paused state before each bot pick
      const { data: currentSession } = await supabase
        .from('draft_sessions')
        .select('paused, status')
        .eq('id', sessionId)
        .single();

      if (!currentSession || currentSession.paused || currentSession.status !== 'in_progress') {
        console.log('[makeBotPicks] Session paused or ended mid-loop, stopping bot picks');
        break;
      }

      // Re-fetch current hand to get fresh data
      const { data: freshBot } = await supabase
        .from('draft_players')
        .select('current_hand, pick_made')
        .eq('id', bot.id)
        .single();

      // Skip if already picked (another process handled it)
      if (freshBot?.pick_made) {
        console.log(`[makeBotPicks] Skipping ${bot.name}: already picked`);
        continue;
      }

      // IMPORTANT: Never fall back to stale data - if fresh read fails, skip this bot
      if (!freshBot) {
        console.log(`[makeBotPicks] Skipping ${bot.name}: could not fetch fresh data`);
        continue;
      }
      const currentHand: number[] = freshBot.current_hand;

      // Skip if hand is empty (no cards to pick from)
      if (currentHand.length === 0) {
        console.log(`[makeBotPicks] Skipping ${bot.name}: empty hand`);
        continue;
      }

      // Get card scores and sort by score descending
      const cardScores: { cardId: number; score: number }[] = currentHand.map((cardId: number) => {
        const card = cubeService.getCardFromAnyCube(cardId);
        return {
          cardId,
          score: card?.score ?? 50,
        };
      });
      cardScores.sort((a, b) => b.score - a.score);

      // Try each card in order until one succeeds (in case some are already picked)
      let pickedCardId: number | null = null;
      for (const cardOption of cardScores) {
        const pickData: DraftPickInsert = {
          session_id: sessionId,
          player_id: bot.id,
          card_id: cardOption.cardId,
          pack_number: currentPack,
          pick_number: currentPick,
          pick_time_seconds: 0,
          was_auto_pick: true,
        };

        const { error: pickError } = await supabase.from('draft_picks').insert(pickData);

        if (!pickError) {
          // Success - this card was picked
          pickedCardId = cardOption.cardId;
          console.log(`[makeBotPicks] Bot ${bot.name} picked card ${pickedCardId}`);
          break;
        } else if (pickError.code === '23505') {
          // Unique constraint violation
          if (pickError.message?.includes('card_id')) {
            // Card already picked by someone else - try next card
            console.log(`[makeBotPicks] Card ${cardOption.cardId} already picked, trying next`);
            continue;
          } else {
            // Bot already has a pick for this round - another process handled it
            // IMPORTANT: Don't update hand (we don't know which card), but DO mark pick_made = true
            console.log(`[makeBotPicks] Bot ${bot.name} pick already recorded, marking pick_made=true`);
            await supabase
              .from('draft_players')
              .update({ pick_made: true })
              .eq('id', bot.id);
            break;
          }
        } else {
          // Some other error - log and try next card
          console.error(`[makeBotPicks] Error picking card ${cardOption.cardId}:`, pickError);
          continue;
        }
      }

      // Only update hand if we successfully picked a card
      if (!pickedCardId) {
        console.log(`[makeBotPicks] Bot ${bot.name} - no card picked in this attempt`);
        continue;
      }

      // Update hand to remove the picked card
      const newHand = currentHand.filter((id: number) => id !== pickedCardId);
      await supabase
        .from('draft_players')
        .update({ current_hand: newHand, pick_made: true })
        .eq('id', bot.id);

      console.log(`[makeBotPicks] Bot ${bot.name} hand updated`);
    }
  },

  /**
   * Pass packs to next player (called when all players have picked)
   * Uses optimistic locking to prevent race conditions when multiple clients call simultaneously
   */
  async passPacks(sessionId: string): Promise<void> {
    const supabase = getSupabase();

    const { data: session } = await supabase
      .from('draft_sessions')
      .select()
      .eq('id', sessionId)
      .single();

    const { data: players } = await supabase
      .from('draft_players')
      .select()
      .eq('session_id', sessionId)
      .order('seat_position');

    if (!session || !players) return;

    // Store current state for optimistic locking
    const expectedPack = session.current_pack;
    const expectedPick = session.current_pick;

    const playerCount = players.length;
    const isLeftDirection = session.direction === 'left';
    const burnedPerPack = session.burned_per_pack || 0;

    // Check if current pack is finished (hands have burnedPerPack or fewer cards remaining)
    const packFinished = players.every((p) => p.current_hand.length <= burnedPerPack);

    if (packFinished) {
      // Record burned cards before clearing hands
      const burnedCards: DraftBurnedCardInsert[] = [];
      for (const player of players) {
        if (player.current_hand.length > 0) {
          for (const cardId of player.current_hand) {
            burnedCards.push({
              session_id: sessionId,
              card_id: cardId,
              pack_number: session.current_pack,
              burned_from_seat: player.seat_position,
            });
          }
        }
      }

      // Insert all burned cards
      if (burnedCards.length > 0) {
        await supabase.from('draft_burned_cards').insert(burnedCards);
      }

      // Clear hands after recording burns
      for (const player of players) {
        if (player.current_hand.length > 0) {
          await supabase
            .from('draft_players')
            .update({ current_hand: [] })
            .eq('id', player.id);
        }
      }

      // Move to next pack or end draft
      // Account for burned cards: each pack gives (packSize - burnedPerPack) picks
      const picksPerPack = session.pack_size - burnedPerPack;
      const packsPerPlayer = Math.ceil(session.cards_per_player / picksPerPack);

      if (session.current_pack >= packsPerPlayer) {
        // Draft complete - use optimistic locking
        const { data: completionResult } = await supabase
          .from('draft_sessions')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', sessionId)
          .eq('status', 'in_progress') // Only complete if still in progress
          .eq('current_pack', expectedPack)
          .select();

        if (!completionResult || completionResult.length === 0) {
          console.log('[passPacks] Draft completion already handled by another client');
        }
        return;
      }

      // Update session FIRST with optimistic locking
      // This ensures only one client proceeds with distributing the next pack
      const { data: updateResult } = await supabase
        .from('draft_sessions')
        .update({
          current_pack: session.current_pack + 1,
          current_pick: 1,
          direction: isLeftDirection ? 'right' : 'left',
          pick_started_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .eq('current_pack', expectedPack)
        .eq('current_pick', expectedPick)
        .select();

      // If no rows updated, another client already handled this
      if (!updateResult || updateResult.length === 0) {
        console.log('[passPacks] Pack transition already handled by another client');
        return;
      }

      // Now safe to distribute next pack since we won the race
      const packData = session.pack_data as PackData[];
      const nextPackNumber = session.current_pack + 1;

      for (const player of players) {
        const playerPack = packData.find(
          (p) => p.player_seat === player.seat_position && p.pack_number === nextPackNumber
        );
        if (playerPack) {
          await supabase
            .from('draft_players')
            .update({ current_hand: playerPack.cards, pick_made: false })
            .eq('id', player.id);
        }
      }
    } else {
      // Pass hands to next player
      const hands: { [seat: number]: number[] } = {};
      players.forEach((p) => {
        hands[p.seat_position] = p.current_hand;
      });

      // Update pick number and reset pick timer FIRST with optimistic locking
      // This ensures only one client proceeds with the hand passing
      const { data: updateResult } = await supabase
        .from('draft_sessions')
        .update({
          current_pick: session.current_pick + 1,
          pick_started_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .eq('current_pack', expectedPack)
        .eq('current_pick', expectedPick)
        .select();

      // If no rows updated, another client already handled this
      if (!updateResult || updateResult.length === 0) {
        console.log('[passPacks] Pick increment already handled by another client');
        return;
      }

      // Now safe to pass hands since we won the race
      for (const player of players) {
        const sourceSeat = isLeftDirection
          ? (player.seat_position + 1) % playerCount
          : (player.seat_position - 1 + playerCount) % playerCount;

        await supabase
          .from('draft_players')
          .update({ current_hand: hands[sourceSeat], pick_made: false })
          .eq('id', player.id);
      }
    }
  },

  /**
   * Get all picks for a player
   */
  async getPlayerPicks(
    sessionId: string,
    playerId: string
  ): Promise<number[]> {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('draft_picks')
      .select('card_id')
      .eq('session_id', sessionId)
      .eq('player_id', playerId)
      .order('created_at');
    return data?.map((p) => p.card_id) || [];
  },

  /**
   * Update player connection status
   */
  async updateConnectionStatus(
    playerId: string,
    isConnected: boolean
  ): Promise<void> {
    const supabase = getSupabase();
    await supabase
      .from('draft_players')
      .update({
        is_connected: isConnected,
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', playerId);
  },

  /**
   * Subscribe to session updates
   */
  subscribeToSession(
    sessionId: string,
    onSessionUpdate: (session: DraftSessionRow) => void,
    onPlayersUpdate: (players: DraftPlayerRow[]) => void
  ) {
    const supabase = getSupabase();

    const channel = supabase
      .channel(`draft:${sessionId}`)
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
          // Refetch all players on any change
          const players = await this.getPlayers(sessionId);
          onPlayersUpdate(players);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Get current user ID
   */
  getUserId,

  /**
   * Get all burned cards for a session
   */
  async getBurnedCards(sessionId: string): Promise<{ card_id: number; pack_number: number; burned_from_seat: number }[]> {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('draft_burned_cards')
      .select('card_id, pack_number, burned_from_seat')
      .eq('session_id', sessionId)
      .order('pack_number')
      .order('burned_from_seat');
    return data || [];
  },

  /**
   * Get all picks for a session with timing metrics
   */
  async getSessionPicks(sessionId: string): Promise<{
    player_id: string;
    card_id: number;
    pack_number: number;
    pick_number: number;
    pick_time_seconds: number;
    was_auto_pick: boolean;
  }[]> {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('draft_picks')
      .select('player_id, card_id, pack_number, pick_number, pick_time_seconds, was_auto_pick')
      .eq('session_id', sessionId)
      .order('pack_number')
      .order('pick_number');
    return data || [];
  },

  /**
   * Get session statistics summary
   */
  async getSessionStats(sessionId: string): Promise<{
    totalPicks: number;
    totalBurned: number;
    avgPickTime: number;
    autoPickCount: number;
    firstPickCount: number;
    wheeledCount: number;
  }> {
    const supabase = getSupabase();

    // Get session for pack_size
    const { data: session } = await supabase
      .from('draft_sessions')
      .select('pack_size')
      .eq('id', sessionId)
      .single();

    const halfPackSize = (session?.pack_size || 10) / 2;

    // Get all picks
    const { data: picks } = await supabase
      .from('draft_picks')
      .select('pick_number, pick_time_seconds, was_auto_pick')
      .eq('session_id', sessionId);

    // Get all burned cards
    const { count: burnedCount } = await supabase
      .from('draft_burned_cards')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);

    if (!picks || picks.length === 0) {
      return {
        totalPicks: 0,
        totalBurned: burnedCount || 0,
        avgPickTime: 0,
        autoPickCount: 0,
        firstPickCount: 0,
        wheeledCount: 0,
      };
    }

    const manualPicks = picks.filter(p => !p.was_auto_pick);
    const avgPickTime = manualPicks.length > 0
      ? manualPicks.reduce((sum, p) => sum + (p.pick_time_seconds || 0), 0) / manualPicks.length
      : 0;

    return {
      totalPicks: picks.length,
      totalBurned: burnedCount || 0,
      avgPickTime: Math.round(avgPickTime * 10) / 10,
      autoPickCount: picks.filter(p => p.was_auto_pick).length,
      firstPickCount: picks.filter(p => p.pick_number === 1).length,
      wheeledCount: picks.filter(p => p.pick_number > halfPackSize).length,
    };
  },

  /**
   * Check if current pick is timed out and auto-pick for all players who haven't picked.
   * This is called by clients to enforce server-side timeout.
   * Returns the number of players who were auto-picked.
   */
  async checkAndAutoPickTimedOut(sessionId: string): Promise<{
    autoPickedCount: number;
    autoPickedNames: string[];
  }> {
    const supabase = getSupabase();
    const GRACE_PERIOD_SECONDS = 5; // Extra time before forcing auto-pick

    // Get session state
    const { data: session } = await supabase
      .from('draft_sessions')
      .select()
      .eq('id', sessionId)
      .single();

    if (!session) {
      console.log('[checkAndAutoPickTimedOut] No session found');
      return { autoPickedCount: 0, autoPickedNames: [] };
    }

    if (session.status !== 'in_progress') {
      console.log(`[checkAndAutoPickTimedOut] Session not in_progress: ${session.status}`);
      return { autoPickedCount: 0, autoPickedNames: [] };
    }

    if (session.paused) {
      console.log('[checkAndAutoPickTimedOut] Session is paused');
      return { autoPickedCount: 0, autoPickedNames: [] };
    }

    // If we're in a resume countdown, don't auto-pick yet
    if (session.resume_at) {
      const resumeAt = new Date(session.resume_at).getTime();
      if (Date.now() < resumeAt) {
        console.log('[checkAndAutoPickTimedOut] In resume countdown');
        return { autoPickedCount: 0, autoPickedNames: [] };
      }
    }

    // Check if pick has timed out
    if (!session.pick_started_at) {
      console.log('[checkAndAutoPickTimedOut] No pick_started_at');
      return { autoPickedCount: 0, autoPickedNames: [] };
    }

    const now = Date.now();
    const pickStartedAt = new Date(session.pick_started_at).getTime();
    let timeRemaining: number;

    // If we just resumed from pause and haven't started a new pick yet, use the saved time remaining
    // Only use resume_at calculation if it's more recent than pick_started_at (i.e., this is the first pick after resume)
    const resumeAt = session.resume_at ? new Date(session.resume_at).getTime() : 0;
    const useResumeTime = session.resume_at &&
      session.time_remaining_at_pause !== null &&
      session.time_remaining_at_pause !== undefined &&
      resumeAt > pickStartedAt; // Resume happened after the last pick started

    if (useResumeTime) {
      const timeSinceResume = (now - resumeAt) / 1000;
      timeRemaining = session.time_remaining_at_pause - timeSinceResume;
    } else {
      // Normal case: calculate from pick_started_at
      const elapsedSeconds = (now - pickStartedAt) / 1000;
      timeRemaining = session.timer_seconds - elapsedSeconds;
    }

    // Only auto-pick if time has fully expired plus grace period
    console.log(`[checkAndAutoPickTimedOut] timeRemaining=${timeRemaining.toFixed(1)}s, grace=${GRACE_PERIOD_SECONDS}s`);
    if (timeRemaining > -GRACE_PERIOD_SECONDS) {
      return { autoPickedCount: 0, autoPickedNames: [] };
    }

    console.log('[checkAndAutoPickTimedOut] Time expired, checking players...');

    // Re-fetch players fresh to get current state (avoid stale data)
    const { data: playersNeedingPick, error: playersError } = await supabase
      .from('draft_players')
      .select()
      .eq('session_id', sessionId)
      .eq('pick_made', false);

    if (playersError) {
      console.error('[checkAndAutoPickTimedOut] Error fetching players:', playersError);
      return { autoPickedCount: 0, autoPickedNames: [] };
    }

    console.log(`[checkAndAutoPickTimedOut] Found ${playersNeedingPick?.length || 0} players needing pick`);

    if (!playersNeedingPick || playersNeedingPick.length === 0) {
      return { autoPickedCount: 0, autoPickedNames: [] };
    }

    const autoPickedNames: string[] = [];

    // Auto-pick for each player who hasn't picked
    // Use optimistic locking to prevent race conditions between clients
    for (const player of playersNeedingPick) {
      // Re-check session paused state before each auto-pick (in case pause happened mid-loop)
      const { data: currentSession } = await supabase
        .from('draft_sessions')
        .select('paused, status')
        .eq('id', sessionId)
        .single();

      if (!currentSession || currentSession.paused || currentSession.status !== 'in_progress') {
        console.log('[checkAndAutoPickTimedOut] Session paused or ended mid-loop, stopping auto-picks');
        break;
      }

      // Re-fetch current hand to get fresh data
      const { data: freshPlayer } = await supabase
        .from('draft_players')
        .select('current_hand, pick_made')
        .eq('id', player.id)
        .single();

      // Skip if already picked (another process handled it)
      if (freshPlayer?.pick_made) {
        console.log(`[checkAndAutoPickTimedOut] Skipping ${player.name}: already picked`);
        continue;
      }

      // IMPORTANT: Never fall back to stale data - if fresh read fails, skip this player
      if (!freshPlayer) {
        console.log(`[checkAndAutoPickTimedOut] Skipping ${player.name}: could not fetch fresh data`);
        continue;
      }
      const currentHand: number[] = freshPlayer.current_hand;

      // Skip if hand is empty (no cards to pick from)
      if (currentHand.length === 0) {
        console.log(`[checkAndAutoPickTimedOut] Skipping ${player.name}: empty hand`);
        continue;
      }

      // Get card scores and sort by score descending
      const cardScores: { cardId: number; score: number }[] = currentHand.map((cardId: number) => {
        const card = cubeService.getCardFromAnyCube(cardId);
        return {
          cardId,
          score: card?.score ?? 50,
        };
      });
      cardScores.sort((a, b) => b.score - a.score);

      // Try each card in order until one succeeds (in case some are already picked)
      let pickedCardId: number | null = null;
      for (const cardOption of cardScores) {
        const pickData: DraftPickInsert = {
          session_id: sessionId,
          player_id: player.id,
          card_id: cardOption.cardId,
          pack_number: session.current_pack,
          pick_number: session.current_pick,
          pick_time_seconds: session.timer_seconds,
          was_auto_pick: true,
        };

        const { error: pickError } = await supabase.from('draft_picks').insert(pickData);

        if (!pickError) {
          // Success - this card was picked
          pickedCardId = cardOption.cardId;
          console.log(`[checkAndAutoPickTimedOut] ${player.name} auto-picked card ${pickedCardId}`);
          break;
        } else if (pickError.code === '23505') {
          // Unique constraint violation
          if (pickError.message?.includes('card_id')) {
            // Card already picked by someone else - try next card
            console.log(`[checkAndAutoPickTimedOut] Card ${cardOption.cardId} already picked, trying next`);
            continue;
          } else {
            // Player already has a pick for this round - another process handled it
            // IMPORTANT: Don't update hand (we don't know which card), but DO mark pick_made = true
            console.log(`[checkAndAutoPickTimedOut] ${player.name} pick already recorded, marking pick_made=true`);
            await supabase
              .from('draft_players')
              .update({ pick_made: true })
              .eq('id', player.id);
            break;
          }
        } else {
          // Some other error - log and try next card
          console.error(`[checkAndAutoPickTimedOut] Error picking card ${cardOption.cardId}:`, pickError);
          continue;
        }
      }

      // Only update hand if we successfully picked a card
      if (!pickedCardId) {
        console.log(`[checkAndAutoPickTimedOut] ${player.name} - no card picked in this attempt`);
        continue;
      }

      // Update hand to remove the picked card
      const newHand = currentHand.filter((id: number) => id !== pickedCardId);
      await supabase
        .from('draft_players')
        .update({ current_hand: newHand, pick_made: true })
        .eq('id', player.id);

      autoPickedNames.push(player.name);
    }

    // Always trigger bot picks and check completion
    // (bots might not have picked even if no human was auto-picked)
    await this.makeBotPicks(sessionId, '', session.current_pack, session.current_pick);

    // Now check if all players have picked
    const { data: allPlayers } = await supabase
      .from('draft_players')
      .select()
      .eq('session_id', sessionId);

    const allPicked = allPlayers?.every((p) => p.pick_made);

    if (allPicked) {
      // Pass packs to next player
      await this.passPacks(sessionId);
    }

    return {
      autoPickedCount: autoPickedNames.length,
      autoPickedNames,
    };
  },

  /**
   * Auto-pause when host disconnects (can be called by any player)
   * This is a safety measure to prevent the draft from continuing without the host
   */
  async autoPauseForHostDisconnect(sessionId: string, currentTimeRemaining?: number): Promise<void> {
    const supabase = getSupabase();

    // Get current session state
    const { data: session } = await supabase
      .from('draft_sessions')
      .select('paused, status')
      .eq('id', sessionId)
      .single();

    if (!session || session.status !== 'in_progress' || session.paused) {
      return; // Already paused or not in progress
    }

    // Pause the session and save time remaining
    const updateData: { paused: boolean; time_remaining_at_pause?: number } = {
      paused: true,
    };

    if (currentTimeRemaining !== undefined) {
      updateData.time_remaining_at_pause = currentTimeRemaining;
    }

    await supabase
      .from('draft_sessions')
      .update(updateData)
      .eq('id', sessionId);
  },

  /**
   * Check if the user has an active session they can rejoin.
   * Uses localStorage to track sessions - database fallback disabled temporarily.
   * Returns session info if found, null otherwise.
   */
  async getActiveSession(): Promise<{
    sessionId: string;
    roomCode: string;
    status: 'waiting' | 'in_progress';
    cubeId: string;
    mode: string;
  } | null> {
    const lastSession = getLastSession();
    if (!lastSession) return null;

    // Verify session is still active via draft_sessions (this table works)
    try {
      const supabase = getSupabase();
      const { data: session } = await supabase
        .from('draft_sessions')
        .select('id, room_code, status, cube_id, mode')
        .eq('id', lastSession.sessionId)
        .in('status', ['waiting', 'in_progress'])
        .single();

      if (session) {
        return {
          sessionId: session.id,
          roomCode: session.room_code,
          status: session.status,
          cubeId: session.cube_id,
          mode: session.mode,
        };
      }
    } catch {
      // Table may not be accessible yet
    }

    // Session not found or expired - clear localStorage
    clearLastSession();
    return null;
  },

  /**
   * Add a bot to a multiplayer session (host only).
   * Returns the new bot player record.
   */
  async addBotToSession(sessionId: string): Promise<DraftPlayerRow> {
    const supabase = getSupabase();
    const userId = getUserId();

    // Get session and verify host
    const { data: session, error: sessionError } = await supabase
      .from('draft_sessions')
      .select()
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error('Session not found');
    }

    if (session.host_id !== userId) {
      throw new Error('Only the host can add bots');
    }

    if (session.status !== 'waiting') {
      throw new Error('Can only add bots before draft starts');
    }

    // Get current player count
    const { data: players, error: playersError } = await supabase
      .from('draft_players')
      .select()
      .eq('session_id', sessionId)
      .order('seat_position');

    if (playersError) {
      throw new Error('Failed to fetch players');
    }

    if (players.length >= session.player_count) {
      throw new Error('Room is full');
    }

    // Find next available seat
    const takenSeats = new Set(players.map(p => p.seat_position));
    let nextSeat = 0;
    while (takenSeats.has(nextSeat)) {
      nextSeat++;
    }

    // Get bot names from game config
    const gameConfig = getActiveGameConfig();
    const botNames = gameConfig.botNames || [
      'Bot 1', 'Bot 2', 'Bot 3', 'Bot 4', 'Bot 5', 'Bot 6',
      'Bot 7', 'Bot 8', 'Bot 9', 'Bot 10', 'Bot 11', 'Bot 12'
    ];

    // Count existing bots to get a unique name
    const existingBots = players.filter(p => p.is_bot);
    const botIndex = existingBots.length;

    const botData: DraftPlayerInsert = {
      session_id: sessionId,
      user_id: `bot-mp-${Date.now()}-${botIndex}`,
      name: botNames[botIndex % botNames.length],
      seat_position: nextSeat,
      is_host: false,
      is_bot: true,
      is_connected: true,
      current_hand: [],
      pick_made: false,
    };

    const { data: bot, error: botError } = await supabase
      .from('draft_players')
      .insert(botData)
      .select()
      .single();

    if (botError || !bot) {
      throw new Error('Failed to add bot');
    }

    return bot;
  },

  /**
   * Remove a bot from a multiplayer session (host only).
   */
  async removeBotFromSession(sessionId: string, botPlayerId: string): Promise<void> {
    const supabase = getSupabase();
    const userId = getUserId();

    // Get session and verify host
    const { data: session, error: sessionError } = await supabase
      .from('draft_sessions')
      .select()
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error('Session not found');
    }

    if (session.host_id !== userId) {
      throw new Error('Only the host can remove bots');
    }

    if (session.status !== 'waiting') {
      throw new Error('Can only remove bots before draft starts');
    }

    // Verify it's actually a bot
    const { data: player, error: playerError } = await supabase
      .from('draft_players')
      .select()
      .eq('id', botPlayerId)
      .eq('session_id', sessionId)
      .single();

    if (playerError || !player) {
      throw new Error('Player not found');
    }

    if (!player.is_bot) {
      throw new Error('Can only remove bot players');
    }

    // Delete the bot
    const { error: deleteError } = await supabase
      .from('draft_players')
      .delete()
      .eq('id', botPlayerId);

    if (deleteError) {
      throw new Error('Failed to remove bot');
    }
  },

  /**
   * Cancel and delete a draft session.
   * Only the host can cancel a session.
   * This deletes all related data from the database.
   */
  async cancelSession(sessionId: string): Promise<void> {
    const supabase = getSupabase();
    const userId = getUserId();

    // Verify user is the host
    const { data: player } = await supabase
      .from('draft_players')
      .select('is_host')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (!player?.is_host) {
      throw new Error('Only the host can cancel the session');
    }

    // First, update session status to 'cancelled' so realtime subscribers are notified
    const { error: updateError } = await supabase
      .from('draft_sessions')
      .update({ status: 'cancelled' })
      .eq('id', sessionId);

    if (updateError) {
      throw new Error(`Failed to update session status: ${updateError.message}`);
    }

    // Small delay to ensure realtime updates propagate
    await new Promise(resolve => setTimeout(resolve, 500));

    // Delete in order due to foreign key constraints:
    // 1. Delete picks (references players)
    await supabase
      .from('draft_picks')
      .delete()
      .eq('session_id', sessionId);

    // 2. Delete pack cards
    await supabase
      .from('draft_pack_cards')
      .delete()
      .eq('session_id', sessionId);

    // 3. Delete players
    await supabase
      .from('draft_players')
      .delete()
      .eq('session_id', sessionId);

    // 4. Finally delete the session
    await supabase
      .from('draft_sessions')
      .delete()
      .eq('id', sessionId);

    // Clear local session storage
    clearLastSession();
  },

  /**
   * Get completed drafts for a user (by auth user ID or anonymous user ID)
   * Returns recent completed drafts with session and cube info
   */
  async getUserDraftHistory(authUserId?: string, limit: number = 10): Promise<{
    sessionId: string;
    roomCode: string;
    cubeName: string;
    cubeId: string;
    completedAt: string;
    playerCount: number;
    cardsPerPlayer: number;
  }[]> {
    const supabase = getSupabase();
    const anonymousId = getUserId();

    // Check both auth user ID and anonymous browser ID
    // (drafts may have been created before user logged in, or user_id might be the anonymous one)
    const userIds = authUserId ? [authUserId, anonymousId] : [anonymousId];

    console.log('[DraftHistory] Looking up drafts for userIds:', userIds, '(auth:', authUserId, ', anon:', anonymousId, ')');

    // Find sessions where this user was a player and status is completed
    const { data: playerRecords, error: playerError } = await supabase
      .from('draft_players')
      .select('session_id')
      .in('user_id', userIds)
      .eq('is_bot', false);

    if (playerError) {
      console.error('[DraftHistory] Error fetching player records:', playerError);
      return [];
    }

    if (!playerRecords || playerRecords.length === 0) {
      console.log('[DraftHistory] No player records found');
      return [];
    }

    const sessionIds = playerRecords.map(p => p.session_id);
    console.log('[DraftHistory] Found session IDs:', sessionIds);

    // Get completed sessions (without cube join - we'll resolve cube names separately)
    const { data: sessions, error: sessionError } = await supabase
      .from('draft_sessions')
      .select('id, room_code, cube_id, completed_at, player_count, cards_per_player')
      .in('id', sessionIds)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(limit);

    if (sessionError) {
      console.error('[DraftHistory] Error fetching sessions:', sessionError);
      return [];
    }

    if (!sessions || sessions.length === 0) {
      console.log('[DraftHistory] No completed sessions found');
      return [];
    }

    console.log('[DraftHistory] Found completed sessions:', sessions.length);

    // Resolve cube names - handle both local cubes and database cubes
    const results = await Promise.all(sessions.map(async (s) => {
      let cubeName = 'Unknown Cube';

      if (cubeService.isDatabaseCube(s.cube_id)) {
        // Database cube - query the cubes table
        const dbId = s.cube_id.replace('db:', '');
        const { data: cube } = await supabase
          .from('cubes')
          .select('name')
          .eq('id', dbId)
          .single();
        if (cube) {
          cubeName = cube.name;
        }
      } else {
        // Local cube - look up from available cubes list
        const availableCubes = cubeService.getAvailableCubes();
        const localCube = availableCubes.find(c => c.id === s.cube_id);
        if (localCube) {
          cubeName = localCube.name;
        }
      }

      return {
        sessionId: s.id,
        roomCode: s.room_code,
        cubeName,
        cubeId: s.cube_id,
        completedAt: s.completed_at!,
        playerCount: s.player_count,
        cardsPerPlayer: s.cards_per_player,
      };
    }));

    console.log('[DraftHistory] Returning results:', results.length);
    return results;
  },

  /**
   * Admin: Get all recent completed drafts (regardless of user)
   * Returns recent completed drafts with session, cube, and player info
   */
  async getRecentDraftsAdmin(limit: number = 20): Promise<{
    sessionId: string;
    roomCode: string;
    cubeName: string;
    cubeId: string;
    completedAt: string;
    playerCount: number;
    cardsPerPlayer: number;
    players: { id: string; name: string; isBot: boolean }[];
  }[]> {
    const supabase = getSupabase();

    // Get recent completed sessions
    const { data: sessions, error: sessionError } = await supabase
      .from('draft_sessions')
      .select('id, room_code, cube_id, completed_at, player_count, cards_per_player')
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(limit);

    if (sessionError) {
      console.error('[AdminDrafts] Error fetching sessions:', sessionError);
      return [];
    }

    if (!sessions || sessions.length === 0) {
      return [];
    }

    // Resolve cube names and get players for each session
    const results = await Promise.all(sessions.map(async (s) => {
      let cubeName = 'Unknown Cube';

      if (cubeService.isDatabaseCube(s.cube_id)) {
        const dbId = s.cube_id.replace('db:', '');
        const { data: cube } = await supabase
          .from('cubes')
          .select('name')
          .eq('id', dbId)
          .single();
        if (cube) {
          cubeName = cube.name;
        }
      } else {
        const availableCubes = cubeService.getAvailableCubes();
        const localCube = availableCubes.find(c => c.id === s.cube_id);
        if (localCube) {
          cubeName = localCube.name;
        }
      }

      // Get players for this session
      const { data: players } = await supabase
        .from('draft_players')
        .select('id, name, is_bot')
        .eq('session_id', s.id)
        .eq('is_bot', false)
        .order('seat_position', { ascending: true });

      return {
        sessionId: s.id,
        roomCode: s.room_code,
        cubeName,
        cubeId: s.cube_id,
        completedAt: s.completed_at!,
        playerCount: s.player_count,
        cardsPerPlayer: s.cards_per_player,
        players: (players || []).map(p => ({
          id: p.id,
          name: p.name,
          isBot: p.is_bot,
        })),
      };
    }));

    return results;
  },
};
