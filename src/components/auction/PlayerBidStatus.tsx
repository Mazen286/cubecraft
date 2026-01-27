import { Coins, Trophy, Pointer, Bot } from 'lucide-react';
import type { AuctionDraftPlayer } from '../../types';
import { cn } from '../../lib/utils';

interface PlayerBidStatusProps {
  /** Player data */
  player: AuctionDraftPlayer;
  /** Whether this player is currently bidding */
  isCurrentBidder: boolean;
  /** Whether this player has passed */
  hasPassed: boolean;
  /** Whether this player is currently winning */
  isWinning: boolean;
  /** Whether this player is the current selector */
  isSelector?: boolean;
  /** Maximum cards each player can acquire per grid */
  maxCardsPerGrid: number;
}

export function PlayerBidStatus({
  player,
  isCurrentBidder,
  hasPassed,
  isWinning,
  isSelector = false,
  maxCardsPerGrid,
}: PlayerBidStatusProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-2 rounded-lg transition-colors',
        isCurrentBidder && 'bg-gold-500/20 ring-1 ring-gold-500',
        isWinning && !hasPassed && 'bg-green-500/10',
        isSelector && 'bg-purple-500/20 ring-1 ring-purple-500'
      )}
    >
      <div className="flex items-center gap-2">
        {/* Player indicator */}
        <div className="flex items-center gap-1">
          {player.isBot && (
            <Bot className="w-3 h-3 text-gray-500" />
          )}
          <span
            className={cn(
              'font-medium truncate max-w-[100px]',
              isCurrentBidder ? 'text-gold-400' : 'text-white'
            )}
          >
            {player.name}
          </span>
        </div>

        {/* Status icons */}
        {isWinning && !hasPassed && (
          <Trophy className="w-4 h-4 text-green-400" />
        )}
        {hasPassed && (
          <span className="text-xs text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded">
            Passed
          </span>
        )}
        {player.cardsAcquiredThisGrid >= maxCardsPerGrid && !hasPassed && (
          <span className="text-xs text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded">
            Full
          </span>
        )}
        {isCurrentBidder && !hasPassed && player.cardsAcquiredThisGrid < maxCardsPerGrid && (
          <Pointer className="w-4 h-4 text-gold-400 animate-pulse" />
        )}
        {isSelector && (
          <span className="text-xs text-purple-400 bg-purple-500/20 px-1 rounded">
            Selecting
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-sm">
        {/* Cards acquired */}
        <span
          className={cn(
            'text-gray-400',
            player.cardsAcquiredThisGrid >= maxCardsPerGrid && 'text-green-400'
          )}
        >
          {player.cardsAcquiredThisGrid}/{maxCardsPerGrid}
        </span>

        {/* Bidding points */}
        <div className="flex items-center gap-1">
          <Coins className="w-4 h-4 text-gold-400" />
          <span
            className={cn(
              'font-medium min-w-[2rem] text-right',
              player.biddingPoints > 50 ? 'text-gold-400' :
              player.biddingPoints > 20 ? 'text-yellow-500' :
              'text-red-400'
            )}
          >
            {player.biddingPoints}
          </span>
        </div>
      </div>
    </div>
  );
}
