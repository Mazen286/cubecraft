/**
 * Freeform Canvas Mode Types
 *
 * Core data structures for the canvas-based card organization system.
 * Stacks have x,y positions and exist within zones (Main/Extra/Side/Pool).
 */

import type { Card } from '../../types/card';

/**
 * A stack of cards with freeform positioning
 */
export interface CanvasStack {
  id: string;                           // "stack-{timestamp}-{random}"
  name: string;                         // "Stack 1", "Combo Pieces", etc.
  cardIds: (string | number)[];         // Card IDs in order
  position: { x: number; y: number };   // Position within zone canvas
  collapsed: boolean;                   // Expanded or collapsed view
  color?: string;                       // Optional color coding
}

/**
 * A zone containing multiple stacks
 */
export interface ZoneCanvas {
  zoneId: string;                       // "main" | "extra" | "side" | "pool"
  stacks: CanvasStack[];
  collapsed: boolean;                   // Zone section collapsed
}

/**
 * Card size options
 */
export type CardSize = 'compact' | 'normal' | 'large';

/**
 * Action types for undo/redo
 */
export type CanvasActionType =
  | 'move_stack'
  | 'move_cards'
  | 'merge_stacks'
  | 'create_stack'
  | 'delete_stack'
  | 'rename_stack'
  | 'change_card_size'
  | 'reset_layout';

/**
 * A recorded action for undo/redo
 */
export interface CanvasAction {
  type: CanvasActionType;
  before: ZoneCanvas[];
  after: ZoneCanvas[];
  timestamp: number;
}

/**
 * Complete canvas state
 */
export interface CanvasState {
  zones: ZoneCanvas[];
  cardSize: CardSize;
  history: CanvasAction[];
  historyIndex: number;
}

/**
 * Card with resolved data for rendering
 */
export interface ResolvedCard {
  id: string | number;
  card: Card;
}

/**
 * Stack with resolved card data
 */
export interface ResolvedStack extends Omit<CanvasStack, 'cardIds'> {
  cards: ResolvedCard[];
}

/**
 * Drag item types
 */
export type DragType = 'stack' | 'card' | 'selection';

/**
 * Data attached to draggable items
 */
export interface DragData {
  type: DragType;
  stackId?: string;
  cardId?: string | number;
  zoneId: string;
  card?: Card;
}

/**
 * Drop target types
 */
export type DropTargetType = 'stack' | 'zone-whitespace' | 'zone';

/**
 * Dimensions for card sizes
 */
export const CARD_DIMENSIONS: Record<CardSize, { width: number; height: number }> = {
  compact: { width: 90, height: 132 },
  normal: { width: 120, height: 176 },
  large: { width: 150, height: 219 },
};

/**
 * Stack dimensions based on card size
 */
export const STACK_DIMENSIONS: Record<CardSize, {
  width: number;
  headerHeight: number;
  cardOffset: number;
  maxVisibleCards: number;
}> = {
  compact: { width: 105, headerHeight: 36, cardOffset: 30, maxVisibleCards: 6 },
  normal: { width: 135, headerHeight: 42, cardOffset: 36, maxVisibleCards: 5 },
  large: { width: 165, headerHeight: 48, cardOffset: 42, maxVisibleCards: 4 },
};

/**
 * Generate a unique stack ID
 */
export function generateStackId(): string {
  return `stack-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate default stack name
 */
export function generateStackName(existingNames: string[]): string {
  let num = 1;
  while (existingNames.includes(`Stack ${num}`)) {
    num++;
  }
  return `Stack ${num}`;
}
