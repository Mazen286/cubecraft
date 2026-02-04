import { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SelectionTimerProps {
  /** Time remaining in seconds */
  timeRemaining: number;
  /** Total time allowed */
  totalTime: number;
  /** Whether this timer is for the current user */
  isMyTurn: boolean;
  /** Label to show */
  label?: string;
  /** Whether this is Open Draft mode (no bidding) */
  isOpenMode?: boolean;
}

export function SelectionTimer({
  timeRemaining,
  totalTime,
  isMyTurn,
  label = 'Time to select',
  isOpenMode = false,
}: SelectionTimerProps) {
  const percentage = useMemo(() => {
    return Math.max(0, Math.min(100, (timeRemaining / totalTime) * 100));
  }, [timeRemaining, totalTime]);

  const isUrgent = timeRemaining <= 10;
  const isCritical = timeRemaining <= 5;

  return (
    <div
      className={cn(
        'p-4 rounded-lg border transition-colors',
        isMyTurn ? 'bg-gold-500/10 border-gold-500/30' : 'bg-cc-card border-cc-border',
        isCritical && isMyTurn && 'bg-red-500/20 border-red-500/50 animate-pulse'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Clock
            className={cn(
              'w-5 h-5',
              isCritical ? 'text-red-400' :
              isUrgent ? 'text-yellow-400' :
              'text-gold-400'
            )}
          />
          <span className="text-sm font-medium text-gray-300">{label}</span>
        </div>
        <span
          className={cn(
            'text-2xl font-bold',
            isCritical ? 'text-red-400' :
            isUrgent ? 'text-yellow-400' :
            'text-gold-400'
          )}
        >
          {timeRemaining}s
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-cc-dark rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-all duration-1000',
            isCritical ? 'bg-red-500' :
            isUrgent ? 'bg-yellow-500' :
            'bg-gold-500'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {isMyTurn && (
        <p
          className={cn(
            'mt-2 text-center text-sm',
            isCritical ? 'text-red-400 font-bold' :
            isUrgent ? 'text-yellow-400' :
            'text-gray-400'
          )}
        >
          {isCritical
            ? 'Hurry! Auto-select in ' + timeRemaining + 's'
            : isOpenMode
              ? 'Click a card to add it to your collection'
              : 'Click a card to put it up for auction'}
        </p>
      )}
    </div>
  );
}
