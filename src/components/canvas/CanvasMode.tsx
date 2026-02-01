/**
 * CanvasMode - Main container for the freeform canvas card organization
 *
 * Replaces StackablePileView with a true freeform canvas where stacks
 * can be positioned anywhere with collision detection.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragMoveEvent,
  pointerWithin,
} from '@dnd-kit/core';
import { GameCard } from '../cards/GameCard';
import { cn } from '../../lib/utils';
import { ZoneCanvas } from './ZoneCanvas';
import { CanvasToolbar } from './CanvasToolbar';
import { SelectionActionBar } from './SelectionActionBar';
import { useCanvasState } from './hooks/useCanvasState';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useCanvasKeyboardNavigation } from './hooks/useCanvasKeyboardNavigation';
import type { ZoneCanvas as ZoneCanvasType, DragData } from './types';
import { STACK_DIMENSIONS, CARD_DIMENSIONS } from './types';
import type { Card } from '../../types/card';

export interface CanvasModeProps {
  /** Storage key for persistence */
  storageKey: string;
  /** Initial zones configuration */
  initialZones: ZoneCanvasType[];
  /** Function to get card data by ID */
  getCardData: (cardId: string | number) => Card | null;
  /** Labels for zones */
  zoneLabels: Record<string, string>;
  /** Whether to show tier badges on cards */
  showTier?: boolean;
  /** Currently selected card ID */
  selectedCardId?: string | number;
  /** Highlighted card ID (from search/filter) */
  highlightedCardId?: string | number;
  /** Search query for highlighting matching cards */
  searchQuery?: string;
  /** Sort configuration for cards within stacks */
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  /** Called when a card is clicked */
  onCardClick?: (cardId: string | number, card: Card) => void;
  /** Called when layout changes (for external sync) */
  onLayoutChange?: (zones: ZoneCanvasType[]) => void;
  /** Validates/redirects zone moves. Return the zone to use, or false to block entirely. */
  validateZoneMove?: (cardId: string | number, fromZone: string, toZone: string) => string | false;
  /** External card-to-zone assignments - source of truth for zone membership */
  cardZoneAssignments?: Map<string | number, string>;
  /** Additional class name */
  className?: string;
  /** Whether keyboard navigation is enabled (disable when bottom sheet is open) */
  keyboardEnabled?: boolean;
}

export function CanvasMode({
  storageKey,
  initialZones,
  getCardData,
  zoneLabels,
  showTier = true,
  selectedCardId,
  highlightedCardId,
  searchQuery,
  sortBy = 'none',
  sortDirection = 'desc',
  onCardClick,
  onLayoutChange,
  validateZoneMove,
  cardZoneAssignments,
  className,
  keyboardEnabled = true,
}: CanvasModeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Main canvas state
  const {
    zones,
    cardSize,
    canUndo,
    canRedo,
    snapToGrid,
    zoom,
    setSnapToGrid,
    setZoom,
    selectedCardIds,
    selectCard,
    selectCardRange,
    clearSelection,
    setZoneCollapsed,
    moveStack,
    deleteStack,
    renameStack,
    mergeStacks,
    setStackCollapsed,
    moveCardToStack,
    moveCardToNewStack,
    moveSelectedToStack,
    moveSelectedToNewStack,
    deleteSelectedCards,
    setStackColor,
    setCardSize,
    undo,
    redo,
    resetLayout,
    exportLayout,
    importLayout,
    repositionOffscreenStacks,
    autoLayout,
    findStackById,
  } = useCanvasState({
    storageKey,
    initialZones,
    canvasWidth: containerRef.current?.clientWidth || 800,
    cardZoneAssignments,
  });


  // Reposition stacks on resize to keep them visible
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        repositionOffscreenStacks(containerRef.current.clientWidth);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [repositionOffscreenStacks]);

  // Get sorted card IDs for a stack (matches visual order in ZoneCanvas.resolveStackCards)
  // MUST filter and sort exactly the same way as ZoneCanvas to match displayed cards
  const getSortedCardIds = useCallback((stack: { cardIds: (string | number)[] }): (string | number)[] => {
    // First, filter to only cards that exist in data (same as resolveStackCards filter)
    const validCardIds = stack.cardIds.filter(id => getCardData(id) !== null);

    if (sortBy === 'none' || sortBy === 'pick') {
      return validCardIds;
    }

    // Sort card IDs by the same criteria as ZoneCanvas.resolveStackCards
    return [...validCardIds].sort((aId, bId) => {
      const a = getCardData(aId);
      const b = getCardData(bId);
      if (!a || !b) return 0;

      let comparison = 0;
      const aAttrs = a.attributes || {};
      const bAttrs = b.attributes || {};

      if (sortBy === 'score') {
        comparison = (b.score ?? 0) - (a.score ?? 0);
      } else if (sortBy === 'name') {
        comparison = (a.name || '').localeCompare(b.name || '');
      } else if (sortBy === 'level') {
        const aLevel = (aAttrs.level as number) ?? (aAttrs.cmc as number) ?? 0;
        const bLevel = (bAttrs.level as number) ?? (bAttrs.cmc as number) ?? 0;
        comparison = bLevel - aLevel;
      } else if (sortBy === 'atk') {
        const aAtk = (aAttrs.atk as number) ?? -1;
        const bAtk = (bAttrs.atk as number) ?? -1;
        comparison = bAtk - aAtk;
      } else if (sortBy === 'def') {
        const aDef = (aAttrs.def as number) ?? -1;
        const bDef = (bAttrs.def as number) ?? -1;
        comparison = bDef - aDef;
      } else if (sortBy === 'type') {
        comparison = (a.type || '').localeCompare(b.type || '');
      }

      return sortDirection === 'asc' ? -comparison : comparison;
    });
  }, [sortBy, sortDirection, getCardData]);

  // Keyboard navigation
  const {
    navState,
    focusedCardId,
    setFocus,
  } = useCanvasKeyboardNavigation({
    zones,
    cardSize,
    containerWidth: containerRef.current?.clientWidth || 800,
    enabled: keyboardEnabled,
    onCardSelect: (cardId, card) => {
      if (card) {
        onCardClick?.(cardId, card);
      }
    },
    onStackDelete: (stackId) => {
      deleteStack(stackId);
    },
    onClearSelection: () => {
      clearSelection();
    },
    getCardData,
    getSortedCardIds,
  });

  // Track active drag for drop handling
  const [activeDrag, setActiveDrag] = useState<{
    type: 'stack' | 'card';
    data: DragData;
  } | null>(null);

  // Track pointer position during drag for accurate drop placement
  const pointerPositionRef = useRef<{ x: number; y: number } | null>(null);

  // Configure sensors - more forgiving for mobile touch
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: isMobile ? 8 : 3 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,      // Longer to prevent accidental drags while scrolling
        tolerance: 10,   // More forgiving for finger jitter
      },
    })
  );




  // Notify parent of layout changes
  useEffect(() => {
    onLayoutChange?.(zones);
  }, [zones, onLayoutChange]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current as DragData;
    setActiveDrag({ type: data.type as 'stack' | 'card', data });
    // Reset pointer position at drag start
    pointerPositionRef.current = null;
  }, []);

  // Handle drag move to track pointer position for accurate drop placement
  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const activatorEvent = event.activatorEvent;

    let clientX: number | undefined;
    let clientY: number | undefined;

    // Handle TouchEvent (mobile)
    if (activatorEvent instanceof TouchEvent) {
      const touch = activatorEvent.touches[0] || activatorEvent.changedTouches[0];
      if (touch) {
        clientX = touch.clientX;
        clientY = touch.clientY;
      }
    }
    // Handle PointerEvent/MouseEvent (desktop)
    else if (activatorEvent instanceof PointerEvent || activatorEvent instanceof MouseEvent) {
      clientX = activatorEvent.clientX;
      clientY = activatorEvent.clientY;
    }

    if (clientX !== undefined && clientY !== undefined) {
      pointerPositionRef.current = {
        x: clientX + event.delta.x,
        y: clientY + event.delta.y,
      };
    }
  }, []);

  // Handle drag over (for hover effects)
  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Could track hover state here for ghost preview
  }, []);

  // Helper to find zone for a stack
  const findZoneForStack = useCallback((stackId: string): string | null => {
    for (const zone of zones) {
      if (zone.stacks.some(s => s.id === stackId)) {
        return zone.zoneId;
      }
    }
    return null;
  }, [zones]);

  // Helper to get validated zone (handles redirects)
  const getValidatedZone = useCallback((cardId: string | number, fromZone: string, toZone: string): string | false => {
    if (fromZone === toZone) return toZone;
    if (!validateZoneMove) return toZone;
    return validateZoneMove(cardId, fromZone, toZone);
  }, [validateZoneMove]);

  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over, delta } = event;

    if (!activeDrag) return;

    const activeData = active.data.current as DragData;

    // Stack drag
    if (activeData.type === 'stack' && activeData.stackId) {
      const stackResult = findStackById(activeData.stackId);
      if (!stackResult) return;

      // Check if dropped on another stack (merge)
      if (over?.data.current?.type === 'stack') {
        const targetStackId = over.data.current.stackId as string;
        if (targetStackId !== activeData.stackId) {
          // Validate zone move if merging into a stack in a different zone
          const targetZone = findZoneForStack(targetStackId);
          if (targetZone && targetZone !== activeData.zoneId) {
            // For stacks, all cards must be able to go to the same zone (no mixed redirects)
            const validatedZones = stackResult.stack.cardIds.map(cardId =>
              getValidatedZone(cardId, activeData.zoneId, targetZone)
            );
            // Block if any card is blocked or would redirect differently
            if (validatedZones.some(z => z === false) ||
                validatedZones.some(z => z !== targetZone)) {
              setActiveDrag(null);
              pointerPositionRef.current = null;
              return;
            }
          }
          mergeStacks(activeData.stackId, targetStackId);
        }
      } else {
        // Determine target zone
        let targetZoneId = over?.data.current?.zoneId || activeData.zoneId;

        // Validate zone move if moving to a different zone
        const isMovingToNewZone = targetZoneId !== activeData.zoneId;
        if (isMovingToNewZone) {
          const validatedZones = stackResult.stack.cardIds.map(cardId =>
            getValidatedZone(cardId, activeData.zoneId, targetZoneId)
          );
          // Block if any card is blocked or would redirect differently
          if (validatedZones.some(z => z === false) ||
              new Set(validatedZones).size > 1) {
            setActiveDrag(null);
            pointerPositionRef.current = null;
            return;
          }
          // Use the validated zone (all cards redirect to same zone)
          if (validatedZones[0] && validatedZones[0] !== targetZoneId) {
            targetZoneId = validatedZones[0];
          }
        }

        // Calculate new position
        let newPosition: { x: number; y: number };

        if (isMovingToNewZone) {
          // Cross-zone drop: use pointer position relative to target zone
          const zoneElement = document.getElementById(`zone-${targetZoneId}`);
          const pointerPos = pointerPositionRef.current;

          if (pointerPos && zoneElement) {
            const zoneRect = zoneElement.getBoundingClientRect();
            // Account for zoom level - positions inside zone are in unscaled coordinates
            newPosition = {
              x: Math.max(8, (pointerPos.x - zoneRect.left) / zoom - STACK_DIMENSIONS[cardSize].width / 2),
              y: Math.max(8, (pointerPos.y - zoneRect.top) / zoom - STACK_DIMENSIONS[cardSize].headerHeight / 2),
            };
          } else {
            // Fallback: place at default position
            newPosition = { x: 8, y: 8 };
          }
        } else {
          // Same-zone move: use original position + drag delta
          newPosition = {
            x: Math.max(0, stackResult.stack.position.x + delta.x),
            y: Math.max(0, stackResult.stack.position.y + delta.y),
          };
        }

        moveStack(activeData.stackId, targetZoneId, newPosition);
      }
    }

    // Card drag
    if (activeData.type === 'card' && activeData.cardId !== undefined && activeData.stackId) {
      if (!over) {
        // Dropped in whitespace - create new stack at drop position (same zone)
        const sourceStack = findStackById(activeData.stackId);
        const cardIndex = sourceStack?.stack.cardIds.indexOf(activeData.cardId) ?? 0;

        const startX = sourceStack?.stack.position.x ?? 0;
        const startY = (sourceStack?.stack.position.y ?? 0) +
          STACK_DIMENSIONS[cardSize].headerHeight +
          cardIndex * STACK_DIMENSIONS[cardSize].cardOffset;

        moveCardToNewStack(
          activeData.cardId,
          activeData.stackId,
          activeData.zoneId,
          { x: Math.max(0, startX + delta.x), y: Math.max(0, startY + delta.y) }
        );
      } else if (over.data.current?.type === 'stack') {
        // Dropped on a stack - move to that stack
        const targetStackId = over.data.current.stackId as string;
        if (targetStackId !== activeData.stackId) {
          // Validate zone move if dropping into a stack in a different zone
          const targetZone = findZoneForStack(targetStackId);
          if (targetZone && targetZone !== activeData.zoneId) {
            const validatedZone = getValidatedZone(activeData.cardId, activeData.zoneId, targetZone);
            if (validatedZone === false) {
              setActiveDrag(null);
              pointerPositionRef.current = null;
              return;
            }
            // If redirected to a different zone, create new stack there instead
            if (validatedZone !== targetZone) {
              moveCardToNewStack(
                activeData.cardId,
                activeData.stackId,
                validatedZone,
                { x: 8, y: 8 }
              );
              setActiveDrag(null);
              pointerPositionRef.current = null;
              return;
            }
          }
          moveCardToStack(activeData.cardId, activeData.stackId, targetStackId);
        }
      } else if (over.data.current?.type === 'zone-whitespace') {
        // Dropped on zone whitespace - create new stack
        let finalZoneId = over.data.current.zoneId as string;

        // Validate and potentially redirect zone move
        if (finalZoneId !== activeData.zoneId) {
          const validatedZone = getValidatedZone(activeData.cardId, activeData.zoneId, finalZoneId);
          if (validatedZone === false) {
            setActiveDrag(null);
            pointerPositionRef.current = null;
            return;
          }
          finalZoneId = validatedZone;
        }

        // Get the zone element to calculate position relative to it
        const zoneElement = document.getElementById(`zone-${finalZoneId}`);
        const pointerPos = pointerPositionRef.current;

        let dropPosition: { x: number; y: number };

        if (pointerPos && zoneElement) {
          // Use actual pointer position relative to the target zone
          const zoneRect = zoneElement.getBoundingClientRect();
          // Account for zoom level - positions inside zone are in unscaled coordinates
          dropPosition = {
            x: Math.max(8, (pointerPos.x - zoneRect.left) / zoom - CARD_DIMENSIONS[cardSize].width / 2),
            y: Math.max(8, (pointerPos.y - zoneRect.top) / zoom - CARD_DIMENSIONS[cardSize].height / 2),
          };
        } else {
          // Fallback: use original position + delta method
          const sourceStack = findStackById(activeData.stackId);
          const cardIndex = sourceStack?.stack.cardIds.indexOf(activeData.cardId) ?? 0;
          const startX = sourceStack?.stack.position.x ?? 0;
          const startY = (sourceStack?.stack.position.y ?? 0) +
            STACK_DIMENSIONS[cardSize].headerHeight +
            cardIndex * STACK_DIMENSIONS[cardSize].cardOffset;
          dropPosition = {
            x: Math.max(0, startX + delta.x),
            y: Math.max(0, startY + delta.y),
          };
        }

        moveCardToNewStack(
          activeData.cardId,
          activeData.stackId,
          finalZoneId,
          dropPosition
        );
      }
    }

    setActiveDrag(null);
    pointerPositionRef.current = null;
  }, [activeDrag, findStackById, findZoneForStack, getValidatedZone, moveStack, mergeStacks, moveCardToStack, moveCardToNewStack, cardSize, zoom]);

  // Handle reset layout
  const handleResetLayout = useCallback(() => {
    resetLayout(initialZones);
  }, [resetLayout, initialZones]);

  // Handle card click with selection support
  const handleCardClick = useCallback((cardId: string | number, card: Card, e?: React.MouseEvent) => {
    // Handle multi-select with modifier keys
    if (e?.shiftKey) {
      // Shift+click: range select within current stack
      const stackResult = zones.flatMap(z => z.stacks).find(s => s.cardIds.includes(cardId));
      if (stackResult && navState.focusedStackId) {
        const focusedStack = zones.flatMap(z => z.stacks).find(s => s.id === navState.focusedStackId);
        if (focusedStack && focusedStack.id === stackResult.id) {
          // Use sorted order to get the focused card ID
          const sortedIds = getSortedCardIds(focusedStack);
          const currentFocusedCardId = sortedIds[navState.focusedCardIndex];
          if (currentFocusedCardId !== undefined) {
            selectCardRange(currentFocusedCardId, cardId, stackResult.id);
            return;
          }
        }
      }
      selectCard(cardId, 'add');
    } else if (e?.ctrlKey || e?.metaKey) {
      // Ctrl/Cmd+click: toggle individual selection
      selectCard(cardId, 'toggle');
    } else {
      // Normal click: clear selection and select single
      clearSelection();
      // Also set focus for keyboard navigation - use sorted index
      const stack = zones.flatMap(z => z.stacks).find(s => s.cardIds.includes(cardId));
      if (stack) {
        const sortedIds = getSortedCardIds(stack);
        const cardIndex = sortedIds.indexOf(cardId);
        setFocus(stack.id, cardIndex >= 0 ? cardIndex : 0);
      }
      // Call the external click handler
      onCardClick?.(cardId, card);
    }
  }, [zones, navState, selectCard, selectCardRange, clearSelection, setFocus, onCardClick, getSortedCardIds]);

  // Get all stacks for selection action bar
  const allStacks = zones.flatMap(zone => zone.stacks);

  // Handle move to stack from selection bar
  const handleMoveSelectedToStack = useCallback((stackId: string) => {
    moveSelectedToStack(stackId);
  }, [moveSelectedToStack]);

  // Handle create new stack from selection
  const handleCreateNewStackFromSelection = useCallback(() => {
    const firstZone = zones[0];
    if (firstZone) {
      // Calculate a reasonable position for the new stack
      const existingStacks = firstZone.stacks;
      const maxX = existingStacks.length > 0
        ? Math.max(...existingStacks.map(s => s.position.x)) + 150
        : 8;
      moveSelectedToNewStack(firstZone.zoneId, { x: maxX, y: 8 });
    }
  }, [zones, moveSelectedToNewStack]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col gap-4',
        'overflow-x-hidden overscroll-contain',  // Prevent horizontal scroll
        className
      )}
    >
      {/* Toolbar */}
      <CanvasToolbar
        cardSize={cardSize}
        onCardSizeChange={setCardSize}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onResetLayout={handleResetLayout}
        onAutoLayout={() => autoLayout(containerRef.current?.clientWidth || 800)}
        snapToGrid={snapToGrid}
        onSnapToGridChange={setSnapToGrid}
        zoom={zoom}
        onZoomChange={setZoom}
        onExportLayout={exportLayout}
        onImportLayout={importLayout}
        isMobile={isMobile}
      />

      {/* DnD Context */}
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Zones */}
        {zones.map(zone => (
          <ZoneCanvas
            key={zone.zoneId}
            zone={zone}
            cardSize={cardSize}
            showTier={showTier}
            selectedCardId={selectedCardId}
            highlightedCardId={highlightedCardId}
            searchQuery={searchQuery}
            multiSelectCardIds={selectedCardIds}
            focusedStackId={navState.focusedStackId}
            focusedCardId={focusedCardId}
            zoom={zoom}
            showGrid={snapToGrid}
            gridSize={20}
            sortBy={sortBy}
            sortDirection={sortDirection}
            getCardData={getCardData}
            onZoneCollapsedChange={(collapsed) => setZoneCollapsed(zone.zoneId, collapsed)}
            onStackMove={(stackId, position) => moveStack(stackId, zone.zoneId, position)}
            onStackRename={renameStack}
            onStackCollapsedChange={setStackCollapsed}
            onStackDelete={deleteStack}
            onStackColorChange={setStackColor}
            onCardClick={handleCardClick}
            label={zoneLabels[zone.zoneId] || zone.zoneId}
            isMobile={isMobile}
          />
        ))}

        {/* DragOverlay shows a preview of the dragged item floating above everything */}
        <DragOverlay dropAnimation={null}>
          {activeDrag?.type === 'card' && activeDrag.data.card && (
            <div
              className="pointer-events-none opacity-90 shadow-2xl ring-2 ring-gold-400 rounded-lg"
              style={{
                width: CARD_DIMENSIONS[cardSize].width,
                height: CARD_DIMENSIONS[cardSize].height,
              }}
            >
              <GameCard
                card={activeDrag.data.card}
                size="full"
                showTier={showTier}
                flush
              />
            </div>
          )}
          {activeDrag?.type === 'stack' && activeDrag.data.stackId && (() => {
            const stackResult = findStackById(activeDrag.data.stackId);
            if (!stackResult) return null;
            const { stack } = stackResult;
            const maxCardsToShow = 5;
            const cardIds = stack.cardIds.slice(0, maxCardsToShow);
            const remainingCount = stack.cardIds.length - maxCardsToShow;

            return (
              <div
                className="pointer-events-none opacity-90 shadow-2xl"
                style={{ width: STACK_DIMENSIONS[cardSize].width }}
              >
                {/* Stack header */}
                <div className="bg-yugi-card border border-yugi-border rounded-t-lg px-2 py-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-300 truncate">
                    {stack.name || 'Stack'}
                  </span>
                  <span className="text-xs text-gray-500">{stack.cardIds.length}</span>
                </div>
                {/* Cards preview */}
                <div className="relative bg-yugi-darker/50 rounded-b-lg overflow-hidden border-x border-b border-yugi-border">
                  {cardIds.map((cardId, idx) => {
                    const card = getCardData(cardId);
                    if (!card) return null;
                    return (
                      <div
                        key={cardId}
                        className="relative"
                        style={{
                          marginTop: idx === 0 ? 0 : -CARD_DIMENSIONS[cardSize].height + STACK_DIMENSIONS[cardSize].cardOffset,
                          zIndex: idx,
                        }}
                      >
                        <GameCard card={card} size="full" showTier={showTier} flush />
                      </div>
                    );
                  })}
                  {remainingCount > 0 && (
                    <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                      +{remainingCount} more
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </DragOverlay>
      </DndContext>

      {/* Selection Action Bar */}
      <SelectionActionBar
        selectedCount={selectedCardIds.size}
        availableStacks={allStacks}
        onMoveToStack={handleMoveSelectedToStack}
        onCreateNewStack={handleCreateNewStackFromSelection}
        onDeleteSelected={deleteSelectedCards}
        onClearSelection={clearSelection}
      />
    </div>
  );
}

export default CanvasMode;
