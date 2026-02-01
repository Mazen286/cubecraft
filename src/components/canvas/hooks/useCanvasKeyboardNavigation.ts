/**
 * useCanvasKeyboardNavigation - Keyboard navigation for canvas mode
 *
 * Provides grid-aware arrow key navigation between stacks and cards:
 * - Left/Right: Move to adjacent stacks in the same row
 * - Up/Down: Move within stack, or jump to stacks above/below
 * - Tab: Linear cycle through all stacks (accessibility fallback)
 * - Enter to select, Delete/Backspace to remove, Escape to clear
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { ZoneCanvas, CanvasStack, CardSize } from '../types';
import type { Card } from '../../../types/card';
import {
  buildGridMap,
  findStackLeft,
  findStackRight,
  navigateUp,
  navigateDown,
  getFirstStack,
} from '../utils/gridNavigation';

export interface CanvasNavState {
  /** Currently focused stack ID */
  focusedStackId: string | null;
  /** Currently focused card index within the stack */
  focusedCardIndex: number;
}

export interface UseCanvasKeyboardNavigationOptions {
  /** Current zones state */
  zones: ZoneCanvas[];
  /** Card size for grid calculation */
  cardSize: CardSize;
  /** Container width for column count calculation */
  containerWidth: number;
  /** Whether keyboard navigation is enabled */
  enabled?: boolean;
  /** Callback when a card is selected (Enter pressed) */
  onCardSelect?: (cardId: string | number, card: Card | null) => void;
  /** Callback when delete is pressed on a stack */
  onStackDelete?: (stackId: string) => void;
  /** Callback when Escape is pressed */
  onClearSelection?: () => void;
  /** Function to get card data by ID */
  getCardData?: (cardId: string | number) => Card | null;
  /** Function to get sorted card IDs for a stack (matches visual order) */
  getSortedCardIds?: (stack: CanvasStack) => (string | number)[];
}

export interface UseCanvasKeyboardNavigationResult {
  /** Current navigation state */
  navState: CanvasNavState;
  /** Currently focused card ID (resolved from sorted order) */
  focusedCardId: string | number | null;
  /** Set focused stack and card */
  setFocus: (stackId: string | null, cardIndex?: number) => void;
  /** Clear focus */
  clearFocus: () => void;
  /** Check if a stack is focused */
  isStackFocused: (stackId: string) => boolean;
  /** Check if a card is focused */
  isCardFocused: (stackId: string, cardIndex: number) => boolean;
  /** Get the focused card ID */
  getFocusedCardId: () => string | number | null;
}

export function useCanvasKeyboardNavigation({
  zones,
  cardSize,
  containerWidth,
  enabled = true,
  onCardSelect,
  onStackDelete,
  onClearSelection,
  getCardData,
  getSortedCardIds,
}: UseCanvasKeyboardNavigationOptions): UseCanvasKeyboardNavigationResult {
  const [navState, setNavState] = useState<CanvasNavState>({
    focusedStackId: null,
    focusedCardIndex: 0,
  });

  // Ref to track zones for event handler (avoid stale closure)
  const zonesRef = useRef(zones);
  zonesRef.current = zones;

  // Ref to track cardSize and containerWidth for event handler
  const cardSizeRef = useRef(cardSize);
  cardSizeRef.current = cardSize;
  const containerWidthRef = useRef(containerWidth);
  containerWidthRef.current = containerWidth;

  // Build grid map for navigation (memoized to avoid recalculating on every render)
  const gridMap = useMemo(
    () => buildGridMap(zones, cardSize, containerWidth),
    [zones, cardSize, containerWidth]
  );

  // Ref for gridMap to use in event handlers
  const gridMapRef = useRef(gridMap);
  gridMapRef.current = gridMap;

  // Ref for getSortedCardIds
  const getSortedCardIdsRef = useRef(getSortedCardIds);
  getSortedCardIdsRef.current = getSortedCardIds;

  // Get all stacks in order (by zone, then by position) - used for Tab navigation
  const getAllStacks = useCallback((): { stack: CanvasStack; zoneId: string }[] => {
    const result: { stack: CanvasStack; zoneId: string }[] = [];
    for (const zone of zonesRef.current) {
      if (zone.collapsed) continue;
      // Sort stacks by position (left to right, top to bottom)
      const sortedStacks = [...zone.stacks].sort((a, b) => {
        const rowDiff = Math.floor(a.position.y / 100) - Math.floor(b.position.y / 100);
        if (rowDiff !== 0) return rowDiff;
        return a.position.x - b.position.x;
      });
      for (const stack of sortedStacks) {
        result.push({ stack, zoneId: zone.zoneId });
      }
    }
    return result;
  }, []);

  // Find stack by ID
  const findStack = useCallback((stackId: string): CanvasStack | null => {
    for (const zone of zonesRef.current) {
      const stack = zone.stacks.find(s => s.id === stackId);
      if (stack) return stack;
    }
    return null;
  }, []);

  // Set focus
  const setFocus = useCallback((stackId: string | null, cardIndex = 0) => {
    setNavState({ focusedStackId: stackId, focusedCardIndex: cardIndex });
  }, []);

  // Clear focus
  const clearFocus = useCallback(() => {
    setNavState({ focusedStackId: null, focusedCardIndex: 0 });
  }, []);

  // Check if stack is focused
  const isStackFocused = useCallback((stackId: string): boolean => {
    return navState.focusedStackId === stackId;
  }, [navState.focusedStackId]);

  // Check if card is focused
  const isCardFocused = useCallback((stackId: string, cardIndex: number): boolean => {
    return navState.focusedStackId === stackId && navState.focusedCardIndex === cardIndex;
  }, [navState.focusedStackId, navState.focusedCardIndex]);

  // Get focused card ID (uses sorted order if available)
  const getFocusedCardId = useCallback((): string | number | null => {
    if (!navState.focusedStackId) return null;
    const stack = findStack(navState.focusedStackId);
    if (!stack || stack.cardIds.length === 0) return null;

    // Use sorted card IDs if available, otherwise use raw order
    const cardIds = getSortedCardIdsRef.current
      ? getSortedCardIdsRef.current(stack)
      : stack.cardIds;

    const clampedIndex = Math.min(navState.focusedCardIndex, cardIds.length - 1);
    return cardIds[clampedIndex];
  }, [navState.focusedStackId, navState.focusedCardIndex, findStack]);

  // Scroll a stack into view when navigating to it
  const scrollStackIntoView = useCallback((stackId: string) => {
    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      const element = document.querySelector(`[data-stack-id="${stackId}"]`);
      element?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    });
  }, []);

  // Keyboard event handler
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const allStacks = getAllStacks();
      if (allStacks.length === 0) return;

      switch (e.key) {
        case 'ArrowLeft': {
          e.preventDefault();
          const currentGridMap = gridMapRef.current;

          if (!navState.focusedStackId) {
            // No stack focused, focus first stack in grid
            const firstStackId = getFirstStack(currentGridMap);
            if (firstStackId) {
              setFocus(firstStackId, 0);
              scrollStackIntoView(firstStackId);
            }
          } else {
            // Find stack to the left in same row
            const leftStackId = findStackLeft(currentGridMap, navState.focusedStackId);
            if (leftStackId) {
              setFocus(leftStackId, 0);
              scrollStackIntoView(leftStackId);
            }
            // If no stack to left, stay at current position (edge behavior)
          }
          break;
        }

        case 'ArrowRight': {
          e.preventDefault();
          const currentGridMap = gridMapRef.current;

          if (!navState.focusedStackId) {
            // No stack focused, focus first stack in grid
            const firstStackId = getFirstStack(currentGridMap);
            if (firstStackId) {
              setFocus(firstStackId, 0);
              scrollStackIntoView(firstStackId);
            }
          } else {
            // Find stack to the right in same row
            const rightStackId = findStackRight(currentGridMap, navState.focusedStackId);
            if (rightStackId) {
              setFocus(rightStackId, 0);
              scrollStackIntoView(rightStackId);
            }
            // If no stack to right, stay at current position (edge behavior)
          }
          break;
        }

        case 'ArrowUp': {
          e.preventDefault();
          const currentGridMap = gridMapRef.current;

          if (!navState.focusedStackId) {
            // No stack focused, focus first stack in grid
            const firstStackId = getFirstStack(currentGridMap);
            if (firstStackId) {
              setFocus(firstStackId, 0);
              scrollStackIntoView(firstStackId);
            }
          } else {
            // Navigate up: within stack or to stack above
            // Use getSortedCardIds to get accurate visible card count
            const getVisibleCount = (stack: CanvasStack) =>
              getSortedCardIdsRef.current ? getSortedCardIdsRef.current(stack).length : stack.cardIds.length;
            const result = navigateUp(
              currentGridMap,
              navState.focusedStackId,
              navState.focusedCardIndex,
              findStack,
              getVisibleCount
            );
            setFocus(result.stackId, result.cardIndex);
            if (result.stackId !== navState.focusedStackId) {
              scrollStackIntoView(result.stackId);
            }
          }
          break;
        }

        case 'ArrowDown': {
          e.preventDefault();
          const currentGridMap = gridMapRef.current;

          if (!navState.focusedStackId) {
            // No stack focused, focus first stack in grid
            const firstStackId = getFirstStack(currentGridMap);
            if (firstStackId) {
              setFocus(firstStackId, 0);
              scrollStackIntoView(firstStackId);
            }
          } else {
            // Navigate down: within stack or to stack below
            // Use getSortedCardIds to get accurate visible card count
            const getVisibleCount = (stack: CanvasStack) =>
              getSortedCardIdsRef.current ? getSortedCardIdsRef.current(stack).length : stack.cardIds.length;
            const result = navigateDown(
              currentGridMap,
              navState.focusedStackId,
              navState.focusedCardIndex,
              findStack,
              getVisibleCount
            );
            setFocus(result.stackId, result.cardIndex);
            if (result.stackId !== navState.focusedStackId) {
              scrollStackIntoView(result.stackId);
            }
          }
          break;
        }

        case 'Tab': {
          e.preventDefault();
          const currentIndex = allStacks.findIndex(s => s.stack.id === navState.focusedStackId);
          const direction = e.shiftKey ? -1 : 1;

          if (currentIndex === -1) {
            setFocus(allStacks[0].stack.id, 0);
          } else {
            const newIndex = (currentIndex + direction + allStacks.length) % allStacks.length;
            setFocus(allStacks[newIndex].stack.id, 0);
          }
          break;
        }

        case 'Enter': {
          e.preventDefault();
          const cardId = getFocusedCardId();
          if (cardId !== null && onCardSelect) {
            const card = getCardData ? getCardData(cardId) : null;
            onCardSelect(cardId, card);
          }
          break;
        }

        case 'Delete':
        case 'Backspace': {
          // Only delete stack if a modifier key is held (to prevent accidental deletion)
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (navState.focusedStackId && onStackDelete) {
              onStackDelete(navState.focusedStackId);
              // Move focus to next stack
              const currentIndex = allStacks.findIndex(s => s.stack.id === navState.focusedStackId);
              if (currentIndex !== -1 && allStacks.length > 1) {
                const nextIndex = currentIndex === allStacks.length - 1 ? currentIndex - 1 : currentIndex;
                // The stack will be deleted, so we need to look at the next one
                const nextStack = allStacks[nextIndex === currentIndex ? currentIndex + 1 : nextIndex];
                if (nextStack) {
                  setFocus(nextStack.stack.id, 0);
                } else {
                  clearFocus();
                }
              } else {
                clearFocus();
              }
            }
          }
          break;
        }

        case 'Escape': {
          e.preventDefault();
          clearFocus();
          onClearSelection?.();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enabled,
    navState,
    getAllStacks,
    findStack,
    setFocus,
    clearFocus,
    getFocusedCardId,
    scrollStackIntoView,
    onCardSelect,
    onStackDelete,
    onClearSelection,
    getCardData,
  ]);

  // Compute focused card ID once
  const focusedCardId = getFocusedCardId();

  return {
    navState,
    focusedCardId,
    setFocus,
    clearFocus,
    isStackFocused,
    isCardFocused,
    getFocusedCardId,
  };
}
