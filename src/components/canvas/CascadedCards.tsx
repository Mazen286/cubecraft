/**
 * CascadedCards - Displays cards in a cascaded stack with "+X more" functionality
 *
 * Shows a limited number of cards with the rest hidden behind a clickable badge.
 * Supports individual card dragging.
 */

import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { cn } from '../../lib/utils';
import { GameCard } from '../cards/GameCard';
import type { Card } from '../../types/card';
import type { CardSize } from './types';
import { CARD_DIMENSIONS, STACK_DIMENSIONS } from './types';

export interface CascadedCardsProps {
  stackId: string;
  zoneId: string;
  cards: Array<{ id: string | number; card: Card }>;
  cardSize: CardSize;
  collapsed: boolean;
  showTier?: boolean;
  selectedCardId?: string | number;
  highlightedCardId?: string | number;
  /** Search query for highlighting matching cards */
  searchQuery?: string;
  /** Set of selected card IDs for multi-select */
  multiSelectCardIds?: Set<string | number>;
  /** Currently focused card ID for keyboard navigation */
  focusedCardId?: string | number | null;
  onCardClick?: (cardId: string | number, card: Card, e?: React.MouseEvent) => void;
}

interface DraggableCardProps {
  cardId: string | number;
  card: Card;
  stackId: string;
  zoneId: string;
  index: number;
  cardSize: CardSize;
  cardOffset: number;
  isSelected: boolean;
  isHighlighted: boolean;
  isSearchMatch: boolean;
  isMultiSelected: boolean;
  isFocused: boolean;
  showTier: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

function DraggableCard({
  cardId,
  card,
  stackId,
  zoneId,
  index,
  cardSize,
  cardOffset,
  isSelected,
  isHighlighted,
  isSearchMatch,
  isMultiSelected,
  isFocused,
  showTier,
  onClick,
}: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `card-${stackId}-${cardId}`,
    data: {
      type: 'card',
      cardId,
      card,
      stackId,
      zoneId,
    },
  });

  const dims = CARD_DIMENSIONS[cardSize];

  // Don't transform the original card - DragOverlay handles the visual preview
  // Original card stays in place with reduced opacity to show where it came from

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'absolute left-0 right-0',
        'cursor-grab active:cursor-grabbing touch-none',
        !isDragging && 'transition-all duration-200 hover:-translate-y-1 hover:z-50',
        isSelected && 'ring-2 ring-gold-400 z-40',
        isMultiSelected && !isSelected && 'ring-2 ring-purple-400 shadow-md shadow-purple-400/30',
        isHighlighted && '-translate-y-1 z-45',
        isSearchMatch && !isSelected && !isMultiSelected && 'ring-2 ring-cyan-400 shadow-lg shadow-cyan-400/30',
        isFocused && !isSelected && !isMultiSelected && 'border-2 border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.6)] -translate-y-1',
        // Hide original when dragging - DragOverlay shows the preview instead
        isDragging && 'opacity-40 ring-2 ring-gold-400/50',
      )}
      style={{
        top: index * cardOffset,
        zIndex: isSelected ? 50 : isFocused ? 48 : isHighlighted ? 45 : isMultiSelected ? 42 : isSearchMatch ? 40 : index + 1,
        width: dims.width,
        height: dims.height,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
    >
      <GameCard card={card} size="full" showTier={showTier} flush />
    </div>
  );
}

export function CascadedCards({
  stackId,
  zoneId,
  cards,
  cardSize,
  collapsed,
  showTier = true,
  selectedCardId,
  highlightedCardId,
  searchQuery,
  multiSelectCardIds,
  focusedCardId,
  onCardClick,
}: CascadedCardsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const dims = STACK_DIMENSIONS[cardSize];
  const cardDims = CARD_DIMENSIONS[cardSize];

  // Helper function to check if a card matches the search query
  const matchesSearch = (card: Card): boolean => {
    if (!searchQuery || searchQuery.trim() === '') return false;
    const query = searchQuery.toLowerCase().trim();
    const nameMatch = card.name.toLowerCase().includes(query);
    const descMatch = card.description ? card.description.toLowerCase().includes(query) : false;
    const typeMatch = card.type ? card.type.toLowerCase().includes(query) : false;
    return nameMatch || descMatch || typeMatch;
  };

  // When collapsed, show nothing
  if (collapsed) {
    return (
      <div
        className="flex items-center justify-center text-xs text-gray-500 py-2"
        style={{ width: dims.width }}
      >
        {cards.length} card{cards.length !== 1 ? 's' : ''}
      </div>
    );
  }

  // Calculate how many cards to show
  const maxVisible = isExpanded ? cards.length : dims.maxVisibleCards;
  const visibleCards = cards.slice(0, maxVisible);
  const hiddenCount = cards.length - maxVisible;

  // Calculate container height
  const containerHeight = cardDims.height + (visibleCards.length - 1) * dims.cardOffset;

  return (
    <div
      className="relative"
      style={{
        width: dims.width,
        height: containerHeight + (hiddenCount > 0 ? 24 : 0),
      }}
    >
      {/* Visible cards */}
      {visibleCards.map(({ id, card }, index) => {
        const isFocused = focusedCardId === id;
        return (
          <DraggableCard
            key={`${stackId}-${id}`}
            cardId={id}
            card={card}
            stackId={stackId}
            zoneId={zoneId}
            index={index}
            cardSize={cardSize}
            cardOffset={dims.cardOffset}
            isSelected={selectedCardId === id}
            isHighlighted={highlightedCardId === id}
            isSearchMatch={matchesSearch(card)}
            isMultiSelected={multiSelectCardIds?.has(id) ?? false}
            isFocused={isFocused}
            showTier={showTier}
            onClick={(e) => onCardClick?.(id, card, e)}
          />
        );
      })}

      {/* "+X more" badge */}
      {hiddenCount > 0 && (
        <button
          className={cn(
            'absolute left-0 right-0 bottom-0',
            'flex items-center justify-center gap-1',
            'bg-cc-card/90 border border-cc-border rounded',
            'text-xs text-gray-300 hover:text-white hover:bg-cc-card',
            'transition-colors cursor-pointer py-1'
          )}
          style={{ width: dims.width }}
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(true);
          }}
        >
          +{hiddenCount} more
        </button>
      )}

      {/* Collapse button when expanded */}
      {isExpanded && cards.length > dims.maxVisibleCards && (
        <button
          className={cn(
            'absolute left-0 right-0',
            'flex items-center justify-center',
            'bg-cc-card/90 border border-cc-border rounded',
            'text-xs text-gray-300 hover:text-white hover:bg-cc-card',
            'transition-colors cursor-pointer py-1'
          )}
          style={{
            width: dims.width,
            top: containerHeight,
          }}
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(false);
          }}
        >
          Show less
        </button>
      )}

      {/* Empty state */}
      {cards.length === 0 && (
        <div
          className={cn(
            'flex items-center justify-center',
            'border-2 border-dashed border-cc-border rounded-lg',
            'text-xs text-gray-500'
          )}
          style={{ width: dims.width, height: 60 }}
        >
          Empty
        </div>
      )}
    </div>
  );
}
