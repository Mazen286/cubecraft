import { useMemo, useState, useCallback, useEffect } from 'react';
import type { Card } from '../../types/card';
import type { PileGroup } from '../../config/gameConfig';
import { useGameConfig } from '../../context/GameContext';
import { GameCard } from './GameCard';
import { cn } from '../../lib/utils';

interface CardWithIndex {
  card: Card;
  index: number;
}

export interface PileNavigationMap {
  /** Map from card index to [pileIndex, positionInPile] */
  cardToPile: Map<number, [number, number]>;
  /** Array of piles, each containing array of card indices */
  piles: number[][];
}

export interface CardPileViewProps {
  /** Cards to display in pile view */
  cards: CardWithIndex[];
  /** Optional custom pile groups (defaults to game config) */
  pileGroups?: PileGroup[];
  /** Currently selected card index */
  selectedIndex?: number;
  /** Currently highlighted card index (keyboard navigation) */
  highlightedIndex?: number;
  /** Callback when a card is clicked */
  onCardClick?: (card: Card, index: number) => void;
  /** Show tier badges on cards */
  showTier?: boolean;
  /** Additional class names */
  className?: string;
  /** Card offset in pixels (default 28) */
  cardOffset?: number;
  /** Callback to provide pile navigation structure */
  onPileStructureChange?: (navMap: PileNavigationMap) => void;
  /** Enable drag functionality */
  draggable?: boolean;
  /** Callback when drag starts - receives card index */
  onDragStart?: (index: number, e: React.DragEvent) => void;
}

interface PileData {
  group: PileGroup;
  cards: CardWithIndex[];
}

/**
 * CardPileView displays cards in stacked vertical piles grouped by game-specific criteria.
 *
 * For Yu-Gi-Oh: Groups monsters by level (1-12), then Spells, then Traps
 * For MTG: Groups by CMC (0, 1, 2, 3, 4, 5, 6+)
 */
export function CardPileView({
  cards,
  pileGroups,
  selectedIndex,
  highlightedIndex,
  onCardClick,
  showTier = true,
  className,
  cardOffset = 28,
  onPileStructureChange,
  draggable = false,
  onDragStart,
}: CardPileViewProps) {
  const { gameConfig } = useGameConfig();

  // Track which card was last interacted with (to keep it visually on top)
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  // Use provided pile groups or get from game config
  const groups = pileGroups || gameConfig.pileViewConfig?.groups || [];

  // Group cards into piles
  const piles = useMemo(() => {
    const pilesMap = new Map<string, PileData>();

    // Initialize piles for each group
    groups.forEach(group => {
      pilesMap.set(group.id, { group, cards: [] });
    });

    // Assign cards to piles
    cards.forEach(cardWithIndex => {
      for (const group of groups) {
        if (group.matches(cardWithIndex.card)) {
          const pile = pilesMap.get(group.id);
          if (pile) {
            pile.cards.push(cardWithIndex);
          }
          break; // Card goes to first matching group only
        }
      }
    });

    // Convert to array and filter out empty piles, sort by order
    return Array.from(pilesMap.values())
      .filter(pile => pile.cards.length > 0)
      .sort((a, b) => a.group.order - b.group.order);
  }, [cards, groups]);

  // Build navigation map and notify parent when pile structure changes
  useEffect(() => {
    if (!onPileStructureChange) return;

    const cardToPile = new Map<number, [number, number]>();
    const pileIndices: number[][] = [];

    piles.forEach((pile, pileIndex) => {
      const indices: number[] = [];
      pile.cards.forEach((cardWithIndex, posInPile) => {
        cardToPile.set(cardWithIndex.index, [pileIndex, posInPile]);
        indices.push(cardWithIndex.index);
      });
      pileIndices.push(indices);
    });

    onPileStructureChange({ cardToPile, piles: pileIndices });
  }, [piles, onPileStructureChange]);

  // Handle card click - track last clicked
  const handleCardClickInternal = useCallback((card: Card, index: number) => {
    setLastClickedIndex(index);
    onCardClick?.(card, index);
  }, [onCardClick]);

  // Clear last clicked when highlight moves to a different card (keyboard navigation)
  useEffect(() => {
    if (highlightedIndex !== undefined && highlightedIndex >= 0 && highlightedIndex !== lastClickedIndex) {
      setLastClickedIndex(null);
    }
  }, [highlightedIndex, lastClickedIndex]);

  // Also clear last clicked when selection changes
  useEffect(() => {
    if (selectedIndex !== undefined && selectedIndex !== lastClickedIndex) {
      setLastClickedIndex(null);
    }
  }, [selectedIndex, lastClickedIndex]);

  if (groups.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8">
        Pile view not configured for this game
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8">
        No cards to display
      </div>
    );
  }

  return (
    <div className={cn('flex flex-wrap gap-4 items-start', className)}>
      {piles.map(pile => (
        <CardPile
          key={pile.group.id}
          label={pile.group.label}
          cards={pile.cards}
          selectedIndex={selectedIndex}
          highlightedIndex={highlightedIndex}
          lastClickedIndex={lastClickedIndex}
          onCardClick={handleCardClickInternal}
          showTier={showTier}
          cardOffset={cardOffset}
          draggable={draggable}
          onDragStart={onDragStart}
        />
      ))}
    </div>
  );
}

interface CardPileProps {
  label: string;
  cards: CardWithIndex[];
  selectedIndex?: number;
  highlightedIndex?: number;
  lastClickedIndex?: number | null;
  onCardClick?: (card: Card, index: number) => void;
  showTier?: boolean;
  cardOffset: number;
  draggable?: boolean;
  onDragStart?: (index: number, e: React.DragEvent) => void;
}

function CardPile({
  label,
  cards,
  selectedIndex,
  highlightedIndex,
  lastClickedIndex,
  onCardClick,
  showTier,
  cardOffset,
  draggable = false,
  onDragStart,
}: CardPileProps) {
  // Calculate pile height based on number of cards
  // First card is full height, subsequent cards add cardOffset
  const cardHeight = 140; // Approximate height for 'full' size cards (aspect ratio 2:3 with ~100px width)
  const pileHeight = cardHeight + (cards.length - 1) * cardOffset;

  return (
    <div className="flex flex-col items-center">
      {/* Pile header with label and count */}
      <div className="mb-2 text-center">
        <span className="text-sm font-semibold text-gray-300">{label}</span>
        <span className="text-xs text-gray-500 ml-1">({cards.length})</span>
      </div>

      {/* Stacked cards */}
      <div
        className="relative w-[80px] sm:w-[100px]"
        style={{ height: `${pileHeight}px` }}
      >
        {cards.map((cardWithIndex, stackIndex) => {
          const isSelected = selectedIndex === cardWithIndex.index;
          const isHighlighted = highlightedIndex === cardWithIndex.index;
          const wasLastClicked = lastClickedIndex === cardWithIndex.index;

          // Card should be elevated if it was the last clicked, selected, or highlighted
          const isElevated = isSelected || isHighlighted || wasLastClicked;

          // Basic resources (negative indices) are not draggable
          const isBasicResource = cardWithIndex.index < 0;
          const canDrag = draggable && !isBasicResource;

          return (
            <div
              key={`${cardWithIndex.card.id}-${cardWithIndex.index}`}
              draggable={canDrag}
              onDragStart={canDrag ? (e) => onDragStart?.(cardWithIndex.index, e) : undefined}
              className={cn(
                'absolute left-0 right-0 transition-all duration-200',
                canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                'hover:-translate-y-2 hover:z-50',
                isElevated && '-translate-y-2'
              )}
              style={{
                top: `${stackIndex * cardOffset}px`,
                zIndex: isSelected ? 50 : isHighlighted ? 45 : wasLastClicked ? 40 : stackIndex + 1,
              }}
              onClick={() => onCardClick?.(cardWithIndex.card, cardWithIndex.index)}
            >
              <GameCard
                card={cardWithIndex.card}
                size="full"
                showTier={showTier}
                flush
                isSelected={isSelected}
                isHighlighted={isHighlighted}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CardPileView;
