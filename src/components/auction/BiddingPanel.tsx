import { useState, useMemo } from 'react';
import { Gavel, XCircle, Eye } from 'lucide-react';
import { YuGiOhCard } from '../cards/YuGiOhCard';
import { Button } from '../ui/Button';
import { PlayerBidStatus } from './PlayerBidStatus';
import type { YuGiOhCard as YuGiOhCardType, AuctionDraftPlayer, AuctionState } from '../../types';
import { cn } from '../../lib/utils';

interface BiddingPanelProps {
  /** Current auction state */
  auctionState: AuctionState | null;
  /** Card being auctioned */
  currentCard: YuGiOhCardType | null;
  /** All players in the draft */
  players: AuctionDraftPlayer[];
  /** Current user's player data */
  currentPlayer: AuctionDraftPlayer | null;
  /** Whether it's the current user's turn to bid */
  isMyBidTurn: boolean;
  /** Whether current player has reached max cards for this grid */
  hasMaxCards?: boolean;
  /** Max cards allowed per grid */
  maxCardsPerGrid?: number;
  /** Callback to place a bid */
  onBid: (amount: number) => void;
  /** Callback to pass */
  onPass: () => void;
  /** Whether actions are disabled (loading, etc.) */
  disabled?: boolean;
  /** Bidding timer - seconds remaining for current bidder */
  bidTimeRemaining?: number;
  /** Total time allowed per bid */
  totalBidTime?: number;
  /** Callback to view card details */
  onViewCard?: () => void;
  /** Whether to show tier badges on cards */
  showTier?: boolean;
  /** Current selector's seat position (for selection phase display) */
  currentSelectorSeat?: number | null;
}

export function BiddingPanel({
  auctionState,
  currentCard,
  players,
  currentPlayer,
  isMyBidTurn,
  hasMaxCards = false,
  maxCardsPerGrid = 10,
  onBid,
  onPass,
  disabled = false,
  bidTimeRemaining,
  totalBidTime = 15,
  onViewCard,
  showTier = true,
  currentSelectorSeat,
}: BiddingPanelProps) {
  const [customBidAmount, setCustomBidAmount] = useState<string>('');

  const currentBid = auctionState?.currentBid ?? 0;
  const currentBidderId = auctionState?.currentBidderId;
  const passedPlayerIds = auctionState?.passedPlayerIds ?? [];

  // Calculate minimum bid
  const minBid = currentBid + 1;
  const maxBid = currentPlayer?.biddingPoints ?? 0;
  const canBid = maxBid >= minBid;

  // Find current high bidder name
  const highBidderName = useMemo(() => {
    if (!currentBidderId) return null;
    return players.find(p => p.id === currentBidderId)?.name ?? 'Unknown';
  }, [currentBidderId, players]);

  // Sort players by seat for display
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => a.seatPosition - b.seatPosition);
  }, [players]);

  const handleQuickBid = (amount: number) => {
    if (amount <= maxBid) {
      onBid(amount);
    }
  };

  const handleCustomBid = () => {
    const amount = parseInt(customBidAmount, 10);
    if (amount >= minBid && amount <= maxBid) {
      onBid(amount);
      setCustomBidAmount('');
    }
  };

  // No auction state means we're in selection phase
  if (!auctionState || auctionState.phase === 'selecting') {
    return (
      <div className="bg-cc-card border border-cc-border rounded-lg p-4">
        <div className="text-center text-gray-400">
          <Gavel className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Waiting for card selection...</p>
        </div>

        {/* Player status */}
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-400">Players</h4>
          {sortedPlayers.map((player) => (
            <PlayerBidStatus
              key={player.id}
              player={player}
              isCurrentBidder={false}
              hasPassed={false}
              isWinning={false}
              isSelector={currentSelectorSeat != null && player.seatPosition === currentSelectorSeat}
              maxCardsPerGrid={maxCardsPerGrid}
            />
          ))}
        </div>
      </div>
    );
  }

  // Calculate timer percentage
  const timerPercent = bidTimeRemaining !== undefined && totalBidTime > 0
    ? (bidTimeRemaining / totalBidTime) * 100
    : 100;
  const isTimerLow = bidTimeRemaining !== undefined && bidTimeRemaining <= 5;

  return (
    <div className="bg-cc-card border border-cc-border rounded-lg overflow-hidden">
      {/* Bidding Timer Bar */}
      {auctionState?.phase === 'bidding' && bidTimeRemaining !== undefined && (
        <div className="h-1.5 bg-cc-dark">
          <div
            className={cn(
              'h-full transition-all duration-1000 ease-linear',
              isTimerLow ? 'bg-red-500' : 'bg-gold-500'
            )}
            style={{ width: `${timerPercent}%` }}
          />
        </div>
      )}

      {/* Current card being auctioned */}
      {currentCard && (
        <div className="p-4 border-b border-cc-border bg-cc-darker">
          <div className="flex gap-4">
            <div
              className={cn(
                "w-24 flex-shrink-0",
                onViewCard && "cursor-pointer hover:opacity-80 transition-opacity"
              )}
              onClick={onViewCard}
            >
              <YuGiOhCard card={currentCard} size="sm" showTier={showTier} />
              {onViewCard && (
                <button className="w-full mt-1 flex items-center justify-center gap-1 text-xs text-gold-400 hover:text-gold-300">
                  <Eye className="w-3 h-3" />
                  Details
                </button>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white break-words">{currentCard.name}</h3>
              <p className="text-sm text-gray-400">{currentCard.type}</p>

              {/* Current bid display */}
              <div className="mt-3 p-3 bg-cc-dark rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Current Bid:</span>
                  <span className="text-2xl font-bold text-gold-400">{currentBid}</span>
                </div>
                {highBidderName && (
                  <p className="text-sm text-gray-300 mt-1">
                    Leader: <span className="text-white font-medium">{highBidderName}</span>
                  </p>
                )}
              </div>

              {/* Bidding timer display */}
              {auctionState?.phase === 'bidding' && bidTimeRemaining !== undefined && (
                <div className={cn(
                  "mt-2 text-center text-sm font-medium",
                  isTimerLow ? "text-red-400 animate-pulse" : "text-gray-400"
                )}>
                  {bidTimeRemaining}s remaining
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Max cards reached message */}
      {hasMaxCards && auctionState?.phase === 'bidding' && (
        <div className="p-4 bg-purple-500/10 border-b border-purple-500/30">
          <p className="text-purple-400 font-medium text-center">
            You've acquired {maxCardsPerGrid} cards this grid
          </p>
          <p className="text-gray-400 text-sm text-center mt-1">
            Waiting for this auction to complete...
          </p>
        </div>
      )}

      {/* Bidding controls */}
      {isMyBidTurn && currentPlayer && !hasMaxCards && (
        <div className="p-4 bg-gold-500/10 border-b border-gold-500/30">
          <p className="text-gold-400 font-medium mb-3 text-center">Your turn to bid!</p>

          {canBid ? (
            <div className="space-y-3">
              {/* Quick bid buttons */}
              <div className="flex gap-2 justify-center">
                <Button
                  onClick={() => handleQuickBid(minBid)}
                  disabled={disabled}
                  variant="primary"
                  size="sm"
                >
                  +1 ({minBid})
                </Button>
                {minBid + 4 <= maxBid && (
                  <Button
                    onClick={() => handleQuickBid(minBid + 4)}
                    disabled={disabled}
                    variant="primary"
                    size="sm"
                  >
                    +5 ({minBid + 4})
                  </Button>
                )}
                {minBid + 9 <= maxBid && (
                  <Button
                    onClick={() => handleQuickBid(minBid + 9)}
                    disabled={disabled}
                    variant="primary"
                    size="sm"
                  >
                    +10 ({minBid + 9})
                  </Button>
                )}
              </div>

              {/* Custom bid input */}
              <div className="flex gap-2">
                <input
                  type="number"
                  min={minBid}
                  max={maxBid}
                  value={customBidAmount}
                  onChange={(e) => setCustomBidAmount(e.target.value)}
                  placeholder={`${minBid}-${maxBid}`}
                  className="flex-1 px-3 py-2 bg-cc-dark border border-cc-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold-500"
                  disabled={disabled}
                />
                <Button
                  onClick={handleCustomBid}
                  disabled={disabled || !customBidAmount || parseInt(customBidAmount) < minBid || parseInt(customBidAmount) > maxBid}
                  variant="primary"
                  size="sm"
                >
                  Bid
                </Button>
              </div>

              {/* Pass button */}
              <Button
                onClick={onPass}
                disabled={disabled}
                variant="secondary"
                className="w-full"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Pass (Can't re-enter)
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-center text-red-400">
                Not enough points to bid (need {minBid}, have {maxBid})
              </p>
              <Button
                onClick={onPass}
                disabled={disabled}
                variant="secondary"
                className="w-full"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Pass
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Bid history */}
      {auctionState.bids.length > 0 && (
        <div className="p-4 border-b border-cc-border">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Bid History</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
            {[...auctionState.bids].reverse().map((bid, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-sm py-1"
              >
                <span className="text-gray-300">{bid.playerName}</span>
                <span className="text-gold-400 font-medium">{bid.amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Player status */}
      <div className="p-4">
        <h4 className="text-sm font-medium text-gray-400 mb-2">Players</h4>
        <div className="space-y-2">
          {sortedPlayers.map((player) => (
            <PlayerBidStatus
              key={player.id}
              player={player}
              isCurrentBidder={player.seatPosition === auctionState.nextBidderSeat}
              hasPassed={passedPlayerIds.includes(player.id)}
              isWinning={player.id === currentBidderId}
              isSelector={false}
              maxCardsPerGrid={maxCardsPerGrid}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
