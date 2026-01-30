import { useState, useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { GameCard } from './GameCard';
import { cn } from '../../lib/utils';
import type { Card } from '../../types/card';
import type { CustomStack } from '../../hooks/useStackManagement';

/**
 * Card with its position index
 */
export interface CardWithIndex {
  card: Card;
  index: number;
  /** Optional count for stacked identical cards (e.g., basic lands) */
  count?: number;
}

export interface StackablePileViewProps {
  // Data
  /** Stacks to render */
  stacks: CustomStack[];
  /** All cards available (used to get card data from indices) */
  cards: CardWithIndex[];

  // Stack operations
  onDeleteStack: (stackId: string) => void;
  onRenameStack: (stackId: string, newName: string) => void;
  onMoveCardToStack: (cardIndex: number, stackId: string) => void;
  onMergeStacks: (sourceId: string, targetId: string) => void;
  /** Optional: Create stack at specific position (for insertion indicators) */
  onCreateStackAtPosition?: (name: string, cardIndex: number, position: number) => string;

  // Card interaction
  onCardClick?: (card: Card, index: number) => void;
  selectedIndex?: number;
  highlightedIndex?: number;
  showTier?: boolean;

  // Optional features
  /** Show insertion indicators between stacks when dragging (default: false) */
  showInsertionIndicators?: boolean;
  /** Optional callback when a card is dragged from outside this component */
  onExternalDrop?: (cardIndex: number) => void;
  /** Notify parent when drag starts (e.g., to auto-enable custom stacks mode) */
  onDragStartCard?: () => void;

  /** Additional class name */
  className?: string;
  /** Card offset in stack (default: 28px) */
  cardOffset?: number;
  /** Whether this zone is the source of a drag operation (for fromZone matching) */
  zoneId?: string;
}

/**
 * StackablePileView renders cards in draggable stacks with support for:
 * - Drag-and-drop cards between stacks
 * - Drag stacks onto each other to merge
 * - Editable stack names
 * - Deletion with cards moving to "Uncategorized"
 * - Insertion indicators between stacks
 */
export function StackablePileView({
  stacks,
  cards,
  onDeleteStack,
  onRenameStack,
  onMoveCardToStack,
  onMergeStacks,
  onCreateStackAtPosition,
  onCardClick,
  selectedIndex,
  highlightedIndex,
  showTier = true,
  showInsertionIndicators = false,
  onExternalDrop,
  onDragStartCard,
  className,
  cardOffset = 28,
  zoneId = 'default',
}: StackablePileViewProps) {
  const [editingStackId, setEditingStackId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [insertPosition, setInsertPosition] = useState<number | null>(null);
  const stackContainerRef = useRef<HTMLDivElement>(null);

  // Clear insert position when any drag operation ends
  useEffect(() => {
    const handleDragEnd = () => {
      setInsertPosition(null);
    };
    document.addEventListener('dragend', handleDragEnd);
    return () => document.removeEventListener('dragend', handleDragEnd);
  }, []);

  // Get cards for a specific stack
  const getStackCards = useCallback((stackId: string): CardWithIndex[] => {
    const stack = stacks.find(s => s.id === stackId);
    if (!stack) return [];
    return stack.cardIndices
      .map(index => cards.find(c => c.index === index))
      .filter((c): c is CardWithIndex => c !== undefined);
  }, [stacks, cards]);

  // Handle card drag start
  const handleCardDragStart = useCallback((e: React.DragEvent, cardIndex: number) => {
    e.dataTransfer.setData('dragType', 'card');
    e.dataTransfer.setData('cardIndex', cardIndex.toString());
    e.dataTransfer.setData('fromZone', zoneId);
    e.dataTransfer.effectAllowed = 'move';
    onDragStartCard?.();
  }, [zoneId, onDragStartCard]);

  // Handle stack header drag start (for merging)
  const handleStackDragStart = useCallback((e: React.DragEvent, stackId: string) => {
    e.dataTransfer.setData('dragType', 'stack');
    e.dataTransfer.setData('stackId', stackId);
    e.dataTransfer.setData('fromZone', zoneId);
    e.dataTransfer.effectAllowed = 'move';
  }, [zoneId]);

  // Handle drop on a stack
  const handleStackDrop = useCallback((e: React.DragEvent, targetStackId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const dragType = e.dataTransfer.getData('dragType');
    const fromZone = e.dataTransfer.getData('fromZone');

    if (dragType === 'stack' && fromZone === zoneId) {
      // Stack-to-stack merge
      const sourceStackId = e.dataTransfer.getData('stackId');
      if (sourceStackId && sourceStackId !== targetStackId) {
        onMergeStacks(sourceStackId, targetStackId);
      }
    } else if (dragType === 'card') {
      // Card drop
      const cardIndex = parseInt(e.dataTransfer.getData('cardIndex'), 10);
      if (!isNaN(cardIndex)) {
        if (fromZone !== zoneId && onExternalDrop) {
          // Cross-zone drop - notify parent first
          onExternalDrop(cardIndex);
        }
        onMoveCardToStack(cardIndex, targetStackId);
      }
    }
  }, [zoneId, onMergeStacks, onMoveCardToStack, onExternalDrop]);

  // Handle drag over container (for insertion positioning)
  const handleContainerDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (!showInsertionIndicators || !onCreateStackAtPosition || !stackContainerRef.current) {
      return;
    }

    const container = stackContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;

    // Get all stack elements
    const stackElements = Array.from(container.querySelectorAll('[data-stack-id]'));

    // Find which gap the mouse is closest to
    let newPosition = stacks.length; // Default to end

    for (let i = 0; i < stackElements.length; i++) {
      const stackEl = stackElements[i] as HTMLElement;
      const stackRect = stackEl.getBoundingClientRect();
      const stackLeft = stackRect.left - containerRect.left;
      const stackMidpoint = stackLeft + stackRect.width / 2;

      if (mouseX < stackMidpoint) {
        newPosition = i;
        break;
      }
    }

    setInsertPosition(newPosition);
  }, [showInsertionIndicators, onCreateStackAtPosition, stacks.length]);

  // Handle drag leave from container
  const handleContainerDragLeave = useCallback((e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!stackContainerRef.current?.contains(relatedTarget)) {
      setInsertPosition(null);
    }
  }, []);

  // Handle drop on container (for creating new stacks)
  const handleContainerDrop = useCallback((e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    const isOnStack = target.closest('[data-stack-id]');
    const dragType = e.dataTransfer.getData('dragType');

    if (!isOnStack && dragType !== 'stack' && insertPosition !== null && onCreateStackAtPosition) {
      e.preventDefault();
      e.stopPropagation();

      const cardIndex = parseInt(e.dataTransfer.getData('cardIndex'), 10);
      const fromZone = e.dataTransfer.getData('fromZone');

      if (!isNaN(cardIndex)) {
        // Find the card to get its name
        const cardToUse = cards.find(c => c.index === cardIndex);

        // Handle cross-zone drop
        if (fromZone !== zoneId && onExternalDrop) {
          onExternalDrop(cardIndex);
        }

        // Create new stack at the insertion position
        if (cardToUse) {
          onCreateStackAtPosition(cardToUse.card.name, cardIndex, insertPosition);
        }
      }
    }

    setInsertPosition(null);
  }, [insertPosition, onCreateStackAtPosition, cards, zoneId, onExternalDrop]);

  const cardHeight = 140;

  // Empty state
  if (stacks.length === 0 && cards.length === 0) {
    return (
      <div className={cn('text-center text-gray-500 py-4', className)}>
        No cards in this zone
      </div>
    );
  }

  // Empty stacks state with cards available
  if (stacks.length === 0 && cards.length > 0) {
    return (
      <div className={cn('text-center text-gray-500 py-4 border-2 border-dashed border-yugi-border rounded-lg', className)}>
        Drag a card here to create your first stack
      </div>
    );
  }

  return (
    <div
      ref={stackContainerRef}
      className={cn('flex flex-wrap gap-4 items-start min-h-[160px] p-2 -m-2 rounded-lg', className)}
      onDragOver={handleContainerDragOver}
      onDragLeave={handleContainerDragLeave}
      onDrop={handleContainerDrop}
    >
      {/* Insertion indicator at start */}
      {showInsertionIndicators && insertPosition === 0 && (
        <div className="w-1 h-[140px] bg-gold-400/80 rounded-full flex-shrink-0 shadow-[0_0_8px_rgba(212,175,55,0.5)]" />
      )}

      {stacks.map((stack, stackIdx) => {
        const stackCards = getStackCards(stack.id);
        const pileHeight = stackCards.length > 0
          ? cardHeight + (stackCards.length - 1) * cardOffset
          : 60;

        return (
          <div key={stack.id} className="contents">
            <div
              data-stack-id={stack.id}
              className="flex flex-col items-center"
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => handleStackDrop(e, stack.id)}
            >
              {/* Stack header - draggable for merging */}
              <div
                draggable={editingStackId !== stack.id}
                onDragStart={(e) => handleStackDragStart(e, stack.id)}
                className={cn(
                  'mb-2 text-center flex items-center gap-1 px-2 py-1 rounded transition-colors',
                  editingStackId !== stack.id && 'cursor-grab active:cursor-grabbing hover:bg-white/10'
                )}
                title={editingStackId === stack.id ? undefined : 'Drag to merge with another stack'}
              >
                {editingStackId === stack.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => {
                      if (editingName.trim()) {
                        onRenameStack(stack.id, editingName.trim());
                      }
                      setEditingStackId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (editingName.trim()) {
                          onRenameStack(stack.id, editingName.trim());
                        }
                        setEditingStackId(null);
                      } else if (e.key === 'Escape') {
                        setEditingStackId(null);
                      }
                    }}
                    className="bg-yugi-dark border border-yugi-border rounded px-2 py-0.5 text-sm text-white focus:border-gold-500 focus:outline-none w-20"
                    autoFocus
                  />
                ) : (
                  <span
                    className="text-sm font-semibold text-gray-300 cursor-pointer hover:text-white"
                    onClick={() => {
                      setEditingStackId(stack.id);
                      setEditingName(stack.name);
                    }}
                    title="Click to rename"
                  >
                    {stack.name}
                  </span>
                )}
                <span className="text-xs text-gray-500">({stackCards.length})</span>
                <button
                  onClick={() => onDeleteStack(stack.id)}
                  className="p-0.5 text-gray-500 hover:text-red-400 transition-colors"
                  title="Delete stack"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Stacked cards */}
              <div
                className="relative w-[80px] sm:w-[100px] bg-yugi-card/30 rounded-lg border border-dashed border-yugi-border"
                style={{ height: `${pileHeight}px`, minHeight: '60px' }}
              >
                {stackCards.length > 0 ? (
                  stackCards.map(({ card, index, count }, cardStackIndex) => {
                    const isBasicResource = index < 0;
                    const isSelected = selectedIndex === index;
                    const isHighlighted = highlightedIndex === index;

                    return (
                      <div
                        key={`stack-${stack.id}-${index}-${card.id}`}
                        draggable={!isBasicResource}
                        onDragStart={isBasicResource ? undefined : (e) => handleCardDragStart(e, index)}
                        className={cn(
                          'absolute left-0 right-0 transition-all duration-200',
                          isBasicResource ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
                          'hover:-translate-y-2 hover:z-50',
                          isSelected && 'ring-2 ring-gold-400',
                          isHighlighted && '-translate-y-2'
                        )}
                        style={{
                          top: `${cardStackIndex * cardOffset}px`,
                          zIndex: isSelected ? 50 : isHighlighted ? 45 : cardStackIndex + 1,
                        }}
                        onClick={() => onCardClick?.(card, index)}
                      >
                        <GameCard card={card} size="full" showTier={showTier} flush />
                        {/* Count badge for stacked cards (e.g., basic lands) */}
                        {isBasicResource && count && count > 1 && (
                          <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                            x{count}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
                    Drop here
                  </div>
                )}
              </div>
            </div>

            {/* Insertion indicator after this stack */}
            {showInsertionIndicators && insertPosition === stackIdx + 1 && (
              <div className="w-1 h-[140px] bg-gold-400/80 rounded-full flex-shrink-0 shadow-[0_0_8px_rgba(212,175,55,0.5)]" />
            )}
          </div>
        );
      })}

      {/* Show insertion indicator at end when no stacks exist or when inserting at end */}
      {showInsertionIndicators && stacks.length === 0 && insertPosition !== null && (
        <div className="w-1 h-[140px] bg-gold-400/80 rounded-full flex-shrink-0 shadow-[0_0_8px_rgba(212,175,55,0.5)]" />
      )}
    </div>
  );
}

export default StackablePileView;
