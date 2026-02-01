/**
 * DraftCanvasView - Wrapper for CanvasMode specifically for the Draft page
 *
 * Adapts the CanvasMode to work with the Draft page's data patterns,
 * handling the conversion from card arrays to zone-based canvas state.
 */

import { useMemo, useCallback } from 'react';
import { CanvasMode } from './CanvasMode';
import { buildInitialZones, type CardWithId } from './buildInitialZones';
import type { ZoneCanvas } from './types';
import type { Card } from '../../types/card';
import type { YuGiOhCard } from '../../types';
import type { PileGroup } from '../../config/gameConfig';
import { toCardWithAttributes } from '../../types';

export interface DraftCanvasViewProps {
  /** Session ID for persistence key */
  sessionId: string;
  /** All drafted cards */
  draftedCards: YuGiOhCard[];
  /** Pile groups for auto-categorization */
  pileGroups?: PileGroup[];
  /** Whether to show tier badges */
  showTier?: boolean;
  /** Called when a card is clicked */
  onCardClick?: (card: YuGiOhCard, index: number) => void;
  /** Selected card ID (for highlighting) */
  selectedCardId?: number;
  /** Highlighted card index (from navigation) */
  highlightedIndex?: number;
  /** Search query for highlighting matching cards */
  searchQuery?: string;
  /** Sort configuration */
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  /** Additional class name */
  className?: string;
}

export function DraftCanvasView({
  sessionId,
  draftedCards,
  pileGroups = [],
  showTier = true,
  onCardClick,
  selectedCardId,
  highlightedIndex,
  searchQuery,
  sortBy = 'none',
  sortDirection = 'desc',
  className,
}: DraftCanvasViewProps) {
  // Convert YuGiOhCard[] to Card[] with IDs
  const cardsWithIds = useMemo<CardWithId[]>(() => {
    return draftedCards.map((card) => ({
      id: card.id, // Use card ID, not index
      card: toCardWithAttributes(card),
    }));
  }, [draftedCards]);

  // Create card lookup map
  const cardMap = useMemo(() => {
    const map = new Map<string | number, Card>();
    cardsWithIds.forEach(({ id, card }) => map.set(id, card));
    return map;
  }, [cardsWithIds]);

  // Get card data by ID
  const getCardData = useCallback((cardId: string | number): Card | null => {
    return cardMap.get(cardId) || null;
  }, [cardMap]);

  // Build initial zones (when no saved state exists)
  const initialZones = useMemo<ZoneCanvas[]>(() => {
    if (draftedCards.length === 0) {
      return [{
        zoneId: 'main',
        stacks: [],
        collapsed: false,
      }];
    }

    return buildInitialZones({
      cards: cardsWithIds,
      pileGroups,
      cardSize: 'normal',
      canvasWidth: 800,
      zoneIds: ['main'],
    });
  }, [cardsWithIds, pileGroups]);

  const storageKey = `canvas-draft-${sessionId}`;

  // Handle card click - translate back to YuGiOhCard
  const handleCardClick = useCallback((cardId: string | number, _card: Card) => {
    if (!onCardClick) return;

    // Find the original YuGiOhCard and its index
    const index = draftedCards.findIndex(c => c.id === cardId);
    if (index !== -1) {
      onCardClick(draftedCards[index], index);
    }
  }, [onCardClick, draftedCards]);

  // Get highlighted card ID from index
  const highlightedCardId = useMemo(() => {
    if (highlightedIndex === undefined || highlightedIndex < 0) return undefined;
    return draftedCards[highlightedIndex]?.id;
  }, [highlightedIndex, draftedCards]);

  // Zone labels
  const zoneLabels = useMemo(() => ({
    main: 'My Cards',
    extra: 'Extra Deck',
    side: 'Side Deck',
  }), []);

  // If no cards, show empty state
  if (draftedCards.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-500 py-8">
        No cards drafted yet
      </div>
    );
  }

  return (
    <CanvasMode
      storageKey={storageKey}
      initialZones={initialZones}
      getCardData={getCardData}
      zoneLabels={zoneLabels}
      showTier={showTier}
      selectedCardId={selectedCardId}
      highlightedCardId={highlightedCardId}
      searchQuery={searchQuery}
      sortBy={sortBy}
      sortDirection={sortDirection}
      onCardClick={handleCardClick}
      className={className}
    />
  );
}
