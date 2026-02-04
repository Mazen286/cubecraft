import { Pause, Play } from 'lucide-react';
import { Button } from '../ui/Button';
import { formatTime } from '../../lib/utils';

interface PauseOverlayProps {
  /** Whether the current user is the host */
  isHost: boolean;
  /** Whether the pause was triggered by host disconnect */
  isPausedDueToDisconnect: boolean;
  /** Time remaining when the draft was paused (in seconds) */
  timeRemainingAtPause?: number | null;
  /** Whether a resume action is in progress */
  isResuming?: boolean;
  /** Callback when resume button is clicked */
  onResume: () => void;
  /** Optional: Format time as "Xs" instead of "M:SS" (for grid drafts) */
  showSecondsOnly?: boolean;
}

/**
 * Universal pause overlay for all draft modes.
 * Shows different messaging for host vs other players.
 */
export function PauseOverlay({
  isHost,
  isPausedDueToDisconnect,
  timeRemainingAtPause,
  isResuming = false,
  onResume,
  showSecondsOnly = false,
}: PauseOverlayProps) {
  // Format the time display
  const formattedTime = timeRemainingAtPause
    ? showSecondsOnly
      ? `${timeRemainingAtPause}s`
      : formatTime(timeRemainingAtPause)
    : null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="text-center max-w-md mx-auto p-8">
        {/* Pause Icon */}
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
          <Pause className="w-12 h-12 text-yellow-400" />
        </div>

        {/* Title */}
        <h2 className="text-4xl font-bold text-yellow-400 mb-4">
          {isHost
            ? (isPausedDueToDisconnect ? 'YOU WERE DISCONNECTED' : 'DRAFT PAUSED')
            : (isPausedDueToDisconnect ? 'HOST DISCONNECTED' : 'DRAFT PAUSED')}
        </h2>

        {/* Tailored messaging for host vs other players */}
        {isHost ? (
          <div className="mb-6">
            {isPausedDueToDisconnect ? (
              <>
                <p className="text-yellow-400 text-lg mb-2">
                  The draft was automatically paused when you left.
                </p>
                <p className="text-gray-400 text-sm">
                  Click resume to continue for all players.
                </p>
              </>
            ) : (
              <>
                <p className="text-gray-300 text-lg mb-2">
                  You've paused the draft.
                </p>
                <p className="text-gray-400 text-sm">
                  Other players are waiting. Click resume when you're ready.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="mb-6">
            {isPausedDueToDisconnect ? (
              <>
                <p className="text-red-400 text-lg mb-2">Host Disconnected</p>
                <p className="text-gray-400 text-sm">
                  The draft has been automatically paused. Waiting for the host to reconnect...
                </p>
              </>
            ) : (
              <p className="text-gray-400">
                The host has paused the draft. Please wait for them to resume.
              </p>
            )}
          </div>
        )}

        {/* Time remaining info */}
        {formattedTime && (
          <div className="mb-6 p-4 rounded-lg bg-cc-card border border-cc-border">
            <p className="text-sm text-gray-400 mb-1">Time remaining when paused</p>
            <p className="text-2xl font-bold text-gold-400">
              {formattedTime}
            </p>
          </div>
        )}

        {/* Resume button (host only) */}
        {isHost && (
          <Button
            onClick={onResume}
            disabled={isResuming}
            className="flex items-center gap-2 mx-auto px-6 py-3"
          >
            {isResuming ? (
              <>
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Resuming...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Resume Draft
              </>
            )}
          </Button>
        )}

        {/* Non-host message */}
        {!isHost && (
          <p className="text-sm text-gray-500 mt-4">
            Only the host can resume the draft
          </p>
        )}
      </div>
    </div>
  );
}
