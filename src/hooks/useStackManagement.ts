import { useState, useCallback, useEffect } from 'react';
import type { Card } from '../types/card';
import type { PileGroup } from '../config/gameConfig';

/**
 * Represents a stack of cards that can be manipulated by the user
 */
export interface CustomStack {
  id: string;
  name: string;
  cardIndices: number[];
}

/**
 * Card with its position index for stack operations
 */
export interface CardWithIndex {
  card: Card;
  index: number;
}

export interface UseStackManagementOptions {
  /** Initial stacks to start with */
  initialStacks?: CustomStack[];
  /** localStorage key for persistence (optional) */
  storageKey?: string;
  /** Auto-delete empty stacks when cards are removed (default: false) */
  autoDeleteEmpty?: boolean;
  /** Pile groups from game config for initializing default stacks */
  pileGroups?: PileGroup[];
}

export interface UseStackManagementResult {
  /** Current stacks */
  stacks: CustomStack[];
  /** Set stacks directly (for external control) */
  setStacks: React.Dispatch<React.SetStateAction<CustomStack[]>>;
  /** Create a new stack with the given name, optionally with a starting card */
  createStack: (name: string, cardIndex?: number) => string;
  /** Delete a stack by ID - cards are moved to Uncategorized */
  deleteStack: (stackId: string) => void;
  /** Rename a stack */
  renameStack: (stackId: string, newName: string) => void;
  /** Move a card to a specific stack */
  moveCardToStack: (cardIndex: number, stackId: string) => void;
  /** Merge source stack into target stack (source is deleted) */
  mergeStacks: (sourceId: string, targetId: string) => void;
  /** Create a stack at a specific position (for insertion between stacks) */
  createStackAtPosition: (name: string, cardIndex: number, position: number) => string;
  /** Initialize stacks from default pile groups */
  initializeFromDefaults: (cards: CardWithIndex[]) => void;
  /** Get cards belonging to a specific stack */
  getStackCards: (stackId: string, allCards: CardWithIndex[]) => CardWithIndex[];
  /** Get cards not assigned to any stack */
  getUnstackedCards: (allCards: CardWithIndex[]) => CardWithIndex[];
  /** Assign a newly added card to its matching default stack */
  assignToMatchingStack: (cardIndex: number, card: Card) => void;
  /** Remove a card from all stacks (when moving to another zone) */
  removeCardFromStacks: (cardIndex: number) => void;
}

/**
 * Hook for managing stacks of cards with drag-and-drop support
 */
export function useStackManagement({
  initialStacks = [],
  storageKey,
  autoDeleteEmpty = false,
  pileGroups = [],
}: UseStackManagementOptions = {}): UseStackManagementResult {
  const [stacks, setStacks] = useState<CustomStack[]>(initialStacks);

  // Load from localStorage on mount (if storageKey provided)
  useEffect(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const data = JSON.parse(saved);
          setStacks(data.stacks || []);
        }
      } catch (e) {
        console.error('Failed to load stacks from localStorage:', e);
      }
    }
  }, [storageKey]);

  // Save to localStorage when stacks change (if storageKey provided)
  useEffect(() => {
    if (storageKey && stacks.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify({ stacks }));
    }
  }, [storageKey, stacks]);

  // Create a new stack
  const createStack = useCallback((name: string, cardIndex?: number): string => {
    const id = `stack-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const cardIndices = cardIndex !== undefined ? [cardIndex] : [];

    setStacks(prev => {
      // If adding a card, remove it from other stacks first
      let updated = prev;
      if (cardIndex !== undefined) {
        updated = prev.map(s => ({
          ...s,
          cardIndices: s.cardIndices.filter(i => i !== cardIndex),
        }));
        // Auto-delete empty stacks if enabled
        if (autoDeleteEmpty) {
          updated = updated.filter(s => s.cardIndices.length > 0);
        }
      }
      return [...updated, { id, name, cardIndices }];
    });

    return id;
  }, [autoDeleteEmpty]);

  // Delete a stack - cards are moved to Uncategorized
  const deleteStack = useCallback((stackId: string) => {
    setStacks(prev => {
      const stackToDelete = prev.find(s => s.id === stackId);
      if (!stackToDelete) return prev;

      const cardsToMove = stackToDelete.cardIndices;
      const remainingStacks = prev.filter(s => s.id !== stackId);

      // If there are cards to move, put them in an "Uncategorized" stack
      if (cardsToMove.length > 0) {
        const uncategorizedStack = remainingStacks.find(s => s.name === 'Uncategorized');
        if (uncategorizedStack) {
          // Add cards to existing Uncategorized stack
          return remainingStacks.map(s =>
            s.id === uncategorizedStack.id
              ? { ...s, cardIndices: [...s.cardIndices, ...cardsToMove] }
              : s
          );
        } else {
          // Create new Uncategorized stack at the end
          return [...remainingStacks, {
            id: `stack-uncategorized-${Date.now()}`,
            name: 'Uncategorized',
            cardIndices: cardsToMove,
          }];
        }
      }

      return remainingStacks;
    });
  }, []);

  // Rename a stack
  const renameStack = useCallback((stackId: string, newName: string) => {
    setStacks(prev => prev.map(s =>
      s.id === stackId ? { ...s, name: newName } : s
    ));
  }, []);

  // Move a card to a specific stack
  const moveCardToStack = useCallback((cardIndex: number, stackId: string) => {
    setStacks(prev => {
      let updated = prev.map(s => ({
        ...s,
        cardIndices: s.id === stackId
          ? [...s.cardIndices.filter(i => i !== cardIndex), cardIndex]
          : s.cardIndices.filter(i => i !== cardIndex),
      }));

      // Auto-delete empty stacks if enabled
      if (autoDeleteEmpty) {
        updated = updated.filter(s => s.cardIndices.length > 0);
      }

      return updated;
    });
  }, [autoDeleteEmpty]);

  // Merge source stack into target stack
  const mergeStacks = useCallback((sourceId: string, targetId: string) => {
    setStacks(prev => {
      const sourceStack = prev.find(s => s.id === sourceId);
      if (!sourceStack) return prev;

      return prev
        .map(s => s.id === targetId
          ? { ...s, cardIndices: [...s.cardIndices, ...sourceStack.cardIndices] }
          : s
        )
        .filter(s => s.id !== sourceId);
    });
  }, []);

  // Create a stack at a specific position
  const createStackAtPosition = useCallback((name: string, cardIndex: number, position: number): string => {
    const id = `stack-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    setStacks(prev => {
      // Remove card from any existing stack
      let cleanedStacks = prev.map(s => ({
        ...s,
        cardIndices: s.cardIndices.filter(i => i !== cardIndex),
      }));

      // Auto-delete empty stacks if enabled
      if (autoDeleteEmpty) {
        cleanedStacks = cleanedStacks.filter(s => s.cardIndices.length > 0);
      }

      // Insert new stack at position
      const newStack = { id, name, cardIndices: [cardIndex] };
      cleanedStacks.splice(position, 0, newStack);

      return cleanedStacks;
    });

    return id;
  }, [autoDeleteEmpty]);

  // Initialize stacks from default pile groups
  const initializeFromDefaults = useCallback((cards: CardWithIndex[]) => {
    if (pileGroups.length === 0) return;

    const newStacks: CustomStack[] = [];

    pileGroups.forEach(group => {
      const matchingCards = cards.filter(c => group.matches(c.card));
      if (matchingCards.length > 0) {
        newStacks.push({
          id: `stack-${group.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: group.label,
          cardIndices: matchingCards.map(c => c.index),
        });
      }
    });

    setStacks(newStacks);
  }, [pileGroups]);

  // Get cards for a specific stack
  const getStackCards = useCallback((stackId: string, allCards: CardWithIndex[]): CardWithIndex[] => {
    const stack = stacks.find(s => s.id === stackId);
    if (!stack) return [];

    return stack.cardIndices
      .map(index => allCards.find(c => c.index === index))
      .filter((c): c is CardWithIndex => c !== undefined);
  }, [stacks]);

  // Get cards not in any stack
  const getUnstackedCards = useCallback((allCards: CardWithIndex[]): CardWithIndex[] => {
    const stackedIndices = new Set(stacks.flatMap(s => s.cardIndices));
    return allCards.filter(c => !stackedIndices.has(c.index));
  }, [stacks]);

  // Assign a newly added card to its matching default stack
  const assignToMatchingStack = useCallback((cardIndex: number, card: Card) => {
    if (pileGroups.length === 0) return;

    // Find which group this card matches
    for (const group of pileGroups) {
      if (group.matches(card)) {
        // Find the stack with this group's label
        const matchingStack = stacks.find(s => s.name === group.label);

        if (matchingStack) {
          // Add card to existing stack
          setStacks(prev => prev.map(s =>
            s.id === matchingStack.id
              ? { ...s, cardIndices: [...s.cardIndices, cardIndex] }
              : s
          ));
        } else {
          // Create a new stack for this group
          setStacks(prev => [...prev, {
            id: `stack-${group.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: group.label,
            cardIndices: [cardIndex],
          }]);
        }
        return;
      }
    }
  }, [pileGroups, stacks]);

  // Remove a card from all stacks
  const removeCardFromStacks = useCallback((cardIndex: number) => {
    setStacks(prev => {
      let updated = prev.map(s => ({
        ...s,
        cardIndices: s.cardIndices.filter(i => i !== cardIndex),
      }));

      // Auto-delete empty stacks if enabled
      if (autoDeleteEmpty) {
        updated = updated.filter(s => s.cardIndices.length > 0);
      }

      return updated;
    });
  }, [autoDeleteEmpty]);

  return {
    stacks,
    setStacks,
    createStack,
    deleteStack,
    renameStack,
    moveCardToStack,
    mergeStacks,
    createStackAtPosition,
    initializeFromDefaults,
    getStackCards,
    getUnstackedCards,
    assignToMatchingStack,
    removeCardFromStacks,
  };
}
