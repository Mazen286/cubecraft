import { useState, useEffect, useRef } from 'react';

interface UseResumeCountdownOptions {
  /** Whether the session is paused */
  paused: boolean | undefined;
  /** Server timestamp when the session will resume */
  resumeAt: string | null | undefined;
  /** Status of the session (e.g., 'in_progress') */
  status: string | undefined;
}

interface UseResumeCountdownResult {
  /** Current countdown value (null if not counting down) */
  countdown: number | null;
  /** Whether we're currently in resume countdown (timer should be paused) */
  isInCountdown: boolean;
  /** Check if timer should run (not paused and not in countdown) */
  shouldTimerRun: boolean;
  /** Increments each time a countdown completes - use as effect dependency to restart timers */
  resumeCount: number;
}

/**
 * Hook for managing the resume countdown after a draft is unpaused.
 * Provides a synchronized countdown based on the server's resume_at timestamp.
 *
 * Usage:
 * ```tsx
 * const { countdown, isInCountdown, shouldTimerRun } = useResumeCountdown({
 *   paused: session?.paused,
 *   resumeAt: session?.resume_at,
 *   status: session?.status,
 * });
 *
 * // Use isInCountdown to show the countdown overlay
 * // Use shouldTimerRun to control when the game timer runs
 * ```
 */
export function useResumeCountdown({
  paused,
  resumeAt,
  status,
}: UseResumeCountdownOptions): UseResumeCountdownResult {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [resumeCount, setResumeCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastResumeAtRef = useRef<string | null>(null);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // If paused, clear countdown
    if (paused) {
      setCountdown(null);
      return;
    }

    // If not paused and we have a resume_at timestamp, sync countdown to it
    if (!paused && resumeAt && status === 'in_progress') {
      const resumeTime = new Date(resumeAt).getTime();

      // Track if this is a new resume_at (new countdown started)
      const isNewCountdown = resumeAt !== lastResumeAtRef.current;
      lastResumeAtRef.current = resumeAt;

      const updateCountdown = () => {
        const now = Date.now();
        const remaining = Math.ceil((resumeTime - now) / 1000);

        if (remaining <= 0) {
          // Countdown finished
          setCountdown(null);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          // Signal that countdown completed - this triggers timer effects to re-run
          setResumeCount(c => c + 1);
        } else {
          setCountdown(remaining);
        }
      };

      // Initial update
      updateCountdown();

      // If countdown already finished (resume_at is in the past), increment resumeCount
      if (new Date(resumeAt).getTime() <= Date.now() && isNewCountdown) {
        setResumeCount(c => c + 1);
      }

      // Update every 100ms for smooth countdown
      intervalRef.current = setInterval(updateCountdown, 100);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else {
      // No resume_at or not in progress - clear countdown
      setCountdown(null);
    }
  }, [paused, resumeAt, status]);

  const isInCountdown = countdown !== null && countdown > 0;
  const shouldTimerRun = !paused && !isInCountdown;

  return {
    countdown,
    isInCountdown,
    shouldTimerRun,
    resumeCount,
  };
}

/**
 * Helper to check if resume countdown is active based on session data.
 * Use this in timer effects to determine if the timer should wait.
 */
export function isResumeCountdownActive(
  resumeAt: string | null | undefined
): boolean {
  if (!resumeAt) return false;
  const resumeTime = new Date(resumeAt).getTime();
  return resumeTime > Date.now();
}
