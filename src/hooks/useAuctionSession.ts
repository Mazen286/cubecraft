// Hook for managing auction grid draft sessions
// Provides real-time state management and auction actions

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { isResumeCountdownActive } from './useResumeCountdown';
import { auctionService } from '../services/auctionService';
import { cubeService } from '../services/cubeService';
import { getActiveGameConfig } from '../context/GameContext';
import type { DraftSessionRow, DraftPlayerRow, GridData, AuctionStateData } from '../lib/database.types';
import type { YuGiOhCard, AuctionDraftPlayer, AuctionState } from '../types';

// Helper to get storage prefix from active game config (matches auctionService)
function getStoragePrefix(): string {
  try {
    return getActiveGameConfig().storageKeyPrefix;
  } catch {
    return 'yugioh-draft';
  }
}

// Helper to get user ID from localStorage
function getUserId(): string {
  const key = `${getStoragePrefix()}-user-id`;
  let userId = localStorage.getItem(key);
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem(key, userId);
  }
  return userId;
}

// Default bidding time per turn (seconds)
const DEFAULT_BID_TIME = 20;

interface UseAuctionSessionReturn {
  // Session state
  session: DraftSessionRow | null;
  players: AuctionDraftPlayer[];
  currentPlayer: AuctionDraftPlayer | null;
  isHost: boolean;

  // Grid state
  currentGrid: number;
  totalGrids: number;
  gridCards: YuGiOhCard[];
  remainingCardIds: number[];

  // Auction state
  auctionState: AuctionState | null;
  currentAuctionCard: YuGiOhCard | null;

  // Player state
  draftedCardIds: number[];
  isSelector: boolean;
  isMyBidTurn: boolean;
  hasMaxCards: boolean;
  maxCardsPerGrid: number;
  selectionTimeRemaining: number;
  bidTimeRemaining: number;
  totalBidTime: number;

  // Loading and errors
  isLoading: boolean;
  isCubeReady: boolean;
  error: string | null;

  // Actions
  startDraft: () => Promise<void>;
  selectCard: (cardId: number) => Promise<void>;
  placeBid: (amount: number) => Promise<void>;
  passBid: () => Promise<void>;
  togglePause: (currentTimeRemaining?: number) => Promise<boolean>;
}

export function useAuctionSession(sessionId: string | undefined): UseAuctionSessionReturn {
  // Core state
  const [session, setSession] = useState<DraftSessionRow | null>(null);
  const [players, setPlayers] = useState<DraftPlayerRow[]>([]);
  const [draftedCardIds, setDraftedCardIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCubeReady, setIsCubeReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectionTimeRemaining, setSelectionTimeRemaining] = useState(30);
  const [bidTimeRemaining, setBidTimeRemaining] = useState(DEFAULT_BID_TIME);

  const selectionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bidTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastBidderSeatRef = useRef<number | null>(null);

  // Derived state
  const userId = useMemo(() => getUserId(), []);

  const currentPlayer = useMemo(() => {
    return players.find(p => p.user_id === userId) || null;
  }, [players, userId]);

  const isHost = currentPlayer?.is_host ?? false;

  // Convert players to AuctionDraftPlayer format
  const auctionPlayers = useMemo((): AuctionDraftPlayer[] => {
    return players.map(p => ({
      id: p.id,
      sessionId: p.session_id,
      userId: p.user_id,
      name: p.name,
      seatPosition: p.seat_position,
      isHost: p.is_host,
      isConnected: true, // Assume connected for auction draft
      isBot: p.is_bot,
      draftedCards: [], // Will be populated from picks
      currentPack: [], // Not used in auction draft
      biddingPoints: p.bidding_points ?? 100,
      cardsAcquiredThisGrid: p.cards_acquired_this_grid ?? 0,
    }));
  }, [players]);

  const currentAuctionPlayer = useMemo(() => {
    return auctionPlayers.find(p => p.userId === userId) || null;
  }, [auctionPlayers, userId]);

  // Grid state
  const currentGrid = session?.current_grid ?? 1;

  const totalGrids = useMemo(() => {
    const grids = session?.grid_data as GridData[] | null;
    return grids?.length ?? 6;
  }, [session?.grid_data]);

  const gridData = useMemo((): GridData | null => {
    const grids = session?.grid_data as GridData[] | null;
    return grids?.find(g => g.gridNumber === currentGrid) || null;
  }, [session?.grid_data, currentGrid]);

  const gridCards = useMemo((): YuGiOhCard[] => {
    if (!gridData || !isCubeReady) return [];

    return gridData.cards
      .map(cardId => cubeService.getCardFromAnyCube(cardId))
      .filter((card): card is YuGiOhCard => card !== null);
  }, [gridData, isCubeReady]);

  const remainingCardIds = useMemo(() => {
    return gridData?.remainingCards ?? [];
  }, [gridData]);

  // Auction state
  const auctionStateData = session?.auction_state as AuctionStateData | null;

  const auctionState = useMemo((): AuctionState | null => {
    if (!auctionStateData) return null;

    return {
      phase: auctionStateData.phase,
      cardId: auctionStateData.cardId,
      currentBid: auctionStateData.currentBid,
      currentBidderId: auctionStateData.currentBidderId,
      bids: auctionStateData.bids.map(b => ({
        playerId: b.playerId,
        playerName: b.playerName,
        seatPosition: b.seatPosition,
        amount: b.amount,
        timestamp: b.timestamp,
      })),
      passedPlayerIds: auctionStateData.passedPlayerIds,
      nextBidderSeat: auctionStateData.nextBidderSeat,
    };
  }, [auctionStateData]);

  // Get bid timer setting from session (stored in auction_state)
  const configuredBidTime = auctionStateData?.bidTimerSeconds ?? DEFAULT_BID_TIME;

  const currentAuctionCard = useMemo((): YuGiOhCard | null => {
    if (!auctionState?.cardId || !isCubeReady) return null;
    return cubeService.getCardFromAnyCube(auctionState.cardId) || null;
  }, [auctionState?.cardId, isCubeReady]);

  // Max cards per grid (from session settings)
  const maxCardsPerGrid = session?.pack_size || 10;

  // Check if current player has reached max cards for this grid
  const hasMaxCards = useMemo(() => {
    if (!currentAuctionPlayer) return false;
    return currentAuctionPlayer.cardsAcquiredThisGrid >= maxCardsPerGrid;
  }, [currentAuctionPlayer, maxCardsPerGrid]);

  // Selector and bidder state
  const isSelector = useMemo(() => {
    if (!currentPlayer || session?.current_selector_seat === null) return false;
    return currentPlayer.seat_position === session?.current_selector_seat;
  }, [currentPlayer, session?.current_selector_seat]);

  const isMyBidTurn = useMemo(() => {
    if (!currentPlayer || !auctionState) return false;
    if (auctionState.phase !== 'bidding') return false;
    if (auctionState.passedPlayerIds.includes(currentPlayer.id)) return false;
    if (hasMaxCards) return false; // Can't bid if already at max cards
    return currentPlayer.seat_position === auctionState.nextBidderSeat;
  }, [currentPlayer, auctionState, hasMaxCards]);

  // Initial data fetch
  useEffect(() => {
    if (!sessionId) {
      setError('No session ID provided');
      setIsLoading(false);
      return;
    }

    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        // Fetch session
        const sessionData = await auctionService.getSession(sessionId);
        if (!sessionData) {
          setError('Session not found');
          return;
        }
        setSession(sessionData);

        // Fetch players
        const playersData = await auctionService.getPlayers(sessionId);
        setPlayers(playersData);

        // Find current player
        const player = playersData.find(p => p.user_id === userId);

        // Fetch drafted cards for current player
        if (player) {
          const cards = await auctionService.getPlayerDraftedCards(sessionId, player.id);
          setDraftedCardIds(cards);
        }

        // Preload cube
        if (sessionData.cube_id) {
          await cubeService.preloadCube(sessionData.cube_id);
          setIsCubeReady(true);
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, [sessionId, userId]);

  // Real-time subscription
  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = auctionService.subscribeToSession(
      sessionId,
      (updatedSession) => {
        setSession(updatedSession);
      },
      (updatedPlayers) => {
        setPlayers(updatedPlayers);
        // Update drafted cards for current player
        const player = updatedPlayers.find(p => p.user_id === userId);
        if (player) {
          auctionService.getPlayerDraftedCards(sessionId, player.id)
            .then(cards => setDraftedCardIds(cards))
            .catch(() => {});
        }
      },
      // When a pick is inserted, refresh the current player's drafted cards
      () => {
        const player = players.find(p => p.user_id === userId);
        if (player) {
          auctionService.getPlayerDraftedCards(sessionId, player.id)
            .then(cards => setDraftedCardIds(cards))
            .catch(() => {});
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [sessionId, userId, players]);

  // Selection timer
  useEffect(() => {
    // Clear existing timer
    if (selectionTimerRef.current) {
      clearInterval(selectionTimerRef.current);
      selectionTimerRef.current = null;
    }

    // If paused, show saved time
    if (session?.paused) {
      if (session.time_remaining_at_pause !== null && session.time_remaining_at_pause !== undefined) {
        setSelectionTimeRemaining(session.time_remaining_at_pause);
      }
      return;
    }

    // If resume countdown is active (resume_at is in the future), show saved time and wait
    if (isResumeCountdownActive(session?.resume_at)) {
      if (session?.time_remaining_at_pause !== null && session?.time_remaining_at_pause !== undefined) {
        setSelectionTimeRemaining(session.time_remaining_at_pause);
      }
      return;
    }

    // Only run timer during selection phase
    if (auctionState?.phase !== 'selecting' || !session?.selection_started_at) {
      setSelectionTimeRemaining(30);
      return;
    }

    const timerDuration = session.timer_seconds || 30;
    const startTime = new Date(session.selection_started_at).getTime();

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, timerDuration - elapsed);
      setSelectionTimeRemaining(remaining);
    };

    updateTimer();
    selectionTimerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (selectionTimerRef.current) {
        clearInterval(selectionTimerRef.current);
      }
    };
  }, [auctionState?.phase, session?.selection_started_at, session?.timer_seconds, session?.paused, session?.time_remaining_at_pause, session?.resume_at]);

  // Bidding timer - uses server timestamp for accuracy
  useEffect(() => {
    // Clear existing timer
    if (bidTimerRef.current) {
      clearInterval(bidTimerRef.current);
      bidTimerRef.current = null;
    }

    // If paused, show saved time
    if (session?.paused) {
      if (session.time_remaining_at_pause !== null && session.time_remaining_at_pause !== undefined) {
        setBidTimeRemaining(session.time_remaining_at_pause);
      }
      return;
    }

    // If resume countdown is active (resume_at is in the future), show saved time and wait
    if (isResumeCountdownActive(session?.resume_at)) {
      if (session?.time_remaining_at_pause !== null && session?.time_remaining_at_pause !== undefined) {
        setBidTimeRemaining(session.time_remaining_at_pause);
      }
      return;
    }

    // Only run timer during bidding phase
    if (auctionState?.phase !== 'bidding' || !auctionStateData?.bidStartedAt) {
      setBidTimeRemaining(configuredBidTime);
      lastBidderSeatRef.current = null;
      return;
    }

    const bidStartTime = new Date(auctionStateData.bidStartedAt).getTime();

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - bidStartTime) / 1000);
      const remaining = Math.max(0, configuredBidTime - elapsed);
      setBidTimeRemaining(remaining);
    };

    // Update immediately and then every second
    updateTimer();
    bidTimerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (bidTimerRef.current) {
        clearInterval(bidTimerRef.current);
      }
    };
  }, [auctionState?.phase, auctionStateData?.bidStartedAt, configuredBidTime, session?.paused, session?.time_remaining_at_pause, session?.resume_at]);

  // Auto-pass when bid time runs out (only for current player, not when paused)
  useEffect(() => {
    if (bidTimeRemaining === 0 && isMyBidTurn && sessionId && currentPlayer && !session?.paused) {
      // Auto-pass
      auctionService.passBid(sessionId, currentPlayer.id).catch(err => {
        console.error('[useAuctionSession] Auto-pass failed:', err);
      });
    }
  }, [bidTimeRemaining, isMyBidTurn, sessionId, currentPlayer, session?.paused]);

  // Server-side timeout check (fallback for stuck auctions, especially with bots)
  useEffect(() => {
    if (!sessionId || session?.status !== 'in_progress') return;
    if (auctionState?.phase !== 'bidding') return;

    // Check every 3 seconds for timed-out bidders
    const checkInterval = setInterval(() => {
      auctionService.checkAndAutoPassTimedOut(sessionId).catch(err => {
        console.error('[useAuctionSession] Timeout check failed:', err);
      });
    }, 3000);

    return () => clearInterval(checkInterval);
  }, [sessionId, session?.status, auctionState?.phase]);

  // Periodic sync fallback - catches missed Realtime updates
  // This ensures the UI stays in sync even if WebSocket updates are dropped
  useEffect(() => {
    if (!sessionId || session?.status !== 'in_progress') return;

    // Re-fetch session and players every 5 seconds as a fallback
    const syncInterval = setInterval(async () => {
      try {
        const [freshSession, freshPlayers] = await Promise.all([
          auctionService.getSession(sessionId),
          auctionService.getPlayers(sessionId),
        ]);

        if (freshSession) {
          // Only update if something actually changed
          const currentAuction = session?.auction_state as AuctionStateData | null;
          const freshAuction = freshSession.auction_state as AuctionStateData | null;

          const hasChanges =
            session?.current_grid !== freshSession.current_grid ||
            currentAuction?.phase !== freshAuction?.phase ||
            currentAuction?.cardId !== freshAuction?.cardId ||
            currentAuction?.currentBid !== freshAuction?.currentBid ||
            currentAuction?.nextBidderSeat !== freshAuction?.nextBidderSeat;

          if (hasChanges) {
            console.log('[useAuctionSession] Sync fallback detected changes, updating state');
            setSession(freshSession);
          }
        }

        if (freshPlayers) {
          setPlayers(freshPlayers);
        }
      } catch (err) {
        console.error('[useAuctionSession] Sync fallback failed:', err);
      }
    }, 5000);

    return () => clearInterval(syncInterval);
  }, [sessionId, session?.status, session?.current_grid, session?.auction_state]);

  // Actions
  const startDraft = useCallback(async () => {
    if (!sessionId) throw new Error('No session ID');
    await auctionService.startDraft(sessionId);
  }, [sessionId]);

  const selectCard = useCallback(async (cardId: number) => {
    if (!sessionId || !currentPlayer) throw new Error('Not ready');
    await auctionService.selectCardForAuction(sessionId, currentPlayer.id, cardId);
  }, [sessionId, currentPlayer]);

  const placeBid = useCallback(async (amount: number) => {
    if (!sessionId || !currentPlayer) throw new Error('Not ready');
    await auctionService.placeBid(sessionId, currentPlayer.id, amount);
  }, [sessionId, currentPlayer]);

  const passBid = useCallback(async () => {
    if (!sessionId || !currentPlayer) throw new Error('Not ready');
    await auctionService.passBid(sessionId, currentPlayer.id);
  }, [sessionId, currentPlayer]);

  const togglePause = useCallback(async (currentTimeRemaining?: number): Promise<boolean> => {
    if (!sessionId) throw new Error('Not ready');
    return await auctionService.togglePause(sessionId, currentTimeRemaining);
  }, [sessionId]);

  return {
    session,
    players: auctionPlayers,
    currentPlayer: currentAuctionPlayer,
    isHost,
    currentGrid,
    totalGrids,
    gridCards,
    remainingCardIds,
    auctionState,
    currentAuctionCard,
    draftedCardIds,
    isSelector,
    isMyBidTurn,
    hasMaxCards,
    maxCardsPerGrid,
    selectionTimeRemaining,
    bidTimeRemaining,
    totalBidTime: configuredBidTime,
    isLoading,
    isCubeReady,
    error,
    startDraft,
    selectCard,
    placeBid,
    passBid,
    togglePause,
  };
}
