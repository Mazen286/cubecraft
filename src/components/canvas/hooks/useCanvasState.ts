/**
 * useCanvasState - Main state management for Freeform Canvas Mode
 *
 * Manages zones, stacks, positions, and auto-saves to localStorage.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  CanvasStack,
  ZoneCanvas,
  CardSize,
  CanvasState,
  CanvasAction,
} from '../types';
import {
  generateStackId,
  generateStackName,
  STACK_DIMENSIONS,
  CARD_DIMENSIONS,
} from '../types';
import { useCollisionDetection } from './useCollisionDetection';
import { useIsMobile } from '../../../hooks/useIsMobile';

export interface UseCanvasStateOptions {
  /** Storage key for localStorage persistence */
  storageKey: string;
  /** Initial zones if no saved state */
  initialZones?: ZoneCanvas[];
  /** Canvas width for collision detection */
  canvasWidth?: number;
  /** External card-to-zone assignments - source of truth for which cards belong in which zones */
  cardZoneAssignments?: Map<string | number, string>;
}

/**
 * Create a signature of zone assignments for comparison.
 * This creates a hash-like string that changes when any card's zone changes.
 */
function createZoneSignature(assignments: Map<string | number, string>): string {
  // Sort by card ID for consistency, then create a signature
  const entries = Array.from(assignments.entries())
    .map(([id, zone]) => `${id}:${zone}`)
    .sort()
    .join('|');
  return entries;
}

/**
 * Create a zone signature from saved zones data.
 */
function createZoneSignatureFromZones(zones: ZoneCanvas[]): string {
  const assignments = new Map<string | number, string>();
  for (const zone of zones) {
    for (const stack of zone.stacks) {
      for (const cardId of stack.cardIds) {
        assignments.set(cardId, zone.zoneId);
      }
    }
  }
  return createZoneSignature(assignments);
}

export interface UseCanvasStateResult {
  // State
  zones: ZoneCanvas[];
  cardSize: CardSize;
  canUndo: boolean;
  canRedo: boolean;

  // Snap and zoom state
  snapToGrid: boolean;
  gridSize: number;
  zoom: number;
  setSnapToGrid: (enabled: boolean) => void;
  setGridSize: (size: number) => void;
  setZoom: (zoom: number) => void;

  // Selection state
  selectedCardIds: Set<string | number>;
  selectCard: (cardId: string | number, mode: 'single' | 'add' | 'toggle') => void;
  selectCardRange: (startCardId: string | number, endCardId: string | number, stackId: string) => void;
  clearSelection: () => void;
  isCardSelected: (cardId: string | number) => boolean;

  // Zone operations
  setZoneCollapsed: (zoneId: string, collapsed: boolean) => void;

  // Stack operations
  moveStack: (stackId: string, zoneId: string, position: { x: number; y: number }) => void;
  createStack: (zoneId: string, cardIds: (string | number)[], position: { x: number; y: number }, name?: string) => string;
  deleteStack: (stackId: string) => void;
  renameStack: (stackId: string, name: string) => void;
  mergeStacks: (sourceId: string, targetId: string, insertIndex?: number) => void;
  setStackCollapsed: (stackId: string, collapsed: boolean) => void;

  // Card operations
  moveCardToStack: (cardId: string | number, fromStackId: string, toStackId: string, insertIndex?: number) => void;
  moveCardToNewStack: (cardId: string | number, fromStackId: string, zoneId: string, position: { x: number; y: number }) => string;
  moveCardToZone: (cardId: string | number, fromStackId: string, toZoneId: string, position: { x: number; y: number }) => string;

  // Multi-select operations
  moveSelectedToStack: (targetStackId: string) => void;
  moveSelectedToNewStack: (zoneId: string, position: { x: number; y: number }) => string;
  deleteSelectedCards: () => void;

  // Stack customization
  setStackColor: (stackId: string, color: string | null) => void;

  // Card size
  setCardSize: (size: CardSize) => void;

  // History
  undo: () => void;
  redo: () => void;

  // Reset
  resetLayout: (newZones: ZoneCanvas[]) => void;

  // Export/Import
  exportLayout: () => string;
  importLayout: (json: string) => boolean;

  // Resize handling
  repositionOffscreenStacks: (containerWidth: number) => void;

  // Auto-layout
  autoLayout: (containerWidth?: number) => void;

  // Find helpers
  findStackById: (stackId: string) => { stack: CanvasStack; zoneId: string } | null;
  findCardStack: (cardId: string | number) => { stack: CanvasStack; zoneId: string } | null;
}

const MAX_HISTORY = 50;

export function useCanvasState({
  storageKey,
  initialZones = [],
  canvasWidth = 800,
  cardZoneAssignments,
}: UseCanvasStateOptions): UseCanvasStateResult {
  const isMobile = useIsMobile();
  const [zones, setZones] = useState<ZoneCanvas[]>(initialZones);
  const [cardSize, setCardSizeState] = useState<CardSize>(isMobile ? 'compact' : 'normal');
  const [history, setHistory] = useState<CanvasAction[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string | number>>(new Set());
  const [snapToGrid, setSnapToGridState] = useState(false);
  const [gridSize, setGridSizeState] = useState(20);
  const [zoom, setZoomState] = useState(1);

  const { resolveCollisions, findNearestFreePosition } = useCollisionDetection();

  // Track if we're in the middle of an undo/redo to skip recording
  const isUndoRedo = useRef(false);

  // Note: Zone synchronization is now handled in the localStorage loading effect above.
  // When cardZoneAssignments changes (e.g., after autobuild), the signature comparison
  // will detect the mismatch and use initialZones instead of stale localStorage data.

  // Track if we're on the initial mount to prevent handleLayoutChange feedback loops
  const isInitialMount = useRef(true);

  // Load from localStorage on mount - check if saved zones match current assignments
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);

      // If we have external zone assignments, we MUST validate saved zones match
      if (cardZoneAssignments && cardZoneAssignments.size > 0) {
        const currentSignature = createZoneSignature(cardZoneAssignments);

        if (saved) {
          const data = JSON.parse(saved) as Partial<CanvasState> & { zoneSignature?: string };

          // Check if the saved zone signature matches current assignments
          const savedSignature = data.zoneSignature ||
            (data.zones ? createZoneSignatureFromZones(data.zones) : '');

          if (savedSignature === currentSignature && data.zones && data.zones.length > 0) {
            // Signatures match - saved zones are valid, use them
            setZones(data.zones);
          } else {
            // Signatures don't match - deck assignments changed, use fresh initialZones
            // Clear the invalid saved data
            localStorage.removeItem(storageKey);
            // Force a re-render with initialZones
            setZones(initialZones);
          }

          if (data.cardSize) {
            setCardSizeState(data.cardSize);
          }
        }
        // If no saved data, keep the initialZones from useState
      } else if (saved) {
        // No external assignments to validate - use saved zones as-is
        const data = JSON.parse(saved) as Partial<CanvasState>;
        if (data.zones && data.zones.length > 0) {
          setZones(data.zones);
        }
        if (data.cardSize) {
          setCardSizeState(data.cardSize);
        }
      }
    } catch (e) {
      console.error('[CanvasState] Failed to load from localStorage:', e);
    }

    // Mark initial mount as complete after a tick
    setTimeout(() => {
      isInitialMount.current = false;
    }, 100);
  }, [storageKey, cardZoneAssignments, initialZones]);

  // Save to localStorage on changes - include zone signature for validation
  useEffect(() => {
    if (zones.length === 0) return;
    // Don't save during initial mount to avoid race conditions
    if (isInitialMount.current) return;

    try {
      // Create signature from current zones for future validation
      const zoneSignature = createZoneSignatureFromZones(zones);
      const data = { zones, cardSize, zoneSignature };
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (e) {
      console.error('[CanvasState] Failed to save to localStorage:', e);
    }
  }, [storageKey, zones, cardSize]);

  // Record action for undo/redo
  const recordAction = useCallback((
    type: CanvasAction['type'],
    before: ZoneCanvas[],
    after: ZoneCanvas[]
  ) => {
    if (isUndoRedo.current) return;

    setHistory(prev => {
      // Remove any actions after current index (we're creating new branch)
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push({
        type,
        before: JSON.parse(JSON.stringify(before)),
        after: JSON.parse(JSON.stringify(after)),
        timestamp: Date.now(),
      });
      // Limit history size
      if (newHistory.length > MAX_HISTORY) {
        return newHistory.slice(-MAX_HISTORY);
      }
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [historyIndex]);

  // Find stack by ID
  const findStackById = useCallback((stackId: string): { stack: CanvasStack; zoneId: string } | null => {
    for (const zone of zones) {
      const stack = zone.stacks.find(s => s.id === stackId);
      if (stack) {
        return { stack, zoneId: zone.zoneId };
      }
    }
    return null;
  }, [zones]);

  // Find which stack contains a card
  const findCardStack = useCallback((cardId: string | number): { stack: CanvasStack; zoneId: string } | null => {
    for (const zone of zones) {
      for (const stack of zone.stacks) {
        if (stack.cardIds.includes(cardId)) {
          return { stack, zoneId: zone.zoneId };
        }
      }
    }
    return null;
  }, [zones]);

  // Selection methods
  const selectCard = useCallback((cardId: string | number, mode: 'single' | 'add' | 'toggle') => {
    setSelectedCardIds(prev => {
      const newSet = new Set(prev);
      switch (mode) {
        case 'single':
          return new Set([cardId]);
        case 'add':
          newSet.add(cardId);
          return newSet;
        case 'toggle':
          if (newSet.has(cardId)) {
            newSet.delete(cardId);
          } else {
            newSet.add(cardId);
          }
          return newSet;
        default:
          return prev;
      }
    });
  }, []);

  const selectCardRange = useCallback((startCardId: string | number, endCardId: string | number, stackId: string) => {
    const stackResult = findStackById(stackId);
    if (!stackResult) return;

    const { stack } = stackResult;
    const startIndex = stack.cardIds.indexOf(startCardId);
    const endIndex = stack.cardIds.indexOf(endCardId);

    if (startIndex === -1 || endIndex === -1) return;

    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);
    const rangeCardIds = stack.cardIds.slice(minIndex, maxIndex + 1);

    setSelectedCardIds(prev => {
      const newSet = new Set(prev);
      rangeCardIds.forEach(id => newSet.add(id));
      return newSet;
    });
  }, [findStackById]);

  const clearSelection = useCallback(() => {
    setSelectedCardIds(new Set());
  }, []);

  const isCardSelected = useCallback((cardId: string | number): boolean => {
    return selectedCardIds.has(cardId);
  }, [selectedCardIds]);

  // Set zone collapsed
  const setZoneCollapsed = useCallback((zoneId: string, collapsed: boolean) => {
    setZones(prev => prev.map(z =>
      z.zoneId === zoneId ? { ...z, collapsed } : z
    ));
  }, []);

  // Move stack to new position
  const moveStack = useCallback((
    stackId: string,
    zoneId: string,
    position: { x: number; y: number }
  ) => {
    const beforeZones = zones;

    // Apply snap-to-grid if enabled
    let snappedPosition = position;
    if (snapToGrid) {
      snappedPosition = {
        x: Math.round(position.x / gridSize) * gridSize,
        y: Math.round(position.y / gridSize) * gridSize,
      };
    }

    setZones(prev => {
      // Find the stack
      let movedStack: CanvasStack | null = null;
      let sourceZoneId: string | null = null;

      for (const zone of prev) {
        const stack = zone.stacks.find(s => s.id === stackId);
        if (stack) {
          movedStack = { ...stack, position: snappedPosition };
          sourceZoneId = zone.zoneId;
          break;
        }
      }

      if (!movedStack || !sourceZoneId) return prev;

      // Get all stacks in target zone (excluding the moved one)
      const targetZone = prev.find(z => z.zoneId === zoneId);
      const otherStacks = targetZone?.stacks.filter(s => s.id !== stackId) || [];

      // Resolve collisions
      const collisions = resolveCollisions(movedStack, otherStacks, cardSize, canvasWidth);

      // Apply changes
      return prev.map(zone => {
        if (zone.zoneId === sourceZoneId && zone.zoneId === zoneId) {
          // Same zone - update position and apply collision results
          return {
            ...zone,
            stacks: zone.stacks.map(s => {
              if (s.id === stackId) {
                return movedStack!;
              }
              const collision = collisions.find(c => c.stackId === s.id);
              if (collision) {
                return { ...s, position: collision.newPosition };
              }
              return s;
            }),
          };
        } else if (zone.zoneId === sourceZoneId) {
          // Remove from source zone
          return {
            ...zone,
            stacks: zone.stacks.filter(s => s.id !== stackId),
          };
        } else if (zone.zoneId === zoneId) {
          // Add to target zone with collision resolution
          const newStacks = [...zone.stacks, movedStack!];
          return {
            ...zone,
            stacks: newStacks.map(s => {
              const collision = collisions.find(c => c.stackId === s.id);
              if (collision) {
                return { ...s, position: collision.newPosition };
              }
              return s;
            }),
          };
        }
        return zone;
      });
    });

    recordAction('move_stack', beforeZones, zones);
  }, [zones, cardSize, canvasWidth, resolveCollisions, recordAction]);

  // Create a new stack
  const createStack = useCallback((
    zoneId: string,
    cardIds: (string | number)[],
    position: { x: number; y: number },
    name?: string
  ): string => {
    const beforeZones = zones;
    const id = generateStackId();

    setZones(prev => {
      // Get all existing stack names
      const existingNames = prev.flatMap(z => z.stacks.map(s => s.name));
      const stackName = name || generateStackName(existingNames);

      // Find free position if needed
      const targetZone = prev.find(z => z.zoneId === zoneId);
      const freePosition = targetZone
        ? findNearestFreePosition(position, id, targetZone.stacks, cardSize, canvasWidth)
        : position;

      const newStack: CanvasStack = {
        id,
        name: stackName,
        cardIds,
        position: freePosition,
        collapsed: false,
      };

      // Remove cards from any existing stacks
      const cardIdSet = new Set(cardIds);
      const updatedZones = prev.map(zone => ({
        ...zone,
        stacks: zone.stacks.map(s => ({
          ...s,
          cardIds: s.cardIds.filter(cid => !cardIdSet.has(cid)),
        })).filter(s => s.cardIds.length > 0), // Remove empty stacks
      }));

      // Add new stack to target zone
      return updatedZones.map(zone =>
        zone.zoneId === zoneId
          ? { ...zone, stacks: [...zone.stacks, newStack] }
          : zone
      );
    });

    recordAction('create_stack', beforeZones, zones);
    return id;
  }, [zones, cardSize, canvasWidth, findNearestFreePosition, recordAction]);

  // Delete a stack
  const deleteStack = useCallback((stackId: string) => {
    const beforeZones = zones;

    setZones(prev => prev.map(zone => ({
      ...zone,
      stacks: zone.stacks.filter(s => s.id !== stackId),
    })));

    recordAction('delete_stack', beforeZones, zones);
  }, [zones, recordAction]);

  // Rename a stack
  const renameStack = useCallback((stackId: string, name: string) => {
    const beforeZones = zones;

    setZones(prev => prev.map(zone => ({
      ...zone,
      stacks: zone.stacks.map(s =>
        s.id === stackId ? { ...s, name } : s
      ),
    })));

    recordAction('rename_stack', beforeZones, zones);
  }, [zones, recordAction]);

  // Merge source stack into target
  const mergeStacks = useCallback((
    sourceId: string,
    targetId: string,
    insertIndex?: number
  ) => {
    const beforeZones = zones;

    setZones(prev => {
      const sourceStack = prev.flatMap(z => z.stacks).find(s => s.id === sourceId);
      if (!sourceStack) return prev;

      return prev.map(zone => ({
        ...zone,
        stacks: zone.stacks
          .map(s => {
            if (s.id === targetId) {
              const idx = insertIndex ?? s.cardIds.length;
              const newCardIds = [...s.cardIds];
              newCardIds.splice(idx, 0, ...sourceStack.cardIds);
              return { ...s, cardIds: newCardIds };
            }
            return s;
          })
          .filter(s => s.id !== sourceId),
      }));
    });

    recordAction('merge_stacks', beforeZones, zones);
  }, [zones, recordAction]);

  // Set stack collapsed
  const setStackCollapsed = useCallback((stackId: string, collapsed: boolean) => {
    setZones(prev => prev.map(zone => ({
      ...zone,
      stacks: zone.stacks.map(s =>
        s.id === stackId ? { ...s, collapsed } : s
      ),
    })));
  }, []);

  // Move card to existing stack
  const moveCardToStack = useCallback((
    cardId: string | number,
    fromStackId: string,
    toStackId: string,
    insertIndex?: number
  ) => {
    if (fromStackId === toStackId) return;

    const beforeZones = zones;

    setZones(prev => prev.map(zone => ({
      ...zone,
      stacks: zone.stacks
        .map(s => {
          if (s.id === fromStackId) {
            return { ...s, cardIds: s.cardIds.filter(id => id !== cardId) };
          }
          if (s.id === toStackId) {
            const idx = insertIndex ?? s.cardIds.length;
            const newCardIds = [...s.cardIds];
            newCardIds.splice(idx, 0, cardId);
            return { ...s, cardIds: newCardIds };
          }
          return s;
        })
        .filter(s => s.cardIds.length > 0), // Auto-delete empty
    })));

    recordAction('move_cards', beforeZones, zones);
  }, [zones, recordAction]);

  // Move card to new stack - ATOMIC operation to ensure zone change detection works
  const moveCardToNewStack = useCallback((
    cardId: string | number,
    fromStackId: string,
    zoneId: string,
    position: { x: number; y: number }
  ): string => {
    const beforeZones = zones;
    const newStackId = generateStackId();

    // Do both operations in a single setZones call so zone change detection works
    setZones(prev => prev.map(zone => {
      // Remove card from source stack (in any zone)
      const updatedStacks = zone.stacks
        .map(s => s.id === fromStackId
          ? { ...s, cardIds: s.cardIds.filter(id => id !== cardId) }
          : s
        )
        .filter(s => s.cardIds.length > 0);

      // If this is the target zone, add the new stack
      if (zone.zoneId === zoneId) {
        return {
          ...zone,
          stacks: [...updatedStacks, {
            id: newStackId,
            name: `Stack ${updatedStacks.length + 1}`,
            cardIds: [cardId],
            position,
            collapsed: false,
          }],
        };
      }

      return { ...zone, stacks: updatedStacks };
    }));

    recordAction('move_cards', beforeZones, zones);
    return newStackId;
  }, [zones, recordAction]);

  // Move card to different zone
  const moveCardToZone = useCallback((
    cardId: string | number,
    fromStackId: string,
    toZoneId: string,
    position: { x: number; y: number }
  ): string => {
    return moveCardToNewStack(cardId, fromStackId, toZoneId, position);
  }, [moveCardToNewStack]);

  // Move all selected cards to an existing stack
  const moveSelectedToStack = useCallback((targetStackId: string) => {
    if (selectedCardIds.size === 0) return;

    const beforeZones = zones;

    setZones(prev => {
      // For each selected card, remove from its current stack and add to target
      let newZones = [...prev];

      for (const cardId of selectedCardIds) {
        // Find and remove from current stack
        newZones = newZones.map(zone => ({
          ...zone,
          stacks: zone.stacks.map(stack => {
            if (stack.cardIds.includes(cardId) && stack.id !== targetStackId) {
              return { ...stack, cardIds: stack.cardIds.filter(id => id !== cardId) };
            }
            if (stack.id === targetStackId && !stack.cardIds.includes(cardId)) {
              return { ...stack, cardIds: [...stack.cardIds, cardId] };
            }
            return stack;
          }).filter(s => s.cardIds.length > 0),
        }));
      }

      return newZones;
    });

    recordAction('move_cards', beforeZones, zones);
    clearSelection();
  }, [zones, selectedCardIds, recordAction, clearSelection]);

  // Move all selected cards to a new stack - ATOMIC operation
  const moveSelectedToNewStack = useCallback((
    zoneId: string,
    position: { x: number; y: number }
  ): string => {
    if (selectedCardIds.size === 0) return '';

    const beforeZones = zones;
    const cardIds = Array.from(selectedCardIds);
    const newStackId = generateStackId();

    // Do both operations in a single setZones call so zone change detection works
    setZones(prev => prev.map(zone => {
      // Remove selected cards from all stacks
      const updatedStacks = zone.stacks.map(stack => ({
        ...stack,
        cardIds: stack.cardIds.filter(id => !selectedCardIds.has(id)),
      })).filter(s => s.cardIds.length > 0);

      // If this is the target zone, add the new stack
      if (zone.zoneId === zoneId) {
        return {
          ...zone,
          stacks: [...updatedStacks, {
            id: newStackId,
            name: `Stack ${updatedStacks.length + 1}`,
            cardIds,
            position,
            collapsed: false,
          }],
        };
      }

      return { ...zone, stacks: updatedStacks };
    }));

    recordAction('create_stack', beforeZones, zones);
    clearSelection();
    return newStackId;
  }, [zones, selectedCardIds, recordAction, clearSelection]);

  // Delete all selected cards (remove from stacks)
  const deleteSelectedCards = useCallback(() => {
    if (selectedCardIds.size === 0) return;

    const beforeZones = zones;

    setZones(prev => prev.map(zone => ({
      ...zone,
      stacks: zone.stacks.map(stack => ({
        ...stack,
        cardIds: stack.cardIds.filter(id => !selectedCardIds.has(id)),
      })).filter(s => s.cardIds.length > 0),
    })));

    recordAction('delete_stack', beforeZones, zones);
    clearSelection();
  }, [zones, selectedCardIds, recordAction, clearSelection]);

  // Set stack color
  const setStackColor = useCallback((stackId: string, color: string | null) => {
    setZones(prev => prev.map(zone => ({
      ...zone,
      stacks: zone.stacks.map(stack =>
        stack.id === stackId ? { ...stack, color: color || undefined } : stack
      ),
    })));
  }, []);

  // Set card size
  const setCardSize = useCallback((size: CardSize) => {
    setCardSizeState(size);
  }, []);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex < 0) return;

    isUndoRedo.current = true;
    const action = history[historyIndex];
    setZones(action.before);
    setHistoryIndex(prev => prev - 1);
    isUndoRedo.current = false;
  }, [history, historyIndex]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;

    isUndoRedo.current = true;
    const action = history[historyIndex + 1];
    setZones(action.after);
    setHistoryIndex(prev => prev + 1);
    isUndoRedo.current = false;
  }, [history, historyIndex]);

  // Reset layout
  const resetLayout = useCallback((newZones: ZoneCanvas[]) => {
    const beforeZones = zones;
    setZones(newZones);
    recordAction('reset_layout', beforeZones, newZones);
  }, [zones, recordAction]);

  // Export layout as JSON string
  const exportLayout = useCallback((): string => {
    const exportData = {
      version: 1,
      zones: zones.map(zone => ({
        zoneId: zone.zoneId,
        collapsed: zone.collapsed,
        stacks: zone.stacks.map(stack => ({
          id: stack.id,
          name: stack.name,
          cardIds: stack.cardIds,
          position: stack.position,
          collapsed: stack.collapsed,
          color: stack.color,
        })),
      })),
      cardSize,
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(exportData, null, 2);
  }, [zones, cardSize]);

  // Import layout from JSON string
  const importLayout = useCallback((json: string): boolean => {
    try {
      const data = JSON.parse(json);
      if (!data.zones || !Array.isArray(data.zones)) {
        console.error('[CanvasState] Invalid import: missing zones array');
        return false;
      }

      const beforeZones = zones;
      const importedZones: ZoneCanvas[] = data.zones.map((zone: {
        zoneId: string;
        collapsed?: boolean;
        stacks: Array<{
          id: string;
          name: string;
          cardIds: (string | number)[];
          position: { x: number; y: number };
          collapsed?: boolean;
          color?: string;
        }>;
      }) => ({
        zoneId: zone.zoneId,
        collapsed: zone.collapsed ?? false,
        stacks: zone.stacks.map(stack => ({
          id: stack.id || generateStackId(),
          name: stack.name,
          cardIds: stack.cardIds,
          position: stack.position,
          collapsed: stack.collapsed ?? false,
          color: stack.color,
        })),
      }));

      setZones(importedZones);
      if (data.cardSize) {
        setCardSizeState(data.cardSize);
      }
      recordAction('reset_layout', beforeZones, importedZones);
      return true;
    } catch (e) {
      console.error('[CanvasState] Failed to import layout:', e);
      return false;
    }
  }, [zones, recordAction]);

  // Snap/zoom setters
  const setSnapToGrid = useCallback((enabled: boolean) => {
    setSnapToGridState(enabled);
  }, []);

  const setGridSize = useCallback((size: number) => {
    setGridSizeState(size);
  }, []);

  const setZoom = useCallback((newZoom: number) => {
    setZoomState(Math.max(0.5, Math.min(1.5, newZoom)));
  }, []);

  // Reposition stacks that are off-screen to bring them into visible area
  const repositionOffscreenStacks = useCallback((containerWidth: number) => {
    const stackWidth = 100; // Approximate stack width
    const padding = 8;
    const maxX = containerWidth - stackWidth - padding;

    setZones(prev => {
      let hasChanges = false;
      const newZones = prev.map(zone => {
        const newStacks = zone.stacks.map(stack => {
          if (stack.position.x > maxX) {
            hasChanges = true;
            return { ...stack, position: { ...stack.position, x: Math.max(padding, maxX) } };
          }
          return stack;
        });
        return hasChanges ? { ...zone, stacks: newStacks } : zone;
      });
      return hasChanges ? newZones : prev;
    });
  }, []);

  // Auto-layout: arrange all stacks in a neat grid
  // Uses same spacing as buildInitialZones (Reset button) for consistency
  const autoLayout = useCallback((containerWidth: number = 800) => {
    const stackDims = STACK_DIMENSIONS[cardSize];
    const cardDims = CARD_DIMENSIONS[cardSize];
    // No spacing on mobile, normal spacing on desktop (24px)
    const stackPadding = isMobile ? 0 : 24;
    const stackWidth = stackDims.width + stackPadding;

    const columns = Math.max(1, Math.floor(containerWidth / stackWidth) || 1);

    // Calculate stack height based on card count (same as buildInitialZones)
    const calculateStackHeight = (cardCount: number): number => {
      if (cardCount === 0) {
        return stackDims.headerHeight + 60 + 16; // Empty state height + padding
      }
      const visibleCards = Math.min(cardCount, stackDims.maxVisibleCards);
      const cardsHeight = cardDims.height + (visibleCards - 1) * stackDims.cardOffset;
      const hasMoreBadge = cardCount > stackDims.maxVisibleCards ? 24 : 0;
      return stackDims.headerHeight + cardsHeight + hasMoreBadge + 24; // Extra padding between rows
    };

    setZones(prev => {
      const before = prev;
      const newZones = prev.map(zone => {
        if (zone.stacks.length === 0) return zone;

        // Group stacks into rows
        const rows: typeof zone.stacks[] = [];
        for (let i = 0; i < zone.stacks.length; i++) {
          const rowIndex = Math.floor(i / columns);
          if (!rows[rowIndex]) rows[rowIndex] = [];
          rows[rowIndex].push(zone.stacks[i]);
        }

        // Calculate height for each row (based on tallest stack)
        const rowHeights = rows.map(row => {
          const heights = row.map(stack => calculateStackHeight(stack.cardIds.length));
          return Math.max(...heights);
        });

        // Calculate cumulative Y positions for each row
        const rowYPositions: number[] = [8]; // Start at y=8
        for (let i = 1; i < rows.length; i++) {
          rowYPositions[i] = rowYPositions[i - 1] + rowHeights[i - 1];
        }

        // Assign positions to each stack
        const newStacks = zone.stacks.map((stack, index) => {
          const col = index % columns;
          const rowIndex = Math.floor(index / columns);
          return {
            ...stack,
            position: {
              x: col * stackWidth + 8,
              y: rowYPositions[rowIndex],
            },
          };
        });

        return { ...zone, stacks: newStacks };
      });

      recordAction('move_stack', before, newZones);
      return newZones;
    });
  }, [cardSize, isMobile, recordAction]);

  return {
    zones,
    cardSize,
    canUndo: historyIndex >= 0,
    canRedo: historyIndex < history.length - 1,

    // Snap and zoom
    snapToGrid,
    gridSize,
    zoom,
    setSnapToGrid,
    setGridSize,
    setZoom,

    // Selection
    selectedCardIds,
    selectCard,
    selectCardRange,
    clearSelection,
    isCardSelected,

    setZoneCollapsed,

    moveStack,
    createStack,
    deleteStack,
    renameStack,
    mergeStacks,
    setStackCollapsed,

    moveCardToStack,
    moveCardToNewStack,
    moveCardToZone,

    // Multi-select operations
    moveSelectedToStack,
    moveSelectedToNewStack,
    deleteSelectedCards,

    // Stack customization
    setStackColor,

    setCardSize,

    undo,
    redo,

    resetLayout,

    // Export/Import
    exportLayout,
    importLayout,

    // Resize handling
    repositionOffscreenStacks,

    // Auto-layout
    autoLayout,

    findStackById,
    findCardStack,
  };
}
