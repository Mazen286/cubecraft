import { useEffect, useRef, useCallback } from 'react';
import { draftService } from '../services/draftService';

// Staleness threshold for fallback detection
// If last_seen_at is older than this, consider disconnected even if is_connected is true
const STALENESS_THRESHOLD_MS = 45000; // 45 seconds

// Support both snake_case (from DB) and camelCase (from app types)
interface Player {
  is_host?: boolean;
  is_connected?: boolean;
  is_bot?: boolean;
  last_seen_at?: string;
  // camelCase alternatives
  isHost?: boolean;
  isConnected?: boolean;
  isBot?: boolean;
  lastSeenAt?: string;
}

interface UseHostDisconnectPauseOptions {
  /** Session ID for auto-pause functionality */
  sessionId: string | undefined;
  /** Session status ('waiting', 'in_progress', 'completed', etc.) */
  sessionStatus: string | undefined;
  /** Whether the session is currently paused */
  sessionPaused: boolean | undefined;
  /** List of all players in the session */
  players: Player[];
  /** Whether the current user is the host */
  isHost: boolean;
  /** Current time remaining on the timer (for saving when pausing) */
  currentTimeRemaining?: number;
}

interface UseHostDisconnectPauseResult {
  /** The host player object */
  hostPlayer: Player | undefined;
  /** Whether the host is connected */
  isHostConnected: boolean;
  /** Whether the pause was triggered by host disconnect */
  isPausedDueToDisconnect: boolean;
}

/**
 * Check if a player is effectively connected.
 *
 * Logic:
 * 1. If is_connected === false → definitely disconnected (event fired)
 * 2. If is_connected === true → trust it, they're connected
 * 3. If is_connected is undefined → use staleness as fallback
 *
 * We trust the explicit is_connected flag because it's set by browser events
 * (visibility change, online/offline, unmount). Staleness is only a fallback
 * for legacy data or when events completely failed.
 */
// Helper to get property value supporting both naming conventions
function getIsConnected(player: Player): boolean | undefined {
  return player.is_connected ?? player.isConnected;
}

function getIsHost(player: Player): boolean | undefined {
  return player.is_host ?? player.isHost;
}

function getIsBot(player: Player): boolean | undefined {
  return player.is_bot ?? player.isBot;
}

function getLastSeenAt(player: Player): string | undefined {
  return player.last_seen_at ?? player.lastSeenAt;
}

function isPlayerEffectivelyConnected(player: Player | undefined): boolean {
  if (!player) return false;

  const isConnected = getIsConnected(player);

  // If explicitly marked as disconnected, they're disconnected
  if (isConnected === false) {
    return false;
  }

  // If explicitly marked as connected, trust it
  if (isConnected === true) {
    return true;
  }

  // is_connected is undefined/null - use staleness as fallback
  // This handles legacy data or cases where is_connected was never set
  const lastSeenAt = getLastSeenAt(player);
  if (lastSeenAt) {
    const lastSeen = new Date(lastSeenAt).getTime();
    const now = Date.now();
    const isStale = (now - lastSeen) > STALENESS_THRESHOLD_MS;

    if (isStale) {
      console.log(`[HostDisconnectPause] Player is_connected undefined, last seen ${Math.round((now - lastSeen) / 1000)}s ago (stale)`);
      return false;
    }
  }

  // is_connected is undefined but not stale, assume connected
  return true;
}

/**
 * Hook for detecting and handling host disconnection.
 *
 * Uses hybrid detection:
 * 1. Primary: is_connected flag (updated by useConnectionPresence events)
 * 2. Fallback: last_seen_at staleness (catches cases where events fail)
 *
 * When the host disconnects during an active draft, this hook will
 * automatically pause the draft to prevent the timer from continuing
 * without the host present.
 */
export function useHostDisconnectPause({
  sessionId,
  sessionStatus,
  sessionPaused,
  players,
  isHost,
  currentTimeRemaining,
}: UseHostDisconnectPauseOptions): UseHostDisconnectPauseResult {
  const prevHostConnected = useRef<boolean | undefined>(undefined);
  const autoPauseTriggeredRef = useRef(false);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Find the host player (support both naming conventions)
  const hostPlayer = players.find(p => getIsHost(p));

  // Check if host is connected using hybrid approach
  const isHostConnected = isPlayerEffectivelyConnected(hostPlayer);

  // Count human players (non-bot, support both naming conventions)
  const humanPlayerCount = players.filter(p => !getIsBot(p)).length;

  // Auto-pause callback
  const triggerAutoPause = useCallback(async () => {
    if (!sessionId || autoPauseTriggeredRef.current) return;

    autoPauseTriggeredRef.current = true;
    console.log('[HostDisconnectPause] Host disconnected, auto-pausing draft');

    try {
      await draftService.autoPauseForHostDisconnect(sessionId, currentTimeRemaining);
    } catch (error) {
      console.error('[HostDisconnectPause] Failed to auto-pause:', error);
      autoPauseTriggeredRef.current = false; // Allow retry on failure
    }
  }, [sessionId, currentTimeRemaining]);

  // Main detection effect - responds to player state changes
  useEffect(() => {
    const shouldMonitor =
      sessionStatus === 'in_progress' &&
      !sessionPaused &&
      humanPlayerCount > 1 &&
      !isHost &&
      hostPlayer;

    if (!shouldMonitor) {
      if (sessionPaused || sessionStatus !== 'in_progress') {
        autoPauseTriggeredRef.current = false;
      }
      return;
    }

    // Check for transition from connected to disconnected
    const wasConnected = prevHostConnected.current;
    const nowConnected = isHostConnected;

    // Update prev state
    prevHostConnected.current = nowConnected;

    // If host just disconnected (was connected, now isn't)
    if (wasConnected === true && nowConnected === false) {
      triggerAutoPause();
    }

    // Also trigger if host was never seen as connected but is now disconnected
    // This handles the case where we mount and host is already gone
    if (wasConnected === undefined && nowConnected === false && !autoPauseTriggeredRef.current) {
      console.log('[HostDisconnectPause] Host already disconnected on mount');
      triggerAutoPause();
    }
  }, [
    sessionStatus,
    sessionPaused,
    humanPlayerCount,
    isHost,
    hostPlayer,
    isHostConnected,
    triggerAutoPause,
  ]);

  // Periodic staleness check - fetches fresh data from DB to catch missed realtime updates
  useEffect(() => {
    const shouldMonitor =
      sessionStatus === 'in_progress' &&
      !sessionPaused &&
      humanPlayerCount > 1 &&
      !isHost &&
      sessionId;

    if (!shouldMonitor) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    // Check every 10 seconds - fetch fresh data from DB
    checkIntervalRef.current = setInterval(async () => {
      if (autoPauseTriggeredRef.current) return;

      try {
        // Fetch fresh player data directly from DB (don't rely on realtime)
        const freshPlayers = await draftService.getPlayers(sessionId);
        const host = freshPlayers.find((p: Player) => getIsHost(p));
        const connected = isPlayerEffectivelyConnected(host);

        console.log('[HostDisconnectPause] Periodic check:', {
          hostFound: !!host,
          isConnected: host?.is_connected,
          lastSeenAt: host?.last_seen_at,
          effectivelyConnected: connected,
        });

        if (!connected && !autoPauseTriggeredRef.current) {
          console.log('[HostDisconnectPause] Periodic check detected host disconnect');
          triggerAutoPause();
        }
      } catch (error) {
        console.error('[HostDisconnectPause] Periodic check failed:', error);
      }
    }, 10000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [sessionStatus, sessionPaused, humanPlayerCount, isHost, sessionId, triggerAutoPause]);

  // Reset auto-pause trigger when session resumes
  useEffect(() => {
    if (!sessionPaused) {
      autoPauseTriggeredRef.current = false;
    }
  }, [sessionPaused]);

  // Determine if current pause is due to host disconnect
  const isPausedDueToDisconnect = Boolean(
    sessionPaused && hostPlayer && !isPlayerEffectivelyConnected(hostPlayer)
  );

  return {
    hostPlayer,
    isHostConnected,
    isPausedDueToDisconnect,
  };
}
