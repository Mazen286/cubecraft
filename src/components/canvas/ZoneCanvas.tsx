/**
 * ZoneCanvas - A single zone's freeform canvas
 *
 * Contains stacks that can be positioned freely within the zone.
 * Handles drop events for creating new stacks or moving cards.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { DraggableStack } from './DraggableStack';
import type { ZoneCanvas as ZoneCanvasType, CanvasStack, CardSize, ResolvedCard } from './types';
import { STACK_DIMENSIONS, CARD_DIMENSIONS } from './types';
import type { Card } from '../../types/card';

export interface ZoneCanvasProps {
  zone: ZoneCanvasType;
  cardSize: CardSize;
  showTier?: boolean;
  selectedCardId?: string | number;
  highlightedCardId?: string | number;
  /** Search query for highlighting matching cards */
  searchQuery?: string;
  /** Set of selected card IDs for multi-select */
  multiSelectCardIds?: Set<string | number>;
  /** Currently focused stack ID for keyboard navigation */
  focusedStackId?: string | null;
  /** Currently focused card ID for keyboard navigation */
  focusedCardId?: string | number | null;
  /** Zoom level (0.5 - 1.5) */
  zoom?: number;
  /** Whether snap-to-grid is enabled (for visual grid overlay) */
  showGrid?: boolean;
  /** Grid size in pixels */
  gridSize?: number;
  /** Sort configuration for cards within stacks */
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  /** Whether on mobile device */
  isMobile?: boolean;

  // Card data resolver
  getCardData: (cardId: string | number) => Card | null;

  // Zone operations
  onZoneCollapsedChange: (collapsed: boolean) => void;

  // Stack operations
  onStackMove: (stackId: string, position: { x: number; y: number }) => void;
  onStackRename: (stackId: string, name: string) => void;
  onStackCollapsedChange: (stackId: string, collapsed: boolean) => void;
  onStackDelete: (stackId: string) => void;
  onStackColorChange?: (stackId: string, color: string | null) => void;

  // Card operations
  onCardClick?: (cardId: string | number, card: Card, e?: React.MouseEvent) => void;

  // Zone label
  label: string;
  className?: string;
}

export function ZoneCanvas({
  zone,
  cardSize,
  showTier = true,
  selectedCardId,
  highlightedCardId,
  searchQuery,
  multiSelectCardIds,
  focusedStackId,
  focusedCardId,
  zoom = 1,
  showGrid = false,
  gridSize = 20,
  sortBy = 'none',
  sortDirection = 'desc',
  isMobile = false,
  getCardData,
  onZoneCollapsedChange,
  onStackMove: _onStackMove, // Not used directly here - stack moves handled via drag
  onStackRename,
  onStackCollapsedChange,
  onStackDelete,
  onStackColorChange,
  onCardClick,
  label,
  className,
}: ZoneCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasHeight, setCanvasHeight] = useState(300);

  const dims = STACK_DIMENSIONS[cardSize];
  const cardDims = CARD_DIMENSIONS[cardSize];

  // Make zone a drop target for cards (to create new stacks)
  const { setNodeRef } = useDroppable({
    id: `zone-${zone.zoneId}`,
    data: {
      type: 'zone-whitespace',
      zoneId: zone.zoneId,
    },
  });

  // Resolve and sort cards for each stack
  const resolveStackCards = useCallback((stack: CanvasStack): ResolvedCard[] => {
    const resolved = stack.cardIds
      .map(id => {
        const card = getCardData(id);
        if (!card) return null;
        return { id, card };
      })
      .filter((c): c is ResolvedCard => c !== null);

    // Apply sort if not 'none' or 'pick'
    if (sortBy === 'none' || sortBy === 'pick') {
      return resolved;
    }

    return [...resolved].sort((a, b) => {
      let comparison = 0;
      const aAttrs = a.card.attributes || {};
      const bAttrs = b.card.attributes || {};

      if (sortBy === 'score') {
        comparison = (b.card.score ?? 0) - (a.card.score ?? 0);
      } else if (sortBy === 'name') {
        comparison = (a.card.name || '').localeCompare(b.card.name || '');
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
        comparison = (a.card.type || '').localeCompare(b.card.type || '');
      }

      return sortDirection === 'asc' ? -comparison : comparison;
    });
  }, [getCardData, sortBy, sortDirection]);

  // Calculate minimum canvas height based on stack positions
  useEffect(() => {
    if (zone.collapsed) return;

    let maxY = isMobile ? 150 : 200; // Smaller min on mobile
    for (const stack of zone.stacks) {
      const cards = resolveStackCards(stack);
      const visibleCards = stack.collapsed ? 0 : Math.min(cards.length, dims.maxVisibleCards);
      const stackHeight = dims.headerHeight + (
        stack.collapsed
          ? 24
          : cards.length === 0
            ? 60
            : cardDims.height + (visibleCards - 1) * dims.cardOffset + 24
      );
      const stackBottom = stack.position.y + stackHeight;
      maxY = Math.max(maxY, stackBottom);
    }
    // Less padding on mobile
    setCanvasHeight(maxY + (isMobile ? 80 : 150));
  }, [zone, cardSize, dims, cardDims, resolveStackCards, isMobile]);

  // Total cards in zone
  const totalCards = zone.stacks.reduce((sum, s) => sum + s.cardIds.length, 0);

  return (
    <div className={cn('mb-4', className)}>
      {/* Zone Header */}
      <button
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-t-lg',
          'bg-yugi-card/70 border border-b-0 border-yugi-border',
          'hover:bg-yugi-card transition-colors',
          'text-left'
        )}
        onClick={() => onZoneCollapsedChange(!zone.collapsed)}
      >
        {zone.collapsed ? (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
        <span className="font-semibold text-white">{label}</span>
        <span className="text-sm text-gray-400">
          ({totalCards} card{totalCards !== 1 ? 's' : ''})
        </span>
      </button>

      {/* Zone Canvas */}
      {!zone.collapsed && (
        <div
          id={`zone-${zone.zoneId}`}
          ref={(node) => {
            canvasRef.current = node;
            setNodeRef(node);
          }}
          className={cn(
            'relative overflow-y-auto overflow-x-hidden',
            'bg-yugi-dark/50 border border-yugi-border rounded-b-lg',
            'transition-colors',
            'touch-pan-y overscroll-contain'  // Better touch handling
          )}
          style={{
            minHeight: isMobile ? 150 : 200,
            height: canvasHeight * zoom,
            maxHeight: isMobile ? 'calc(100vh - 200px)' : 600,  // Dynamic on mobile
          }}
        >
          {/* Grid overlay when snap is enabled - very subtle */}
          {showGrid && (
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.07]"
              style={{
                backgroundImage: `
                  linear-gradient(to right, rgba(255, 255, 255, 0.5) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(255, 255, 255, 0.5) 1px, transparent 1px)
                `,
                backgroundSize: `${gridSize * zoom}px ${gridSize * zoom}px`,
              }}
            />
          )}

          {/* Scaled content container */}
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              width: `${100 / zoom}%`,
              height: `${100 / zoom}%`,
            }}
          >
            {/* Stacks */}
            {zone.stacks.map(stack => {
              const cards = resolveStackCards(stack);
              return (
                <DraggableStack
                  key={stack.id}
                  stack={stack}
                  cards={cards}
                  zoneId={zone.zoneId}
                  cardSize={cardSize}
                  showTier={showTier}
                  selectedCardId={selectedCardId}
                  highlightedCardId={highlightedCardId}
                  searchQuery={searchQuery}
                  multiSelectCardIds={multiSelectCardIds}
                  isFocused={focusedStackId === stack.id}
                  focusedCardId={focusedStackId === stack.id ? focusedCardId : undefined}
                  onRename={(name) => onStackRename(stack.id, name)}
                  onToggleCollapse={() => onStackCollapsedChange(stack.id, !stack.collapsed)}
                  onDelete={() => onStackDelete(stack.id)}
                  onColorChange={onStackColorChange ? (color) => onStackColorChange(stack.id, color) : undefined}
                  onCardClick={onCardClick}
                />
              );
            })}

            {/* Empty state */}
            {zone.stacks.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <p className="text-sm">Drop cards here to create stacks</p>
                  <p className="text-xs mt-1">or drag stacks into this zone</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
