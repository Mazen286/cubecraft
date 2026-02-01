/**
 * ResultsCanvasView - Wrapper for CanvasMode for the Results page
 *
 * Handles the conversion from deck zone cards to canvas zones,
 * supporting Main/Extra/Side/Pool zones with cross-zone movement.
 */

import { useMemo, useCallback, useEffect, useRef } from 'react';
import { CanvasMode } from './CanvasMode';
import { buildInitialZones, type CardWithId } from './buildInitialZones';
import { useIsMobile } from '../../hooks/useIsMobile';
import type { ZoneCanvas } from './types';
import type { Card } from '../../types/card';
import type { YuGiOhCard } from '../../types';
import type { PileGroup, GameConfig } from '../../config/gameConfig';
import { toCardWithAttributes } from '../../types';

export type DeckZone = 'main' | 'extra' | 'side' | 'pool';

export interface ResultsCanvasViewProps {
  /** Session ID for persistence key */
  sessionId: string;
  /** Game configuration for zone names and visibility */
  gameConfig: GameConfig;
  /** Cards in main deck */
  mainDeckCards: YuGiOhCard[];
  /** Cards in extra deck */
  extraDeckCards: YuGiOhCard[];
  /** Cards in side deck */
  sideDeckCards: YuGiOhCard[];
  /** Cards in pool (not in any deck) */
  poolCards: YuGiOhCard[];
  /** Pile groups for auto-categorization */
  pileGroups?: PileGroup[];
  /** Whether to show tier badges */
  showTier?: boolean;
  /** Called when a card is clicked */
  onCardClick?: (card: YuGiOhCard, index: number) => void;
  /** Called when cards move between zones */
  onZoneChange?: (cardId: number, fromZone: DeckZone, toZone: DeckZone) => void;
  /** Validates/redirects zone moves. Return the zone to use, or false to block entirely. */
  validateZoneMove?: (cardId: number, fromZone: DeckZone, toZone: DeckZone) => DeckZone | false;
  /** Selected card ID (for highlighting) */
  selectedCardId?: number;
  /** Highlighted card index */
  highlightedIndex?: number;
  /** Search query for highlighting matching cards */
  searchQuery?: string;
  /** Sort configuration */
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  /** Additional class name */
  className?: string;
  /** Whether keyboard navigation is enabled (disable when bottom sheet is open) */
  keyboardEnabled?: boolean;
}

export function ResultsCanvasView({
  sessionId,
  gameConfig,
  mainDeckCards,
  extraDeckCards,
  sideDeckCards,
  poolCards,
  pileGroups = [],
  showTier = true,
  onCardClick,
  onZoneChange,
  validateZoneMove,
  selectedCardId,
  highlightedIndex,
  searchQuery,
  sortBy = 'none',
  sortDirection = 'desc',
  className,
  keyboardEnabled = true,
}: ResultsCanvasViewProps) {
  const isMobile = useIsMobile();

  // Track previous zones for detecting cross-zone movements
  const prevZonesRef = useRef<ZoneCanvas[]>([]);
  // Skip zone change detection during initial load to prevent false positives
  const isInitialLoad = useRef(true);

  // Combine all cards and create card lookup
  const allCards = useMemo(() => {
    return [
      ...mainDeckCards.map((card, i) => ({ card, zone: 'main' as DeckZone, originalIndex: i })),
      ...extraDeckCards.map((card, i) => ({ card, zone: 'extra' as DeckZone, originalIndex: i + mainDeckCards.length })),
      ...sideDeckCards.map((card, i) => ({ card, zone: 'side' as DeckZone, originalIndex: i + mainDeckCards.length + extraDeckCards.length })),
      ...poolCards.map((card, i) => ({ card, zone: 'pool' as DeckZone, originalIndex: i + mainDeckCards.length + extraDeckCards.length + sideDeckCards.length })),
    ];
  }, [mainDeckCards, extraDeckCards, sideDeckCards, poolCards]);

  // Convert to CardWithId format
  const cardsWithIds = useMemo<CardWithId[]>(() => {
    return allCards.map(({ card }) => ({
      id: card.id,
      card: toCardWithAttributes(card),
    }));
  }, [allCards]);

  // Create card lookup map
  const cardMap = useMemo(() => {
    const map = new Map<string | number, Card>();
    cardsWithIds.forEach(({ id, card }) => map.set(id, card));
    return map;
  }, [cardsWithIds]);

  // Create zone assignments map
  const zoneAssignments = useMemo(() => {
    const map = new Map<string | number, string>();
    allCards.forEach(({ card, zone }) => map.set(card.id, zone));
    return map;
  }, [allCards]);

  // Get card data by ID
  const getCardData = useCallback((cardId: string | number): Card | null => {
    return cardMap.get(cardId) || null;
  }, [cardMap]);

  // Get available zone IDs from game config
  const availableZoneIds = useMemo(() => {
    return gameConfig.deckZones.map(z => z.id);
  }, [gameConfig.deckZones]);

  // Build initial zones
  const initialZones = useMemo<ZoneCanvas[]>(() => {
    const totalCards = allCards.length;
    if (totalCards === 0) {
      // Create empty zones based on game config
      return availableZoneIds.map((zoneId, index) => ({
        zoneId,
        stacks: [],
        collapsed: index > 0, // Only first zone (main) is expanded
      }));
    }

    return buildInitialZones({
      cards: cardsWithIds,
      zoneAssignments,
      pileGroups,
      cardSize: isMobile ? 'compact' : 'normal',
      canvasWidth: 800,
      zoneIds: availableZoneIds,
      isMobile,
    });
  }, [cardsWithIds, zoneAssignments, pileGroups, allCards.length, availableZoneIds, isMobile]);

  const storageKey = `canvas-results-${sessionId}`;

  // Handle card click - translate back to YuGiOhCard
  const handleCardClick = useCallback((cardId: string | number, _card: Card) => {
    if (!onCardClick) return;

    // Find the original YuGiOhCard and its index
    const cardInfo = allCards.find(c => c.card.id === cardId);
    if (cardInfo) {
      onCardClick(cardInfo.card, cardInfo.originalIndex);
    }
  }, [onCardClick, allCards]);

  // Handle layout changes - detect cross-zone movements
  // Only tracks user-initiated moves, not initial load or zone sync operations
  const handleLayoutChange = useCallback((zones: ZoneCanvas[]) => {
    if (!onZoneChange) return;

    // Skip during initial load to prevent false zone change detection
    if (isInitialLoad.current) {
      prevZonesRef.current = zones;
      return;
    }

    const prevZones = prevZonesRef.current;
    if (prevZones.length === 0) {
      prevZonesRef.current = zones;
      return;
    }

    // Build cardId -> zoneId maps for before and after
    const prevCardZones = new Map<string | number, string>();
    const newCardZones = new Map<string | number, string>();

    for (const zone of prevZones) {
      for (const stack of zone.stacks) {
        for (const cardId of stack.cardIds) {
          prevCardZones.set(cardId, zone.zoneId);
        }
      }
    }

    for (const zone of zones) {
      for (const stack of zone.stacks) {
        for (const cardId of stack.cardIds) {
          newCardZones.set(cardId, zone.zoneId);
        }
      }
    }

    // Find cards that moved zones and notify parent
    for (const [cardId, newZone] of newCardZones) {
      const prevZone = prevCardZones.get(cardId);
      if (prevZone && prevZone !== newZone) {
        onZoneChange(cardId as number, prevZone as DeckZone, newZone as DeckZone);
      }
    }

    prevZonesRef.current = zones;
  }, [onZoneChange]);

  // Initialize prevZonesRef when initialZones first become available
  useEffect(() => {
    if (prevZonesRef.current.length === 0 && initialZones.length > 0) {
      prevZonesRef.current = initialZones;
    }
  }, [initialZones]);

  // Mark initial load complete after component mounts and settles
  // This must be separate from the initialZones effect to avoid resetting the timer
  useEffect(() => {
    const timer = setTimeout(() => {
      isInitialLoad.current = false;
    }, 300);
    return () => clearTimeout(timer);
  }, []); // Empty deps - only run once on mount

  // Get highlighted card ID from index
  const highlightedCardId = useMemo(() => {
    if (highlightedIndex === undefined || highlightedIndex < 0) return undefined;
    return allCards[highlightedIndex]?.card.id;
  }, [highlightedIndex, allCards]);

  // Wrap validateZoneMove to convert types
  const handleValidateZoneMove = useCallback((cardId: string | number, fromZone: string, toZone: string): string | false => {
    if (!validateZoneMove) return toZone; // No validation, allow as-is
    return validateZoneMove(cardId as number, fromZone as DeckZone, toZone as DeckZone);
  }, [validateZoneMove]);

  // Zone labels from game config
  const zoneLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const zone of gameConfig.deckZones) {
      labels[zone.id] = zone.name;
    }
    return labels;
  }, [gameConfig.deckZones]);

  // If no cards at all, show empty state
  if (allCards.length === 0) {
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
      onLayoutChange={handleLayoutChange}
      validateZoneMove={handleValidateZoneMove}
      cardZoneAssignments={zoneAssignments}
      className={className}
      keyboardEnabled={keyboardEnabled}
    />
  );
}
