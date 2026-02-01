/**
 * DraggableStack - A complete stack with header and cascaded cards
 *
 * Positioned absolutely within the zone canvas.
 * Header is draggable to move the entire stack.
 * Individual cards are draggable to pull them out.
 */

import { useState, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '../../lib/utils';
import { StackHeader } from './StackHeader';
import { CascadedCards } from './CascadedCards';
import type { CanvasStack, CardSize, ResolvedCard } from './types';
import { STACK_DIMENSIONS, CARD_DIMENSIONS } from './types';

export interface DraggableStackProps {
  stack: CanvasStack;
  cards: ResolvedCard[];
  zoneId: string;
  cardSize: CardSize;
  showTier?: boolean;
  selectedCardId?: string | number;
  highlightedCardId?: string | number;
  /** Search query for highlighting matching cards */
  searchQuery?: string;
  /** Set of selected card IDs for multi-select */
  multiSelectCardIds?: Set<string | number>;
  /** Whether this stack is focused for keyboard navigation */
  isFocused?: boolean;
  /** Currently focused card ID within this stack */
  focusedCardId?: string | number | null;
  isDropTarget?: boolean;
  onRename: (name: string) => void;
  onToggleCollapse: () => void;
  onDelete: () => void;
  /** Called when color changes */
  onColorChange?: (color: string | null) => void;
  onCardClick?: (cardId: string | number, card: ResolvedCard['card'], e?: React.MouseEvent) => void;
}

export function DraggableStack({
  stack,
  cards,
  zoneId,
  cardSize,
  showTier = true,
  selectedCardId,
  highlightedCardId,
  searchQuery,
  multiSelectCardIds,
  isFocused = false,
  focusedCardId,
  isDropTarget = false,
  onRename,
  onToggleCollapse,
  onDelete,
  onColorChange,
  onCardClick,
}: DraggableStackProps) {
  const dims = STACK_DIMENSIONS[cardSize];
  const cardDims = CARD_DIMENSIONS[cardSize];

  // Track drag state from header
  const [dragState, setDragState] = useState<{ isDragging: boolean; transform: { x: number; y: number } | null }>({
    isDragging: false,
    transform: null,
  });

  const handleDragStateChange = useCallback((isDragging: boolean, transform: { x: number; y: number } | null) => {
    setDragState({ isDragging, transform });
  }, []);

  // Make the stack a drop target for cards
  const { isOver, setNodeRef } = useDroppable({
    id: `stack-drop-${stack.id}`,
    data: {
      type: 'stack',
      stackId: stack.id,
      zoneId,
    },
  });

  // Calculate stack height
  const visibleCards = stack.collapsed ? 0 : Math.min(cards.length, dims.maxVisibleCards);
  const stackHeight = dims.headerHeight + (
    stack.collapsed
      ? 24 // Collapsed height
      : cards.length === 0
        ? 60 // Empty state
        : cardDims.height + (visibleCards - 1) * dims.cardOffset + (cards.length > dims.maxVisibleCards ? 24 : 0)
  );

  // Convert transform to CSS - only use translate, not scale
  const transformStyle = dragState.transform
    ? `translate3d(${dragState.transform.x}px, ${dragState.transform.y}px, 0)`
    : undefined;

  // Tighter width - just enough for the card plus minimal padding
  const stackWidth = dims.width + 4;

  return (
    <div
      ref={setNodeRef}
      data-stack-id={stack.id}
      className={cn(
        'absolute flex flex-col rounded',
        'bg-yugi-card/50 backdrop-blur-sm',
        'border border-yugi-border',
        isOver && 'border-gold-400 bg-gold-400/10 shadow-lg shadow-gold-400/20',
        isDropTarget && 'border-gold-400/50',
        isFocused && !dragState.isDragging && 'border-blue-400 shadow-lg shadow-blue-400/20',
        dragState.isDragging && 'z-50 shadow-lg border-gold-400/70',
      )}
      style={{
        left: stack.position.x,
        top: stack.position.y,
        width: stackWidth,
        maxWidth: stackWidth,
        minHeight: stackHeight + 4,
        padding: 2,
        transform: transformStyle,
        touchAction: 'none',  // Prevent browser taking over touch
        // Add left border accent if stack has a color
        borderLeftColor: stack.color || undefined,
        borderLeftWidth: stack.color ? 3 : undefined,
      }}
    >
      {/* Stack Header */}
      <StackHeader
        stackId={stack.id}
        name={stack.name}
        cardCount={cards.length}
        collapsed={stack.collapsed}
        zoneId={zoneId}
        cardSize={cardSize}
        color={stack.color}
        onRename={onRename}
        onToggleCollapse={onToggleCollapse}
        onDelete={onDelete}
        onColorChange={onColorChange}
        onDragStateChange={handleDragStateChange}
      />

      {/* Cards */}
      <CascadedCards
        stackId={stack.id}
        zoneId={zoneId}
        cards={cards}
        cardSize={cardSize}
        collapsed={stack.collapsed}
        showTier={showTier}
        selectedCardId={selectedCardId}
        highlightedCardId={highlightedCardId}
        searchQuery={searchQuery}
        multiSelectCardIds={multiSelectCardIds}
        focusedCardId={focusedCardId}
        onCardClick={onCardClick}
      />

      {/* Drop indicator overlay */}
      {isOver && (
        <div className="absolute inset-0 rounded-lg border-2 border-gold-400 pointer-events-none animate-pulse" />
      )}
    </div>
  );
}
