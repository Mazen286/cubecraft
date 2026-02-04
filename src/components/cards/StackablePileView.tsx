import { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
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

// Draggable card component
function DraggableCard({
  card,
  index,
  count,
  stackIndex,
  cardOffset,
  isSelected,
  isHighlighted,
  showTier,
  onClick,
  isBasicResource,
}: {
  card: Card;
  index: number;
  count?: number;
  stackIndex: number;
  cardOffset: number;
  isSelected: boolean;
  isHighlighted: boolean;
  showTier: boolean;
  onClick?: () => void;
  isBasicResource: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `card-${index}`,
    data: { type: 'card', cardIndex: index, card },
    disabled: isBasicResource,
  });

  return (
    <div
      ref={setNodeRef}
      {...(isBasicResource ? {} : { ...listeners, ...attributes })}
      className={cn(
        'absolute left-0 right-0 transition-all duration-200',
        isBasicResource ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing touch-none',
        'hover:-translate-y-2 hover:z-50',
        isSelected && 'ring-2 ring-gold-400',
        isHighlighted && '-translate-y-2',
        isDragging && 'opacity-50'
      )}
      style={{
        top: `${stackIndex * cardOffset}px`,
        zIndex: isSelected ? 50 : isHighlighted ? 45 : stackIndex + 1,
      }}
      onClick={onClick}
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
}

// Draggable stack header component
function DraggableStackHeader({
  stack,
  cardCount,
  isEditing,
  editingName,
  onEditingNameChange,
  onStartEdit,
  onFinishEdit,
  onDelete,
}: {
  stack: CustomStack;
  cardCount: number;
  isEditing: boolean;
  editingName: string;
  onEditingNameChange: (name: string) => void;
  onStartEdit: () => void;
  onFinishEdit: (save: boolean) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `stack-header-${stack.id}`,
    data: { type: 'stack', stackId: stack.id },
    disabled: isEditing,
  });

  return (
    <div
      ref={setNodeRef}
      {...(isEditing ? {} : { ...listeners, ...attributes })}
      className={cn(
        'mb-2 text-center flex items-center gap-1 px-2 py-1 rounded transition-colors',
        !isEditing && 'cursor-grab active:cursor-grabbing hover:bg-white/10 touch-none',
        isDragging && 'opacity-50'
      )}
      title={isEditing ? undefined : 'Drag to merge with another stack'}
    >
      {isEditing ? (
        <input
          type="text"
          value={editingName}
          onChange={(e) => onEditingNameChange(e.target.value)}
          onBlur={() => onFinishEdit(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onFinishEdit(true);
            } else if (e.key === 'Escape') {
              onFinishEdit(false);
            }
          }}
          className="bg-cc-dark border border-cc-border rounded px-2 py-0.5 text-sm text-white focus:border-gold-500 focus:outline-none w-20"
          autoFocus
        />
      ) : (
        <span
          className="text-sm font-semibold text-gray-300 cursor-pointer hover:text-white"
          onClick={onStartEdit}
          title="Click to rename"
        >
          {stack.name}
        </span>
      )}
      <span className="text-xs text-gray-500">({cardCount})</span>
      <button
        onClick={onDelete}
        className="p-0.5 text-gray-500 hover:text-red-400 transition-colors"
        title="Delete stack"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// Droppable stack component
function DroppableStack({
  stack,
  cards,
  cardOffset,
  cardHeight,
  selectedIndex,
  highlightedIndex,
  showTier,
  onCardClick,
  isEditing,
  editingName,
  onEditingNameChange,
  onStartEdit,
  onFinishEdit,
  onDelete,
}: {
  stack: CustomStack;
  cards: CardWithIndex[];
  cardOffset: number;
  cardHeight: number;
  selectedIndex?: number;
  highlightedIndex?: number;
  showTier: boolean;
  onCardClick?: (card: Card, index: number) => void;
  isEditing: boolean;
  editingName: string;
  onEditingNameChange: (name: string) => void;
  onStartEdit: () => void;
  onFinishEdit: (save: boolean) => void;
  onDelete: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `stack-${stack.id}`,
    data: { type: 'stack', stackId: stack.id },
  });

  const pileHeight = cards.length > 0
    ? cardHeight + (cards.length - 1) * cardOffset
    : 60;

  return (
    <div
      data-stack-id={stack.id}
      className="flex flex-col items-center"
    >
      {/* Stack header - draggable for merging */}
      <DraggableStackHeader
        stack={stack}
        cardCount={cards.length}
        isEditing={isEditing}
        editingName={editingName}
        onEditingNameChange={onEditingNameChange}
        onStartEdit={onStartEdit}
        onFinishEdit={onFinishEdit}
        onDelete={onDelete}
      />

      {/* Stacked cards - droppable area */}
      <div
        ref={setNodeRef}
        className={cn(
          'relative w-[80px] sm:w-[100px] bg-cc-card/30 rounded-lg border border-dashed transition-colors',
          isOver ? 'border-gold-400 bg-gold-400/10' : 'border-cc-border'
        )}
        style={{ height: `${pileHeight}px`, minHeight: '60px' }}
      >
        {cards.length > 0 ? (
          cards.map(({ card, index, count }, stackIndex) => {
            const isBasicResource = index < 0;
            const isSelected = selectedIndex === index;
            const isHighlighted = highlightedIndex === index;

            return (
              <DraggableCard
                key={`stack-${stack.id}-${index}-${card.id}`}
                card={card}
                index={index}
                count={count}
                stackIndex={stackIndex}
                cardOffset={cardOffset}
                isSelected={isSelected}
                isHighlighted={isHighlighted}
                showTier={showTier}
                onClick={() => onCardClick?.(card, index)}
                isBasicResource={isBasicResource}
              />
            );
          })
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

// Droppable insertion zone
function InsertionZone({ position }: { position: number }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `insertion-${position}`,
    data: { type: 'insertion', position },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'w-4 h-[140px] flex-shrink-0 transition-all',
        isOver && 'w-1 bg-gold-400/80 rounded-full shadow-[0_0_8px_rgba(212,175,55,0.5)]'
      )}
    />
  );
}

/**
 * StackablePileView renders cards in draggable stacks with support for:
 * - Drag-and-drop cards between stacks (touch + mouse)
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
  onExternalDrop: _onExternalDrop, // TODO: Implement cross-zone drops with dnd-kit
  onDragStartCard,
  className,
  cardOffset = 28,
  zoneId: _zoneId = 'default', // TODO: Implement cross-zone drops with dnd-kit
}: StackablePileViewProps) {
  const [editingStackId, setEditingStackId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [activeDragData, setActiveDragData] = useState<{
    type: 'card' | 'stack';
    card?: Card;
    stackId?: string;
  } | null>(null);

  // Configure sensors for touch and pointer with activation constraints
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance before activation
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // Delay before drag starts (prevents scroll interference)
        tolerance: 5, // Movement tolerance during delay
      },
    })
  );

  // Get cards for a specific stack
  const getStackCards = useCallback((stackId: string): CardWithIndex[] => {
    const stack = stacks.find(s => s.id === stackId);
    if (!stack) return [];
    return stack.cardIndices
      .map(index => cards.find(c => c.index === index))
      .filter((c): c is CardWithIndex => c !== undefined);
  }, [stacks, cards]);

  // Memoize stack cards
  const stackCardsMap = useMemo(() => {
    const map = new Map<string, CardWithIndex[]>();
    for (const stack of stacks) {
      map.set(stack.id, getStackCards(stack.id));
    }
    return map;
  }, [stacks, getStackCards]);

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;

    if (data?.type === 'card') {
      setActiveDragData({ type: 'card', card: data.card });
      onDragStartCard?.();
    } else if (data?.type === 'stack') {
      setActiveDragData({ type: 'stack', stackId: data.stackId });
    }
  }, [onDragStartCard]);

  // Handle drag over (for visual feedback)
  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Could add hover state tracking here if needed
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragData(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Card dropped on a stack
    if (activeData?.type === 'card' && overData?.type === 'stack') {
      const cardIndex = activeData.cardIndex as number;
      const targetStackId = overData.stackId as string;
      onMoveCardToStack(cardIndex, targetStackId);
    }

    // Stack dropped on another stack (merge)
    if (activeData?.type === 'stack' && overData?.type === 'stack') {
      const sourceStackId = activeData.stackId as string;
      const targetStackId = overData.stackId as string;
      if (sourceStackId !== targetStackId) {
        onMergeStacks(sourceStackId, targetStackId);
      }
    }

    // Card dropped on insertion zone (create new stack)
    if (activeData?.type === 'card' && overData?.type === 'insertion' && onCreateStackAtPosition) {
      const cardIndex = activeData.cardIndex as number;
      const position = overData.position as number;
      const card = activeData.card as Card;
      onCreateStackAtPosition(card.name, cardIndex, position);
    }
  }, [onMoveCardToStack, onMergeStacks, onCreateStackAtPosition]);

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
      <div className={cn('text-center text-gray-500 py-4 border-2 border-dashed border-cc-border rounded-lg', className)}>
        Drag a card here to create your first stack
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        className={cn('flex flex-wrap gap-4 items-start min-h-[160px] p-2 -m-2 rounded-lg', className)}
      >
        {/* Insertion zone at start */}
        {showInsertionIndicators && onCreateStackAtPosition && (
          <InsertionZone position={0} />
        )}

        {stacks.map((stack, stackIdx) => {
          const stackCards = stackCardsMap.get(stack.id) || [];

          return (
            <div key={stack.id} className="contents">
              <DroppableStack
                stack={stack}
                cards={stackCards}
                cardOffset={cardOffset}
                cardHeight={cardHeight}
                selectedIndex={selectedIndex}
                highlightedIndex={highlightedIndex}
                showTier={showTier}
                onCardClick={onCardClick}
                isEditing={editingStackId === stack.id}
                editingName={editingName}
                onEditingNameChange={setEditingName}
                onStartEdit={() => {
                  setEditingStackId(stack.id);
                  setEditingName(stack.name);
                }}
                onFinishEdit={(save) => {
                  if (save && editingName.trim()) {
                    onRenameStack(stack.id, editingName.trim());
                  }
                  setEditingStackId(null);
                }}
                onDelete={() => onDeleteStack(stack.id)}
              />

              {/* Insertion zone after this stack */}
              {showInsertionIndicators && onCreateStackAtPosition && (
                <InsertionZone position={stackIdx + 1} />
              )}
            </div>
          );
        })}
      </div>

      {/* Drag overlay - shows the dragged item */}
      <DragOverlay dropAnimation={null}>
        {activeDragData?.type === 'card' && activeDragData.card && (
          <div className="w-[80px] sm:w-[100px] opacity-90 rotate-3">
            <GameCard card={activeDragData.card} size="full" showTier={showTier} flush />
          </div>
        )}
        {activeDragData?.type === 'stack' && activeDragData.stackId && (
          <div className="px-2 py-1 bg-cc-card border border-gold-400 rounded text-sm text-white opacity-90">
            {stacks.find(s => s.id === activeDragData.stackId)?.name || 'Stack'}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

export default StackablePileView;
