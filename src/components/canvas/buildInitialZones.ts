/**
 * buildInitialZones - Creates auto-categorized zones from cards
 *
 * Uses game config's pileGroups to organize cards into initial stacks
 * arranged in a grid layout.
 */

import type { ZoneCanvas, CanvasStack, CardSize } from './types';
import { generateStackId, STACK_DIMENSIONS, CARD_DIMENSIONS } from './types';
import type { Card } from '../../types/card';
import type { PileGroup } from '../../config/gameConfig';

export interface CardWithId {
  id: string | number;
  card: Card;
}

export interface BuildInitialZonesOptions {
  /** Cards to organize */
  cards: CardWithId[];
  /** Zone assignments for cards (cardId -> zoneId) */
  zoneAssignments?: Map<string | number, string>;
  /** Pile groups for auto-categorization */
  pileGroups?: PileGroup[];
  /** Card size for calculating grid positions */
  cardSize?: CardSize;
  /** Canvas width for grid calculations */
  canvasWidth?: number;
  /** Zones to create */
  zoneIds?: string[];
}

/**
 * Calculate actual stack height based on card count
 */
function calculateStackHeight(cardCount: number, cardSize: CardSize): number {
  const stackDims = STACK_DIMENSIONS[cardSize];
  const cardDims = CARD_DIMENSIONS[cardSize];

  if (cardCount === 0) {
    return stackDims.headerHeight + 60 + 16; // Empty state height + padding
  }

  const visibleCards = Math.min(cardCount, stackDims.maxVisibleCards);
  const cardsHeight = cardDims.height + (visibleCards - 1) * stackDims.cardOffset;
  const hasMoreBadge = cardCount > stackDims.maxVisibleCards ? 24 : 0;

  return stackDims.headerHeight + cardsHeight + hasMoreBadge + 24; // Extra padding between rows
}

/**
 * Calculate grid positions for stacks, accounting for varying heights
 */
function calculateGridPositions(
  cardCounts: number[],
  cardSize: CardSize,
  canvasWidth: number
): Array<{ x: number; y: number }> {
  const dims = STACK_DIMENSIONS[cardSize];
  // No spacing - stacks are directly adjacent
  const stackWidth = dims.width;

  const columns = Math.floor(canvasWidth / stackWidth) || 1;
  const positions: Array<{ x: number; y: number }> = [];

  // Group stacks into rows
  const rows: number[][] = [];
  for (let i = 0; i < cardCounts.length; i++) {
    const rowIndex = Math.floor(i / columns);
    if (!rows[rowIndex]) {
      rows[rowIndex] = [];
    }
    rows[rowIndex].push(cardCounts[i]);
  }

  // Calculate heights for each row (based on tallest stack in row)
  const rowHeights: number[] = rows.map(row => {
    const heights = row.map(count => calculateStackHeight(count, cardSize));
    return Math.max(...heights);
  });

  // Calculate cumulative Y positions for each row
  const rowYPositions: number[] = [8]; // Start at y=8
  for (let i = 1; i < rows.length; i++) {
    rowYPositions[i] = rowYPositions[i - 1] + rowHeights[i - 1];
  }

  // Assign positions to each stack
  for (let i = 0; i < cardCounts.length; i++) {
    const col = i % columns;
    const rowIndex = Math.floor(i / columns);
    positions.push({
      x: col * stackWidth + 8,
      y: rowYPositions[rowIndex],
    });
  }

  return positions;
}

/**
 * Build initial zones from cards using pile groups for categorization
 */
export function buildInitialZones({
  cards,
  zoneAssignments,
  pileGroups = [],
  cardSize = 'normal',
  canvasWidth = 800,
  zoneIds = ['main', 'extra', 'side'],
}: BuildInitialZonesOptions): ZoneCanvas[] {
  // Create zone structures
  const zones = new Map<string, ZoneCanvas>();
  for (const zoneId of zoneIds) {
    zones.set(zoneId, {
      zoneId,
      stacks: [],
      collapsed: false,
    });
  }

  // If we have pile groups, use them for categorization
  if (pileGroups.length > 0) {
    // Group cards by pile group
    const groupedCards = new Map<string, CardWithId[]>();
    const ungroupedCards: CardWithId[] = [];

    for (const cardWithId of cards) {
      let matched = false;
      for (const group of pileGroups) {
        if (group.matches(cardWithId.card)) {
          const existing = groupedCards.get(group.id) || [];
          existing.push(cardWithId);
          groupedCards.set(group.id, existing);
          matched = true;
          break;
        }
      }
      if (!matched) {
        ungroupedCards.push(cardWithId);
      }
    }

    // Determine target zone for each group
    // Use zoneAssignments if provided, otherwise default to 'main'
    const zoneForGroup = (cardWithId: CardWithId): string => {
      if (zoneAssignments) {
        return zoneAssignments.get(cardWithId.id) || 'main';
      }
      return 'main';
    };

    // Create stacks per zone
    // IMPORTANT: Split each pile group by zone, since cards in the same pile group
    // might belong to different zones (e.g., some Lv4 monsters in main, some in side)
    const stacksPerZone = new Map<string, CanvasStack[]>();

    for (const group of pileGroups) {
      const groupCards = groupedCards.get(group.id) || [];
      if (groupCards.length === 0) continue;

      // Split cards by their zone assignment
      const cardsByZone = new Map<string, CardWithId[]>();
      for (const cardWithId of groupCards) {
        const zone = zoneForGroup(cardWithId);
        const existing = cardsByZone.get(zone) || [];
        existing.push(cardWithId);
        cardsByZone.set(zone, existing);
      }

      // Create a stack for each zone that has cards from this group
      for (const [targetZone, zoneCards] of cardsByZone) {
        const stack: CanvasStack = {
          id: generateStackId(),
          name: group.label,
          cardIds: zoneCards.map(c => c.id),
          position: { x: 0, y: 0 }, // Will be set later
          collapsed: false,
        };

        const existing = stacksPerZone.get(targetZone) || [];
        existing.push(stack);
        stacksPerZone.set(targetZone, existing);
      }
    }

    // Handle ungrouped cards - also split by zone
    if (ungroupedCards.length > 0) {
      const cardsByZone = new Map<string, CardWithId[]>();
      for (const cardWithId of ungroupedCards) {
        const zone = zoneForGroup(cardWithId);
        const existing = cardsByZone.get(zone) || [];
        existing.push(cardWithId);
        cardsByZone.set(zone, existing);
      }

      for (const [targetZone, zoneCards] of cardsByZone) {
        const stack: CanvasStack = {
          id: generateStackId(),
          name: 'Other',
          cardIds: zoneCards.map(c => c.id),
          position: { x: 0, y: 0 },
          collapsed: false,
        };
        const existing = stacksPerZone.get(targetZone) || [];
        existing.push(stack);
        stacksPerZone.set(targetZone, existing);
      }
    }

    // Assign positions and update zones
    for (const [zoneId, stacks] of stacksPerZone) {
      // Get card counts for each stack to calculate proper heights
      const cardCounts = stacks.map(s => s.cardIds.length);
      const positions = calculateGridPositions(cardCounts, cardSize, canvasWidth);
      for (let i = 0; i < stacks.length; i++) {
        stacks[i].position = positions[i] || { x: 0, y: 0 };
      }
      const zone = zones.get(zoneId);
      if (zone) {
        zone.stacks = stacks;
      }
    }
  } else {
    // No pile groups - just put all cards in a single stack per zone
    const cardsPerZone = new Map<string, CardWithId[]>();

    for (const cardWithId of cards) {
      const zoneId = zoneAssignments?.get(cardWithId.id) || 'main';
      const existing = cardsPerZone.get(zoneId) || [];
      existing.push(cardWithId);
      cardsPerZone.set(zoneId, existing);
    }

    for (const [zoneId, zoneCards] of cardsPerZone) {
      if (zoneCards.length === 0) continue;

      const zone = zones.get(zoneId);
      if (!zone) continue;

      zone.stacks = [{
        id: generateStackId(),
        name: 'All Cards',
        cardIds: zoneCards.map(c => c.id),
        position: { x: 8, y: 8 },
        collapsed: false,
      }];
    }
  }

  return Array.from(zones.values());
}

/**
 * Build zones specifically for Yu-Gi-Oh! with Main/Extra/Side separation
 */
export function buildYuGiOhZones({
  mainDeckCards,
  extraDeckCards,
  sideDeckCards,
  pileGroups,
  cardSize = 'normal',
  canvasWidth = 800,
}: {
  mainDeckCards: CardWithId[];
  extraDeckCards: CardWithId[];
  sideDeckCards: CardWithId[];
  pileGroups?: PileGroup[];
  cardSize?: CardSize;
  canvasWidth?: number;
}): ZoneCanvas[] {
  // Create zone assignments
  const zoneAssignments = new Map<string | number, string>();
  mainDeckCards.forEach(c => zoneAssignments.set(c.id, 'main'));
  extraDeckCards.forEach(c => zoneAssignments.set(c.id, 'extra'));
  sideDeckCards.forEach(c => zoneAssignments.set(c.id, 'side'));

  const allCards = [...mainDeckCards, ...extraDeckCards, ...sideDeckCards];

  return buildInitialZones({
    cards: allCards,
    zoneAssignments,
    pileGroups,
    cardSize,
    canvasWidth,
    zoneIds: ['main', 'extra', 'side'],
  });
}
