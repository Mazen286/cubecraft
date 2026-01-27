import { useEffect, useRef, useCallback } from 'react';
import { draftService } from '../services/draftService';

/**
 * Event-based connection presence tracking.
 *
 * Instead of constantly writing timestamps and checking staleness,
 * this hook updates connection status based on actual events:
 * - Page visibility (tab hidden/visible)
 * - Network status (online/offline)
 * - Page unload (closing tab/window)
 * - Component unmount (navigating away from draft page)
 *
 * This approach:
 * 1. Reduces database writes (only on state changes)
 * 2. Provides faster detection (events fire immediately)
 * 3. Is more accurate (no false positives from timing variability)
 */

interface UseConnectionPresenceOptions {
  /** The player's database ID */
  playerId: string | undefined;
  /** Whether presence tracking is enabled */
  enabled?: boolean;
  /** Fallback heartbeat interval in ms (default: 60000 = 60 seconds) */
  heartbeatInterval?: number;
}

export function useConnectionPresence({
  playerId,
  enabled = true,
  heartbeatInterval = 60000,
}: UseConnectionPresenceOptions): void {
  const lastStatusRef = useRef<boolean | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Store playerId in a ref so cleanup always has the latest value
  const playerIdRef = useRef<string | undefined>(playerId);
  playerIdRef.current = playerId;

  // Update connection status in database (with deduplication)
  const updateStatus = useCallback(async (isConnected: boolean, force = false) => {
    const pid = playerIdRef.current;
    if (!pid) return;

    // Only write if status actually changed (or first time), unless forced
    if (!force && lastStatusRef.current === isConnected) return;

    lastStatusRef.current = isConnected;

    try {
      await draftService.updateConnectionStatus(pid, isConnected);
      console.log(`[ConnectionPresence] Status updated: ${isConnected ? 'connected' : 'disconnected'}`);
    } catch (error) {
      console.error('[ConnectionPresence] Failed to update status:', error);
    }
  }, []);

  // Mark as connected
  const markConnected = useCallback(() => {
    updateStatus(true);
  }, [updateStatus]);

  // Mark as disconnected
  const markDisconnected = useCallback(() => {
    updateStatus(false);
  }, [updateStatus]);

  // Force disconnect - always sends the update regardless of current state
  // Used in cleanup to ensure disconnection is always recorded
  const forceDisconnect = useCallback(() => {
    const pid = playerIdRef.current;
    console.log('[ConnectionPresence] forceDisconnect called, playerId:', pid);

    if (!pid) {
      console.warn('[ConnectionPresence] No playerId in forceDisconnect!');
      return;
    }

    // Reset the ref so subsequent calls will also work
    lastStatusRef.current = false;

    // Fire and forget - we can't await in cleanup
    console.log('[ConnectionPresence] Sending disconnect to DB for player:', pid);
    draftService.updateConnectionStatus(pid, false)
      .then(() => {
        console.log('[ConnectionPresence] Disconnect DB update completed successfully');
      })
      .catch((err) => {
        console.error('[ConnectionPresence] Failed to disconnect on cleanup:', err);
      });
  }, []);

  useEffect(() => {
    if (!enabled || !playerId) return;

    // --- Event Handlers ---
    // NOTE: We intentionally do NOT track visibility changes (tab switching, app switching)
    // because the user should be able to multitask while the draft page is still open.
    // We only mark as disconnected when they actually LEAVE the draft page.

    // Network status - offline means they can't participate
    const handleOnline = () => markConnected();
    const handleOffline = () => markDisconnected();

    // Page unload (closing tab/window)
    const handleBeforeUnload = () => {
      const pid = playerIdRef.current;
      if (pid) {
        // Fire and forget - browser may or may not complete this
        draftService.updateConnectionStatus(pid, false).catch(() => {});
      }
    };

    // pagehide is more reliable than beforeunload on mobile
    const handlePageHide = (e: PageTransitionEvent) => {
      const pid = playerIdRef.current;
      // persisted = true means page might be restored from bfcache
      if (!e.persisted && pid) {
        draftService.updateConnectionStatus(pid, false).catch(() => {});
      }
    };

    // --- Initial State ---
    // Mark as connected on mount (entering draft page)
    markConnected();

    // --- Register Event Listeners ---
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    // --- Fallback Heartbeat ---
    // Keep-alive heartbeat to maintain connection status
    // Runs regardless of visibility since user can multitask
    heartbeatRef.current = setInterval(() => {
      if (navigator.onLine) {
        const pid = playerIdRef.current;
        if (pid) {
          draftService.updateConnectionStatus(pid, true).catch(() => {});
        }
      }
    }, heartbeatInterval);

    // --- Cleanup ---
    return () => {
      // CRITICAL: Mark as disconnected on unmount (navigating away from draft page)
      // This is the main way we detect the host leaving - React Router navigation
      forceDisconnect();

      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);

      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [enabled, playerId, markConnected, markDisconnected, forceDisconnect, heartbeatInterval]);
}
