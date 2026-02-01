/**
 * useCanvasKeyboardNavigation - Keyboard navigation for canvas mode
 *
 * Provides arrow key navigation between stacks and cards,
 * Enter to select, Delete/Backspace to remove, Tab to cycle, Escape to clear.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ZoneCanvas, CanvasStack } from '../types';
import type { Card } from '../../../types/card';

export interface CanvasNavState {
  /** Currently focused stack ID */
  focusedStackId: string | null;
  /** Currently focused card index within the stack */
  focusedCardIndex: number;
}

export interface UseCanvasKeyboardNavigationOptions {
  /** Current zones state */
  zones: ZoneCanvas[];
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
}

export interface UseCanvasKeyboardNavigationResult {
  /** Current navigation state */
  navState: CanvasNavState;
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
  enabled = true,
  onCardSelect,
  onStackDelete,
  onClearSelection,
  getCardData,
}: UseCanvasKeyboardNavigationOptions): UseCanvasKeyboardNavigationResult {
  const [navState, setNavState] = useState<CanvasNavState>({
    focusedStackId: null,
    focusedCardIndex: 0,
  });

  // Ref to track zones for event handler (avoid stale closure)
  const zonesRef = useRef(zones);
  zonesRef.current = zones;

  // Get all stacks in order (by zone, then by position)
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

  // Get focused card ID
  const getFocusedCardId = useCallback((): string | number | null => {
    if (!navState.focusedStackId) return null;
    const stack = findStack(navState.focusedStackId);
    if (!stack || stack.cardIds.length === 0) return null;
    const clampedIndex = Math.min(navState.focusedCardIndex, stack.cardIds.length - 1);
    return stack.cardIds[clampedIndex];
  }, [navState.focusedStackId, navState.focusedCardIndex, findStack]);

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
        case 'ArrowLeft':
        case 'ArrowRight': {
          e.preventDefault();
          const currentIndex = allStacks.findIndex(s => s.stack.id === navState.focusedStackId);

          if (currentIndex === -1) {
            // No stack focused, focus first
            setFocus(allStacks[0].stack.id, 0);
          } else {
            const direction = e.key === 'ArrowLeft' ? -1 : 1;
            const newIndex = (currentIndex + direction + allStacks.length) % allStacks.length;
            setFocus(allStacks[newIndex].stack.id, 0);
          }
          break;
        }

        case 'ArrowUp':
        case 'ArrowDown': {
          e.preventDefault();
          if (!navState.focusedStackId) {
            // No stack focused, focus first
            if (allStacks.length > 0) {
              setFocus(allStacks[0].stack.id, 0);
            }
          } else {
            const stack = findStack(navState.focusedStackId);
            if (stack && stack.cardIds.length > 0) {
              const direction = e.key === 'ArrowUp' ? -1 : 1;
              const newIndex = navState.focusedCardIndex + direction;
              // Clamp to valid range
              const clampedIndex = Math.max(0, Math.min(newIndex, stack.cardIds.length - 1));
              setNavState(prev => ({ ...prev, focusedCardIndex: clampedIndex }));
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
    onCardSelect,
    onStackDelete,
    onClearSelection,
    getCardData,
  ]);

  return {
    navState,
    setFocus,
    clearFocus,
    isStackFocused,
    isCardFocused,
    getFocusedCardId,
  };
}
