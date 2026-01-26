import { useMemo } from 'react';
import { YuGiOhCard } from '../cards/YuGiOhCard';
import type { YuGiOhCard as YuGiOhCardType } from '../../types';
import { cn } from '../../lib/utils';

interface AuctionGridProps {
  /** All cards in the current grid */
  gridCards: YuGiOhCardType[];
  /** Card IDs still available for auction */
  remainingCardIds: number[];
  /** Whether the current user is the selector */
  isSelector: boolean;
  /** Card currently being auctioned (highlighted) */
  currentAuctionCardId: number | null;
  /** Callback when a card is selected for auction */
  onSelectCard: (cardId: number) => void;
  /** Whether selection is disabled (e.g., during bidding phase) */
  selectionDisabled?: boolean;
}

export function AuctionGrid({
  gridCards,
  remainingCardIds,
  isSelector,
  currentAuctionCardId,
  onSelectCard,
  selectionDisabled = false,
}: AuctionGridProps) {
  // Create a set for O(1) lookup
  const remainingSet = useMemo(
    () => new Set(remainingCardIds),
    [remainingCardIds]
  );

  const handleCardClick = (card: YuGiOhCardType) => {
    if (!isSelector || selectionDisabled) return;
    if (!remainingSet.has(card.id)) return;
    onSelectCard(card.id);
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
        {gridCards.map((card) => {
          const isRemaining = remainingSet.has(card.id);
          const isCurrentAuction = card.id === currentAuctionCardId;
          const isClickable = isSelector && isRemaining && !selectionDisabled;

          return (
            <div
              key={card.id}
              className={cn(
                'relative transition-all duration-200',
                !isRemaining && 'opacity-30 grayscale',
                isCurrentAuction && 'ring-2 ring-gold-400 z-10',
                isClickable && 'cursor-pointer hover:z-10 hover:ring-2 hover:ring-gold-400/50',
                !isClickable && isRemaining && 'cursor-default'
              )}
              onClick={() => handleCardClick(card)}
            >
              <YuGiOhCard
                card={card}
                size="full"
                showTier
                flush
              />
              {!isRemaining && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-gray-500 bg-black/50 px-1 rounded">
                    TAKEN
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Instructions */}
      {isSelector && !selectionDisabled && (
        <div className="mt-4 text-center">
          <p className="text-gold-400 font-medium animate-pulse">
            Select a card to put up for auction
          </p>
        </div>
      )}
    </div>
  );
}
