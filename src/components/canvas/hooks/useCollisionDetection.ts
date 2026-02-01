/**
 * useCollisionDetection - Stack collision detection and resolution
 *
 * When a stack is moved and overlaps another, this calculates how to
 * push the overlapped stack out of the way.
 */

import { useCallback } from 'react';
import type { CanvasStack, CardSize } from '../types';
import { STACK_DIMENSIONS, CARD_DIMENSIONS } from '../types';

interface StackBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculate the bounds of a stack based on its position and card count
 */
function getStackBounds(
  stack: CanvasStack,
  cardSize: CardSize
): StackBounds {
  const dims = STACK_DIMENSIONS[cardSize];
  const cardDims = CARD_DIMENSIONS[cardSize];
  const visibleCards = Math.min(stack.cardIds.length, dims.maxVisibleCards);
  const height = dims.headerHeight + cardDims.height + (visibleCards - 1) * dims.cardOffset;

  return {
    id: stack.id,
    x: stack.position.x,
    y: stack.position.y,
    width: dims.width,
    height: Math.max(height, dims.headerHeight + 60), // Minimum height
  };
}

/**
 * Check if two rectangles overlap
 */
function rectsOverlap(a: StackBounds, b: StackBounds, padding = 8): boolean {
  return !(
    a.x + a.width + padding <= b.x ||
    b.x + b.width + padding <= a.x ||
    a.y + a.height + padding <= b.y ||
    b.y + b.height + padding <= a.y
  );
}

/**
 * Calculate the overlap amount between two rectangles
 */
function getOverlap(a: StackBounds, b: StackBounds): { x: number; y: number } {
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return { x: Math.max(0, overlapX), y: Math.max(0, overlapY) };
}

/**
 * Calculate push direction - push in direction of least resistance
 */
function getPushDirection(
  moving: StackBounds,
  stationary: StackBounds
): { dx: number; dy: number } {
  const movingCenterX = moving.x + moving.width / 2;
  const movingCenterY = moving.y + moving.height / 2;
  const stationaryCenterX = stationary.x + stationary.width / 2;
  const stationaryCenterY = stationary.y + stationary.height / 2;

  const diffX = stationaryCenterX - movingCenterX;
  const diffY = stationaryCenterY - movingCenterY;

  const overlap = getOverlap(moving, stationary);

  // Push in direction where there's less overlap (path of least resistance)
  if (overlap.x < overlap.y) {
    // Push horizontally
    return { dx: diffX > 0 ? overlap.x + 16 : -(overlap.x + 16), dy: 0 };
  } else {
    // Push vertically
    return { dx: 0, dy: diffY > 0 ? overlap.y + 16 : -(overlap.y + 16) };
  }
}

export interface CollisionResult {
  stackId: string;
  newPosition: { x: number; y: number };
}

export function useCollisionDetection() {
  /**
   * Resolve collisions for a moved stack
   * Returns array of stacks that need to be repositioned
   */
  const resolveCollisions = useCallback((
    movedStack: CanvasStack,
    allStacks: CanvasStack[],
    cardSize: CardSize,
    canvasWidth: number,
    maxIterations = 10
  ): CollisionResult[] => {
    const results: CollisionResult[] = [];
    const stackPositions = new Map<string, { x: number; y: number }>();

    // Initialize with current positions
    allStacks.forEach(s => {
      stackPositions.set(s.id, { ...s.position });
    });

    // Update moved stack position
    stackPositions.set(movedStack.id, { ...movedStack.position });

    // Iteratively resolve collisions
    let iterations = 0;
    let hasCollision = true;

    while (hasCollision && iterations < maxIterations) {
      hasCollision = false;
      iterations++;

      const movedBounds = getStackBounds(
        { ...movedStack, position: stackPositions.get(movedStack.id)! },
        cardSize
      );

      for (const stack of allStacks) {
        if (stack.id === movedStack.id) continue;

        const stackBounds = getStackBounds(
          { ...stack, position: stackPositions.get(stack.id)! },
          cardSize
        );

        if (rectsOverlap(movedBounds, stackBounds)) {
          hasCollision = true;
          const push = getPushDirection(movedBounds, stackBounds);

          const newPos = {
            x: Math.max(0, Math.min(canvasWidth - stackBounds.width, stackBounds.x + push.dx)),
            y: Math.max(0, stackBounds.y + push.dy),
          };

          stackPositions.set(stack.id, newPos);
        }
      }
    }

    // Collect results for stacks that moved
    stackPositions.forEach((pos, stackId) => {
      if (stackId === movedStack.id) return;
      const original = allStacks.find(s => s.id === stackId);
      if (original && (original.position.x !== pos.x || original.position.y !== pos.y)) {
        results.push({ stackId, newPosition: pos });
      }
    });

    return results;
  }, []);

  /**
   * Check if a position would cause collision with any stack
   */
  const wouldCollide = useCallback((
    position: { x: number; y: number },
    stackId: string,
    allStacks: CanvasStack[],
    cardSize: CardSize
  ): boolean => {
    const testStack: CanvasStack = {
      id: stackId,
      name: '',
      cardIds: [],
      position,
      collapsed: false,
    };

    const testBounds = getStackBounds(testStack, cardSize);

    return allStacks.some(stack => {
      if (stack.id === stackId) return false;
      const stackBounds = getStackBounds(stack, cardSize);
      return rectsOverlap(testBounds, stackBounds);
    });
  }, []);

  /**
   * Find nearest non-colliding position
   */
  const findNearestFreePosition = useCallback((
    position: { x: number; y: number },
    stackId: string,
    allStacks: CanvasStack[],
    cardSize: CardSize,
    canvasWidth: number
  ): { x: number; y: number } => {
    if (!wouldCollide(position, stackId, allStacks, cardSize)) {
      return position;
    }

    const dims = STACK_DIMENSIONS[cardSize];
    const step = dims.width + 16;

    // Search in expanding circles
    for (let radius = step; radius < 500; radius += step) {
      for (let angle = 0; angle < 360; angle += 45) {
        const testX = position.x + Math.cos(angle * Math.PI / 180) * radius;
        const testY = position.y + Math.sin(angle * Math.PI / 180) * radius;

        const testPos = {
          x: Math.max(0, Math.min(canvasWidth - dims.width, testX)),
          y: Math.max(0, testY),
        };

        if (!wouldCollide(testPos, stackId, allStacks, cardSize)) {
          return testPos;
        }
      }
    }

    // Fallback: just offset to the right
    return {
      x: Math.min(canvasWidth - dims.width, position.x + step),
      y: position.y,
    };
  }, [wouldCollide]);

  return {
    resolveCollisions,
    wouldCollide,
    findNearestFreePosition,
  };
}
