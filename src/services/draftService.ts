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
   * When pausing: saves the time remaining
   * When resuming: clears the saved time (countdown handled client-side)
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

    // When pausing: save the time remaining so we can restore it
    // When resuming: clear the saved time (timer resumes from saved value after countdown)
    const updateData: { paused: boolean; time_remaining_at_pause?: number | null } = {
      paused: newPausedState,
    };

    if (newPausedState && currentTimeRemaining !== undefined) {
      // Pausing - save current time remaining
      updateData.time_remaining_at_pause = currentTimeRemaining;
    } else if (!newPausedState) {
      // Resuming - keep the saved time (don't clear it yet, client needs it for countdown)
      // The time will be used by clients after the 5-second countdown
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

    // Record the pick with timing metrics
    const pickData: DraftPickInsert = {
      session_id: sessionId,
      player_id: playerId,
      card_id: cardId,
      pack_number: session.current_pack,
      pick_number: session.current_pick,
      pick_time_seconds: pickTimeSeconds,
      was_auto_pick: wasAutoPick,
    };

    await supabase.from('draft_picks').insert(pickData);

    // Remove card from hand and mark pick made
    const newHand = player.current_hand.filter((id: number) => id !== cardId);
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
   */
  async makeBotPicks(
    sessionId: string,
    _cubeId: string, // Reserved for future cube-specific AI strategies
    packNumber: number,
    pickNumber: number
  ): Promise<void> {
    const supabase = getSupabase();

    // Get all bot players who haven't picked yet
    const { data: bots } = await supabase
      .from('draft_players')
      .select()
      .eq('session_id', sessionId)
      .eq('is_bot', true)
      .eq('pick_made', false);

    if (!bots || bots.length === 0) return;

    for (const bot of bots) {
      if (bot.current_hand.length === 0) continue;

      // Get card scores and pick the highest
      const cardScores: { cardId: number; score: number }[] = bot.current_hand.map((cardId: number) => {
        const card = cubeService.getCardFromAnyCube(cardId);
        return {
          cardId,
          score: card?.score ?? 50, // Default to 50 if no score
        };
      });

      // Sort by score descending and pick the best
      cardScores.sort((a, b) => b.score - a.score);
      const bestCard = cardScores[0];

      // Record the pick (bots have 0 pick time and are marked as auto-picks)
      const pickData: DraftPickInsert = {
        session_id: sessionId,
        player_id: bot.id,
        card_id: bestCard.cardId,
        pack_number: packNumber,
        pick_number: pickNumber,
        pick_time_seconds: 0,
        was_auto_pick: true,
      };

      await supabase.from('draft_picks').insert(pickData);

      // Remove card from hand and mark pick made
      const newHand = bot.current_hand.filter((id: number) => id !== bestCard.cardId);
      await supabase
        .from('draft_players')
        .update({ current_hand: newHand, pick_made: true })
        .eq('id', bot.id);
    }
  },

  /**
   * Pass packs to next player (called when all players have picked)
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
        // Draft complete
        await supabase
          .from('draft_sessions')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', sessionId);
        return;
      }

      // Start next pack - use pack_number to find the right pack
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

      // Update session - alternate direction each pack and reset pick timer
      await supabase
        .from('draft_sessions')
        .update({
          current_pack: session.current_pack + 1,
          current_pick: 1,
          direction: isLeftDirection ? 'right' : 'left',
          pick_started_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
    } else {
      // Pass hands to next player
      const hands: { [seat: number]: number[] } = {};
      players.forEach((p) => {
        hands[p.seat_position] = p.current_hand;
      });

      for (const player of players) {
        const sourceSeat = isLeftDirection
          ? (player.seat_position + 1) % playerCount
          : (player.seat_position - 1 + playerCount) % playerCount;

        await supabase
          .from('draft_players')
          .update({ current_hand: hands[sourceSeat], pick_made: false })
          .eq('id', player.id);
      }

      // Update pick number and reset pick timer
      await supabase
        .from('draft_sessions')
        .update({
          current_pick: session.current_pick + 1,
          pick_started_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
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

    if (!session || session.status !== 'in_progress' || session.paused) {
      return { autoPickedCount: 0, autoPickedNames: [] };
    }

    // Check if pick has timed out
    if (!session.pick_started_at) {
      return { autoPickedCount: 0, autoPickedNames: [] };
    }

    const pickStartedAt = new Date(session.pick_started_at).getTime();
    const now = Date.now();
    const elapsedSeconds = (now - pickStartedAt) / 1000;
    const timeoutThreshold = session.timer_seconds + GRACE_PERIOD_SECONDS;

    if (elapsedSeconds < timeoutThreshold) {
      return { autoPickedCount: 0, autoPickedNames: [] };
    }

    // Get all players who haven't picked
    const { data: playersNeedingPick } = await supabase
      .from('draft_players')
      .select()
      .eq('session_id', sessionId)
      .eq('pick_made', false);

    if (!playersNeedingPick || playersNeedingPick.length === 0) {
      return { autoPickedCount: 0, autoPickedNames: [] };
    }

    const autoPickedNames: string[] = [];

    // Auto-pick for each player who hasn't picked
    for (const player of playersNeedingPick) {
      if (player.current_hand.length === 0) continue;

      // Get card scores and pick the highest
      const cardScores: { cardId: number; score: number }[] = player.current_hand.map((cardId: number) => {
        const card = cubeService.getCardFromAnyCube(cardId);
        return {
          cardId,
          score: card?.score ?? 50,
        };
      });

      cardScores.sort((a, b) => b.score - a.score);
      const bestCard = cardScores[0];

      // Record the pick as auto-pick with full timer duration
      const pickData: DraftPickInsert = {
        session_id: sessionId,
        player_id: player.id,
        card_id: bestCard.cardId,
        pack_number: session.current_pack,
        pick_number: session.current_pick,
        pick_time_seconds: session.timer_seconds,
        was_auto_pick: true,
      };

      await supabase.from('draft_picks').insert(pickData);

      // Remove card from hand and mark pick made
      const newHand = player.current_hand.filter((id: number) => id !== bestCard.cardId);
      await supabase
        .from('draft_players')
        .update({ current_hand: newHand, pick_made: true })
        .eq('id', player.id);

      autoPickedNames.push(player.name);
    }

    // If we auto-picked for anyone, check if all players have now picked
    if (autoPickedNames.length > 0) {
      const { data: allPlayers } = await supabase
        .from('draft_players')
        .select()
        .eq('session_id', sessionId);

      const allPicked = allPlayers?.every((p) => p.pick_made);

      if (allPicked) {
        // Pass packs to next player
        await this.passPacks(sessionId);
      }
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
  } | null> {
    const lastSession = getLastSession();
    if (!lastSession) return null;

    // Verify session is still active via draft_sessions (this table works)
    try {
      const supabase = getSupabase();
      const { data: session } = await supabase
        .from('draft_sessions')
        .select('id, room_code, status, cube_id')
        .eq('id', lastSession.sessionId)
        .in('status', ['waiting', 'in_progress'])
        .single();

      if (session) {
        return {
          sessionId: session.id,
          roomCode: session.room_code,
          status: session.status,
          cubeId: session.cube_id,
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
    await supabase
      .from('draft_sessions')
      .update({ status: 'cancelled' })
      .eq('id', sessionId);

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
};
