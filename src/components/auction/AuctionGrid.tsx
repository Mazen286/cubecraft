import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { YuGiOhCard } from '../cards/YuGiOhCard';
import type { YuGiOhCard as YuGiOhCardType } from '../../types';
import type { SynergyResult } from '../../services/synergyService';
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
  /** Callback when a card is clicked (to view details) */
  onCardClick: (card: YuGiOhCardType) => void;
  /** Whether selection is disabled (e.g., during bidding phase) */
  selectionDisabled?: boolean;
  /** Card ID highlighted via keyboard navigation */
  keyboardSelectedCardId?: number | null;
  /** Whether this is Open Draft mode (no bidding) */
  isOpenMode?: boolean;
  /** Whether to show tier badges on cards */
  showTier?: boolean;
  /** Synergy data for grid cards (card ID -> SynergyResult) */
  synergies?: Map<number, SynergyResult>;
}

export function AuctionGrid({
  gridCards,
  remainingCardIds,
  isSelector,
  currentAuctionCardId,
  onCardClick,
  selectionDisabled = false,
  keyboardSelectedCardId,
  isOpenMode = false,
  showTier = true,
  synergies,
}: AuctionGridProps) {
  // Create a set for O(1) lookup
  const remainingSet = useMemo(
    () => new Set(remainingCardIds),
    [remainingCardIds]
  );

  const handleCardClick = (card: YuGiOhCardType) => {
    // Only allow clicking on remaining cards
    if (!remainingSet.has(card.id)) return;
    onCardClick(card);
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
        {gridCards.map((card) => {
          const isRemaining = remainingSet.has(card.id);
          const isCurrentAuction = card.id === currentAuctionCardId;
          const isKeyboardSelected = card.id === keyboardSelectedCardId && isRemaining;
          const isClickable = isRemaining; // Any remaining card is clickable to view
          const synergy = synergies?.get(card.id);
          const hasSynergyBonus = synergy && synergy.synergyBonus > 0;

          return (
            <div
              key={card.id}
              className={cn(
                'relative transition-all duration-200',
                !isRemaining && 'opacity-30 grayscale',
                isCurrentAuction && 'ring-2 ring-gold-400 z-10',
                isKeyboardSelected && !isCurrentAuction && 'ring-2 ring-blue-400 z-10',
                isClickable && 'cursor-pointer hover:z-10 hover:ring-2 hover:ring-gold-400/50',
              )}
              onClick={() => handleCardClick(card)}
            >
              <YuGiOhCard
                card={card}
                size="full"
                showTier={showTier}
                flush
              />
              {/* Synergy indicator */}
              {isRemaining && hasSynergyBonus && (
                <div
                  className="absolute top-0 right-0 z-20 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-bl-lg px-1 py-0.5 shadow-lg"
                  title={`+${synergy.synergyBonus} synergy with your cards`}
                >
                  <div className="flex items-center gap-0.5">
                    <Sparkles className="w-3 h-3 text-white" />
                    <span className="text-[10px] font-bold text-white">+{synergy.synergyBonus}</span>
                  </div>
                </div>
              )}
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
            {isOpenMode ? 'Click a card to add it to your collection' : 'Select a card to put up for auction'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Use arrow keys to navigate, Enter to select
          </p>
        </div>
      )}
    </div>
  );
}
