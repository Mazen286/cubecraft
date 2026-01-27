import { useState, useEffect, useCallback, useRef } from 'react';
import { draftService, setLastSession, clearLastSession } from '../services/draftService';
import { auctionService } from '../services/auctionService';
import { cubeService } from '../services/cubeService';
import type { DraftSessionRow, DraftPlayerRow } from '../lib/database.types';
import type { DraftSettings } from '../types';

interface UseDraftSessionReturn {
  // State
  session: DraftSessionRow | null;
  players: DraftPlayerRow[];
  currentPlayer: DraftPlayerRow | null;
  draftedCardIds: number[];
  isHost: boolean;
  isLoading: boolean;
  isCubeReady: boolean; // True when cube data is preloaded and ready
  error: string | null;

  // Actions
  createSession: (settings: DraftSettings, cubeId: string, cubeCardIds: number[]) => Promise<string>;
  joinSession: (roomCode: string) => Promise<string>;
  startDraft: () => Promise<void>;
  makePick: (cardId: number, pickTimeSeconds?: number, wasAutoPick?: boolean) => Promise<void>;
  togglePause: (currentTimeRemaining?: number) => Promise<void>;
  checkTimeouts: () => Promise<{ autoPickedCount: number; autoPickedNames: string[] }>;
  clearError: () => void;
}

export function useDraftSession(sessionId?: string): UseDraftSessionReturn {
  const [session, setSession] = useState<DraftSessionRow | null>(null);
  const [players, setPlayers] = useState<DraftPlayerRow[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<DraftPlayerRow | null>(null);
  const [draftedCardIds, setDraftedCardIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCubeReady, setIsCubeReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const userId = draftService.getUserId();
  const isHost = session?.host_id === userId;

  // Load session data
  const loadSessionData = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const [sessionData, playersData, playerData] = await Promise.all([
        draftService.getSession(id),
        draftService.getPlayers(id),
        draftService.getCurrentPlayer(id),
      ]);

      setSession(sessionData);
      setPlayers(playersData);
      setCurrentPlayer(playerData);

      // Save session for rejoin functionality (in case user navigated directly or refreshed)
      if (sessionData && playerData && sessionData.status !== 'completed') {
        setLastSession(sessionData.id, sessionData.room_code);
      }

      if (playerData) {
        const picks = await draftService.getPlayerPicks(id, playerData.id);
        setDraftedCardIds(picks);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!sessionId) return;

    loadSessionData(sessionId);

    // Set up real-time subscription
    unsubscribeRef.current = draftService.subscribeToSession(
      sessionId,
      (updatedSession) => {
        setSession(updatedSession);
      },
      (updatedPlayers) => {
        setPlayers(updatedPlayers);
        // Update current player from the list
        const me = updatedPlayers.find((p) => p.user_id === userId);
        if (me) {
          setCurrentPlayer(me);
        }
      }
    );

    // Set up heartbeat to maintain connection status
    heartbeatRef.current = setInterval(async () => {
      const player = await draftService.getCurrentPlayer(sessionId);
      if (player) {
        await draftService.updateConnectionStatus(player.id, true);
      }
    }, 30000); // Every 30 seconds

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [sessionId, loadSessionData, userId]);

  // Periodic sync fallback - catches missed Realtime updates (especially pause/resume)
  // This ensures the UI stays in sync even if WebSocket updates are dropped
  useEffect(() => {
    if (!sessionId || session?.status !== 'in_progress') return;

    // Re-fetch session every 5 seconds as a fallback
    const syncInterval = setInterval(async () => {
      try {
        const freshSession = await draftService.getSession(sessionId);

        if (freshSession) {
          // Check for changes that matter (especially pause state)
          const hasChanges =
            session?.current_pack !== freshSession.current_pack ||
            session?.current_pick !== freshSession.current_pick ||
            session?.paused !== freshSession.paused ||
            session?.resume_at !== freshSession.resume_at ||
            session?.time_remaining_at_pause !== freshSession.time_remaining_at_pause ||
            session?.status !== freshSession.status;

          if (hasChanges) {
            console.log('[useDraftSession] Sync fallback detected changes, updating state');
            setSession(freshSession);
          }
        }
      } catch (err) {
        console.error('[useDraftSession] Sync fallback failed:', err);
      }
    }, 5000);

    return () => clearInterval(syncInterval);
  }, [sessionId, session?.status, session?.current_pack, session?.current_pick, session?.paused, session?.resume_at, session?.time_remaining_at_pause]);

  // Preload cube data when session is loaded (so cards are ready before timer starts)
  useEffect(() => {
    if (!session?.cube_id) {
      setIsCubeReady(false);
      return;
    }

    // Check if already loaded
    if (cubeService.isCubeLoaded(session.cube_id)) {
      setIsCubeReady(true);
      return;
    }

    // Preload the cube
    cubeService.preloadCube(session.cube_id)
      .then(() => {
        setIsCubeReady(true);
      })
      .catch((err) => {
        setError(`Failed to load card data: ${err instanceof Error ? err.message : 'Unknown error'}`);
      });
  }, [session?.cube_id]);

  // Refetch picks when session status changes to in_progress (only on status change, not player updates)
  const prevStatusRef = useRef(session?.status);
  useEffect(() => {
    // Only fetch picks when transitioning TO in_progress status
    if (session?.status === 'in_progress' && prevStatusRef.current !== 'in_progress' && currentPlayer) {
      draftService.getPlayerPicks(session.id, currentPlayer.id).then(setDraftedCardIds);
    }
    // Clear saved session when draft completes
    if (session?.status === 'completed' && prevStatusRef.current !== 'completed') {
      clearLastSession();
    }
    prevStatusRef.current = session?.status;
  }, [session?.status, session?.id, currentPlayer?.id]);

  // Create a new session
  const createSession = useCallback(
    async (settings: DraftSettings, cubeId: string, cubeCardIds: number[]): Promise<string> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await draftService.createSession(settings, cubeId, cubeCardIds);
        setSession(result.session);
        setCurrentPlayer(result.player);
        setPlayers([result.player]);
        // Save session for rejoin functionality
        setLastSession(result.session.id, result.roomCode);
        return result.session.id;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create session';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Join an existing session
  const joinSession = useCallback(async (roomCode: string): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await draftService.joinSession(roomCode);
      setSession(result.session);
      setCurrentPlayer(result.player);

      // Load all players
      const allPlayers = await draftService.getPlayers(result.session.id);
      setPlayers(allPlayers);

      // Save session for rejoin functionality
      setLastSession(result.session.id, result.session.room_code);
      return result.session.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join session';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Start the draft (host only)
  const startDraft = useCallback(async (): Promise<void> => {
    if (!session) return;

    setIsLoading(true);
    setError(null);

    try {
      // Use appropriate service based on mode
      // Both auction-grid and open modes use grid-based drafting via auctionService
      if (session.mode === 'auction-grid' || session.mode === 'open') {
        await auctionService.startDraft(session.id);
      } else {
        await draftService.startDraft(session.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start draft';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  // Make a pick
  const makePick = useCallback(
    async (cardId: number, pickTimeSeconds: number = 0, wasAutoPick: boolean = false): Promise<void> => {
      if (!session || !currentPlayer) return;

      setIsLoading(true);
      setError(null);

      try {
        await draftService.makePick(session.id, currentPlayer.id, cardId, pickTimeSeconds, wasAutoPick);
        // Add card to drafted list, ensuring no duplicates
        setDraftedCardIds((prev) => prev.includes(cardId) ? prev : [...prev, cardId]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to make pick';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [session, currentPlayer]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Toggle pause (host only) - pass current time remaining when pausing
  const togglePause = useCallback(async (currentTimeRemaining?: number): Promise<void> => {
    if (!session) return;

    try {
      await draftService.togglePause(session.id, currentTimeRemaining);

      // Immediately fetch fresh session to ensure host's UI updates
      // Don't rely solely on real-time subscription which may not fire for own changes
      const freshSession = await draftService.getSession(session.id);
      if (freshSession) {
        setSession(freshSession);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to toggle pause';
      setError(message);
      throw err;
    }
  }, [session]);

  // Check for timed-out players and auto-pick for them
  const checkTimeouts = useCallback(async (): Promise<{ autoPickedCount: number; autoPickedNames: string[] }> => {
    if (!session || session.status !== 'in_progress' || session.paused) {
      return { autoPickedCount: 0, autoPickedNames: [] };
    }

    try {
      return await draftService.checkAndAutoPickTimedOut(session.id);
    } catch (err) {
      // Don't set error for timeout checks - they're background operations
      if (import.meta.env.DEV) {
        console.error('[useDraftSession] Timeout check failed:', err);
      }
      return { autoPickedCount: 0, autoPickedNames: [] };
    }
  }, [session]);

  return {
    session,
    players,
    currentPlayer,
    draftedCardIds,
    isHost,
    isLoading,
    isCubeReady,
    error,
    createSession,
    joinSession,
    startDraft,
    makePick,
    togglePause,
    checkTimeouts,
    clearError,
  };
}
