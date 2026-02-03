import { createContext, useContext, useReducer, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { Card } from '../types/card';
import { deckService, type DeckData } from '../services/deckService';
import { cubeService } from '../services/cubeService';
import { useAuth } from './AuthContext';
import { getGameConfig } from '../config/games';
import type { DeckZone } from '../config/gameConfig';

/**
 * Card in a deck with zone information
 */
export interface DeckCard extends Card {
  addedAt: number;
  instanceId: string;
  zoneId: string; // 'main' | 'extra' | 'side'
}

/**
 * Validation warning for deck building
 */
export interface ValidationWarning {
  id: string;
  type: 'zone_count' | 'copy_limit' | 'card_type';
  severity: 'warning' | 'error';
  message: string;
  zoneId?: string;
  cardId?: string | number;
}

/**
 * Deck builder state
 */
export interface DeckBuilderState {
  deckId: string | null;
  deckName: string;
  deckDescription: string;
  gameId: string;

  // Source mode
  mode: 'standalone' | 'cube';
  cubeId: string | null;
  cubeCards: Map<string, Card> | null; // Cached cube cards for filtering

  // Multi-zone card storage
  zones: {
    main: Map<string, DeckCard>;
    extra: Map<string, DeckCard>;
    side: Map<string, DeckCard>;
  };

  // Zone order for display
  zoneOrder: {
    main: string[];
    extra: string[];
    side: string[];
  };

  // Validation
  validationWarnings: ValidationWarning[];

  // State flags
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  lastSaved: Date | null;
  error: string | null;

  // History for undo/redo
  history: Array<{
    zones: DeckBuilderState['zones'];
    zoneOrder: DeckBuilderState['zoneOrder'];
  }>;
  historyIndex: number;
}

/**
 * Action types for the reducer
 */
type DeckBuilderAction =
  | { type: 'SET_METADATA'; payload: { name?: string; description?: string } }
  | { type: 'SET_GAME'; payload: string }
  | { type: 'SET_MODE'; payload: { mode: 'standalone' | 'cube'; cubeId?: string; cubeCards?: Map<string, Card> } }
  | { type: 'ADD_CARD'; payload: { card: Card; zoneId?: string } }
  | { type: 'ADD_CARDS'; payload: { cards: Card[]; zoneId?: string } }
  | { type: 'REMOVE_CARD'; payload: string }
  | { type: 'MOVE_CARD'; payload: { instanceId: string; targetZoneId: string } }
  | { type: 'LOAD_DECK'; payload: DeckData }
  | { type: 'NEW_DECK'; payload: { gameId: string; mode?: 'standalone' | 'cube'; cubeId?: string; cubeCards?: Map<string, Card> } }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS'; payload: { deckId: string } }
  | { type: 'SAVE_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'MARK_CLEAN' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_VALIDATION_WARNINGS'; payload: ValidationWarning[] };

const MAX_HISTORY = 50;

/**
 * Push current state to history
 */
function pushHistory(state: DeckBuilderState): DeckBuilderState {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push({
    zones: {
      main: new Map(state.zones.main),
      extra: new Map(state.zones.extra),
      side: new Map(state.zones.side),
    },
    zoneOrder: {
      main: [...state.zoneOrder.main],
      extra: [...state.zoneOrder.extra],
      side: [...state.zoneOrder.side],
    },
  });

  if (newHistory.length > MAX_HISTORY) {
    newHistory.shift();
  }

  return {
    ...state,
    history: newHistory,
    historyIndex: newHistory.length - 1,
  };
}

/**
 * Determine which zone a card should be added to based on game config
 */
function getTargetZone(card: Card, gameId: string, preferredZoneId?: string): string {
  if (preferredZoneId) return preferredZoneId;

  const gameConfig = getGameConfig(gameId);
  if (!gameConfig) return 'main';

  // Find zone by cardBelongsTo predicate
  for (const zone of gameConfig.deckZones) {
    if (zone.cardBelongsTo(card)) {
      return zone.id;
    }
  }

  return 'main';
}

/**
 * Validate the deck and return warnings
 */
function validateDeck(state: DeckBuilderState): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const gameConfig = getGameConfig(state.gameId);
  if (!gameConfig) return warnings;

  // Get all cards across zones
  const allCards = [
    ...Array.from(state.zones.main.values()),
    ...Array.from(state.zones.extra.values()),
    ...Array.from(state.zones.side.values()),
  ];

  // Count copies of each card by card ID (not instance ID)
  const cardCounts = new Map<string | number, number>();
  for (const card of allCards) {
    const count = cardCounts.get(card.id) || 0;
    cardCounts.set(card.id, count + 1);
  }

  // Check zone constraints
  for (const zone of gameConfig.deckZones) {
    const zoneCards = state.zones[zone.id as keyof typeof state.zones];
    if (!zoneCards) continue;

    const count = zoneCards.size;

    // Check exact count
    if (zone.exactCards !== undefined && count !== zone.exactCards && count > 0) {
      warnings.push({
        id: `zone_exact_${zone.id}`,
        type: 'zone_count',
        severity: 'warning',
        message: `${zone.name} requires exactly ${zone.exactCards} cards (currently ${count})`,
        zoneId: zone.id,
      });
    } else {
      // Check min/max
      if (zone.minCards !== undefined && count < zone.minCards && !zone.isOptional) {
        warnings.push({
          id: `zone_min_${zone.id}`,
          type: 'zone_count',
          severity: 'warning',
          message: `${zone.name} needs at least ${zone.minCards} cards (currently ${count})`,
          zoneId: zone.id,
        });
      }

      if (zone.maxCards !== undefined && count > zone.maxCards) {
        warnings.push({
          id: `zone_max_${zone.id}`,
          type: 'zone_count',
          severity: 'error',
          message: `${zone.name} has too many cards: ${count}/${zone.maxCards}`,
          zoneId: zone.id,
        });
      }
    }
  }

  // Check copy limits (global across all zones)
  const copyLimit = gameConfig.deckZones[0]?.copyLimit;
  if (copyLimit) {
    for (const [cardId, count] of cardCounts) {
      if (count > copyLimit) {
        const card = allCards.find(c => c.id === cardId);
        warnings.push({
          id: `copy_limit_${cardId}`,
          type: 'copy_limit',
          severity: 'error',
          message: `${card?.name || cardId} exceeds copy limit: ${count}/${copyLimit}`,
          cardId,
        });
      }
    }
  }

  return warnings;
}

/**
 * Deck builder reducer
 */
function deckBuilderReducer(state: DeckBuilderState, action: DeckBuilderAction): DeckBuilderState {
  switch (action.type) {
    case 'SET_METADATA': {
      return {
        ...state,
        deckName: action.payload.name ?? state.deckName,
        deckDescription: action.payload.description ?? state.deckDescription,
        isDirty: true,
      };
    }

    case 'SET_GAME': {
      // Changing game clears all cards
      const newState: DeckBuilderState = {
        ...state,
        gameId: action.payload,
        zones: {
          main: new Map(),
          extra: new Map(),
          side: new Map(),
        },
        zoneOrder: {
          main: [],
          extra: [],
          side: [],
        },
        isDirty: true,
        history: [],
        historyIndex: -1,
        validationWarnings: [],
      };
      return newState;
    }

    case 'SET_MODE': {
      return {
        ...state,
        mode: action.payload.mode,
        cubeId: action.payload.cubeId || null,
        cubeCards: action.payload.cubeCards || null,
      };
    }

    case 'ADD_CARD': {
      const { card, zoneId } = action.payload;
      const targetZoneId = getTargetZone(card, state.gameId, zoneId) as keyof typeof state.zones;
      const instanceId = `${card.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const stateWithHistory = pushHistory(state);
      const newZones = { ...stateWithHistory.zones };
      const newZoneOrder = { ...stateWithHistory.zoneOrder };

      const deckCard: DeckCard = {
        ...card,
        addedAt: Date.now(),
        instanceId,
        zoneId: targetZoneId,
      };

      newZones[targetZoneId] = new Map(newZones[targetZoneId]);
      newZones[targetZoneId].set(instanceId, deckCard);
      newZoneOrder[targetZoneId] = [...newZoneOrder[targetZoneId], instanceId];

      const newState = {
        ...stateWithHistory,
        zones: newZones,
        zoneOrder: newZoneOrder,
        isDirty: true,
      };

      return {
        ...newState,
        validationWarnings: validateDeck(newState),
      };
    }

    case 'ADD_CARDS': {
      const { cards, zoneId } = action.payload;
      const stateWithHistory = pushHistory(state);
      const newZones = { ...stateWithHistory.zones };
      const newZoneOrder = { ...stateWithHistory.zoneOrder };

      for (const card of cards) {
        const targetZoneId = getTargetZone(card, state.gameId, zoneId) as keyof typeof state.zones;
        const instanceId = `${card.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        const deckCard: DeckCard = {
          ...card,
          addedAt: Date.now(),
          instanceId,
          zoneId: targetZoneId,
        };

        newZones[targetZoneId] = new Map(newZones[targetZoneId]);
        newZones[targetZoneId].set(instanceId, deckCard);
        newZoneOrder[targetZoneId] = [...newZoneOrder[targetZoneId], instanceId];
      }

      const newState = {
        ...stateWithHistory,
        zones: newZones,
        zoneOrder: newZoneOrder,
        isDirty: true,
      };

      return {
        ...newState,
        validationWarnings: validateDeck(newState),
      };
    }

    case 'REMOVE_CARD': {
      const instanceId = action.payload;

      // Find which zone the card is in
      let foundZone: keyof typeof state.zones | null = null;
      for (const zoneId of ['main', 'extra', 'side'] as const) {
        if (state.zones[zoneId].has(instanceId)) {
          foundZone = zoneId;
          break;
        }
      }

      if (!foundZone) return state;

      const stateWithHistory = pushHistory(state);
      const newZones = { ...stateWithHistory.zones };
      const newZoneOrder = { ...stateWithHistory.zoneOrder };

      newZones[foundZone] = new Map(newZones[foundZone]);
      newZones[foundZone].delete(instanceId);
      newZoneOrder[foundZone] = newZoneOrder[foundZone].filter(id => id !== instanceId);

      const newState = {
        ...stateWithHistory,
        zones: newZones,
        zoneOrder: newZoneOrder,
        isDirty: true,
      };

      return {
        ...newState,
        validationWarnings: validateDeck(newState),
      };
    }

    case 'MOVE_CARD': {
      const { instanceId, targetZoneId } = action.payload;
      const targetZone = targetZoneId as keyof typeof state.zones;

      // Find source zone
      let sourceZone: keyof typeof state.zones | null = null;
      let card: DeckCard | undefined;
      for (const zoneId of ['main', 'extra', 'side'] as const) {
        if (state.zones[zoneId].has(instanceId)) {
          sourceZone = zoneId;
          card = state.zones[zoneId].get(instanceId);
          break;
        }
      }

      if (!sourceZone || !card || sourceZone === targetZone) return state;

      const stateWithHistory = pushHistory(state);
      const newZones = { ...stateWithHistory.zones };
      const newZoneOrder = { ...stateWithHistory.zoneOrder };

      // Remove from source
      newZones[sourceZone] = new Map(newZones[sourceZone]);
      newZones[sourceZone].delete(instanceId);
      newZoneOrder[sourceZone] = newZoneOrder[sourceZone].filter(id => id !== instanceId);

      // Add to target
      newZones[targetZone] = new Map(newZones[targetZone]);
      newZones[targetZone].set(instanceId, { ...card, zoneId: targetZone });
      newZoneOrder[targetZone] = [...newZoneOrder[targetZone], instanceId];

      const newState = {
        ...stateWithHistory,
        zones: newZones,
        zoneOrder: newZoneOrder,
        isDirty: true,
      };

      return {
        ...newState,
        validationWarnings: validateDeck(newState),
      };
    }

    case 'LOAD_DECK': {
      const deckData = action.payload;
      const zones: DeckBuilderState['zones'] = {
        main: new Map(),
        extra: new Map(),
        side: new Map(),
      };
      const zoneOrder: DeckBuilderState['zoneOrder'] = {
        main: [],
        extra: [],
        side: [],
      };

      // Convert cards array to zone maps
      for (const card of deckData.cards) {
        const zoneId = (card.zoneId || 'main') as keyof typeof zones;
        const instanceId = card.instanceId || `${card.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const deckCard: DeckCard = {
          ...card,
          instanceId,
          zoneId,
          addedAt: card.addedAt || Date.now(),
        };
        zones[zoneId].set(instanceId, deckCard);
        zoneOrder[zoneId].push(instanceId);
      }

      const newState: DeckBuilderState = {
        ...state,
        deckId: deckData.id,
        deckName: deckData.name,
        deckDescription: deckData.description || '',
        gameId: deckData.gameId,
        mode: deckData.cubeId ? 'cube' : 'standalone',
        cubeId: deckData.cubeId || null,
        cubeCards: null, // Will be loaded separately if cube mode
        zones,
        zoneOrder,
        isDirty: false,
        isSaving: false,
        isLoading: false,
        error: null,
        history: [],
        historyIndex: -1,
        validationWarnings: [],
      };

      return {
        ...newState,
        validationWarnings: validateDeck(newState),
      };
    }

    case 'NEW_DECK': {
      const newState: DeckBuilderState = {
        ...createInitialState(),
        gameId: action.payload.gameId,
        mode: action.payload.mode || 'standalone',
        cubeId: action.payload.cubeId || null,
        cubeCards: action.payload.cubeCards || null,
      };
      return newState;
    }

    case 'SAVE_START': {
      return {
        ...state,
        isSaving: true,
        error: null,
      };
    }

    case 'SAVE_SUCCESS': {
      return {
        ...state,
        deckId: action.payload.deckId,
        isSaving: false,
        isDirty: false,
        lastSaved: new Date(),
      };
    }

    case 'SAVE_ERROR': {
      return {
        ...state,
        isSaving: false,
        error: action.payload,
      };
    }

    case 'CLEAR_ERROR': {
      return {
        ...state,
        error: null,
      };
    }

    case 'UNDO': {
      if (state.historyIndex <= 0) return state;

      const previousState = state.history[state.historyIndex - 1];
      const newState = {
        ...state,
        zones: {
          main: new Map(previousState.zones.main),
          extra: new Map(previousState.zones.extra),
          side: new Map(previousState.zones.side),
        },
        zoneOrder: {
          main: [...previousState.zoneOrder.main],
          extra: [...previousState.zoneOrder.extra],
          side: [...previousState.zoneOrder.side],
        },
        historyIndex: state.historyIndex - 1,
        isDirty: true,
      };

      return {
        ...newState,
        validationWarnings: validateDeck(newState),
      };
    }

    case 'REDO': {
      if (state.historyIndex >= state.history.length - 1) return state;

      const nextState = state.history[state.historyIndex + 1];
      const newState = {
        ...state,
        zones: {
          main: new Map(nextState.zones.main),
          extra: new Map(nextState.zones.extra),
          side: new Map(nextState.zones.side),
        },
        zoneOrder: {
          main: [...nextState.zoneOrder.main],
          extra: [...nextState.zoneOrder.extra],
          side: [...nextState.zoneOrder.side],
        },
        historyIndex: state.historyIndex + 1,
        isDirty: true,
      };

      return {
        ...newState,
        validationWarnings: validateDeck(newState),
      };
    }

    case 'MARK_CLEAN': {
      return {
        ...state,
        isDirty: false,
      };
    }

    case 'SET_LOADING': {
      return {
        ...state,
        isLoading: action.payload,
      };
    }

    case 'SET_VALIDATION_WARNINGS': {
      return {
        ...state,
        validationWarnings: action.payload,
      };
    }

    default:
      return state;
  }
}

/**
 * Create initial state
 */
function createInitialState(): DeckBuilderState {
  return {
    deckId: null,
    deckName: '',
    deckDescription: '',
    gameId: 'yugioh',
    mode: 'standalone',
    cubeId: null,
    cubeCards: null,
    zones: {
      main: new Map(),
      extra: new Map(),
      side: new Map(),
    },
    zoneOrder: {
      main: [],
      extra: [],
      side: [],
    },
    validationWarnings: [],
    isDirty: false,
    isSaving: false,
    isLoading: false,
    lastSaved: null,
    error: null,
    history: [],
    historyIndex: -1,
  };
}

/**
 * Context value interface
 */
interface DeckBuilderContextValue {
  state: DeckBuilderState;

  // Metadata
  setMetadata: (updates: { name?: string; description?: string }) => void;
  setGame: (gameId: string) => void;
  setMode: (mode: 'standalone' | 'cube', cubeId?: string) => Promise<void>;

  // Card operations
  addCard: (card: Card, zoneId?: string) => void;
  addCards: (cards: Card[], zoneId?: string) => void;
  removeCard: (instanceId: string) => void;
  moveCard: (instanceId: string, targetZoneId: string) => void;

  // Card queries
  hasCard: (cardId: string | number) => boolean;
  getCardCopyCount: (cardId: string | number) => number;
  canAddCard: (cardId: string | number) => boolean;
  getZoneCards: (zoneId: string) => DeckCard[];
  getTotalCardCount: () => number;

  // Deck operations
  loadDeck: (deckId: string) => Promise<void>;
  newDeck: (gameId: string, mode?: 'standalone' | 'cube', cubeId?: string) => void;
  saveDeck: () => Promise<{ success: boolean; error?: string }>;

  // Game config helpers
  getZoneConfig: (zoneId: string) => DeckZone | undefined;
  getAvailableZones: () => DeckZone[];

  // History
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Utilities
  clearError: () => void;
}

const DeckBuilderContext = createContext<DeckBuilderContextValue | null>(null);

interface DeckBuilderProviderProps {
  children: ReactNode;
  initialDeckId?: string;
  initialGameId?: string;
  initialCubeId?: string;
}

/**
 * Deck builder context provider
 */
export function DeckBuilderProvider({
  children,
  initialDeckId,
  initialGameId,
  initialCubeId,
}: DeckBuilderProviderProps) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(deckBuilderReducer, createInitialState());
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load initial deck or set up new deck
  useEffect(() => {
    if (initialDeckId) {
      loadDeck(initialDeckId);
    } else if (initialCubeId && initialGameId) {
      // Create new deck from cube
      newDeck(initialGameId, 'cube', initialCubeId);
    } else if (initialGameId) {
      dispatch({ type: 'NEW_DECK', payload: { gameId: initialGameId } });
    }
  }, [initialDeckId, initialGameId, initialCubeId]);

  // Auto-save with debounce
  useEffect(() => {
    if (state.isDirty && state.deckId && !state.isSaving) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      autoSaveTimeoutRef.current = setTimeout(() => {
        saveDeck();
      }, 3000);
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [state.isDirty, state.deckId, state.isSaving, state.zones]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          dispatch({ type: 'REDO' });
        } else {
          e.preventDefault();
          dispatch({ type: 'UNDO' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const setMetadata = useCallback((updates: { name?: string; description?: string }) => {
    dispatch({ type: 'SET_METADATA', payload: updates });
  }, []);

  const setGame = useCallback((gameId: string) => {
    dispatch({ type: 'SET_GAME', payload: gameId });
  }, []);

  const setMode = useCallback(async (mode: 'standalone' | 'cube', cubeId?: string) => {
    if (mode === 'cube' && cubeId) {
      try {
        const cubeData = await cubeService.loadAnyCube(cubeId);
        const cubeCards = new Map<string, Card>();
        for (const card of cubeData.cards) {
          cubeCards.set(String(card.id), {
            id: card.id,
            name: card.name,
            type: card.type,
            description: card.desc,
            score: card.score,
            imageUrl: card.imageUrl,
            attributes: card.attributes || {},
          });
        }
        dispatch({ type: 'SET_MODE', payload: { mode, cubeId, cubeCards } });
      } catch (error) {
        console.error('Failed to load cube:', error);
        dispatch({ type: 'SET_MODE', payload: { mode: 'standalone' } });
      }
    } else {
      dispatch({ type: 'SET_MODE', payload: { mode } });
    }
  }, []);

  const addCard = useCallback((card: Card, zoneId?: string) => {
    dispatch({ type: 'ADD_CARD', payload: { card, zoneId } });
  }, []);

  const addCards = useCallback((cards: Card[], zoneId?: string) => {
    dispatch({ type: 'ADD_CARDS', payload: { cards, zoneId } });
  }, []);

  const removeCard = useCallback((instanceId: string) => {
    dispatch({ type: 'REMOVE_CARD', payload: instanceId });
  }, []);

  const moveCard = useCallback((instanceId: string, targetZoneId: string) => {
    dispatch({ type: 'MOVE_CARD', payload: { instanceId, targetZoneId } });
  }, []);

  const hasCard = useCallback((cardId: string | number): boolean => {
    const cardIdStr = String(cardId);
    for (const zone of Object.values(state.zones)) {
      for (const card of zone.values()) {
        if (String(card.id) === cardIdStr) return true;
      }
    }
    return false;
  }, [state.zones]);

  const getCardCopyCount = useCallback((cardId: string | number): number => {
    const cardIdStr = String(cardId);
    let count = 0;
    for (const zone of Object.values(state.zones)) {
      for (const card of zone.values()) {
        if (String(card.id) === cardIdStr) count++;
      }
    }
    return count;
  }, [state.zones]);

  const canAddCard = useCallback((cardId: string | number): boolean => {
    const gameConfig = getGameConfig(state.gameId);
    if (!gameConfig) return true;

    const copyLimit = gameConfig.deckZones[0]?.copyLimit;
    if (!copyLimit) return true;

    const currentCount = getCardCopyCount(cardId);
    return currentCount < copyLimit;
  }, [state.gameId, getCardCopyCount]);

  const getZoneCards = useCallback((zoneId: string): DeckCard[] => {
    const zone = state.zones[zoneId as keyof typeof state.zones];
    const order = state.zoneOrder[zoneId as keyof typeof state.zoneOrder];
    if (!zone || !order) return [];

    return order.map(id => zone.get(id)!).filter(Boolean);
  }, [state.zones, state.zoneOrder]);

  const getTotalCardCount = useCallback((): number => {
    return (
      state.zones.main.size +
      state.zones.extra.size +
      state.zones.side.size
    );
  }, [state.zones]);

  const loadDeck = useCallback(async (deckId: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const deckData = await deckService.loadDeck(deckId);
      dispatch({ type: 'LOAD_DECK', payload: deckData });

      // If deck is from a cube, load the cube cards
      if (deckData.cubeId) {
        await setMode('cube', deckData.cubeId);
      }
    } catch (error) {
      dispatch({
        type: 'SAVE_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to load deck',
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [setMode]);

  const newDeck = useCallback(async (gameId: string, mode?: 'standalone' | 'cube', cubeId?: string) => {
    if (mode === 'cube' && cubeId) {
      try {
        const cubeData = await cubeService.loadAnyCube(cubeId);
        const cubeCards = new Map<string, Card>();
        for (const card of cubeData.cards) {
          cubeCards.set(String(card.id), {
            id: card.id,
            name: card.name,
            type: card.type,
            description: card.desc,
            score: card.score,
            imageUrl: card.imageUrl,
            attributes: card.attributes || {},
          });
        }
        dispatch({ type: 'NEW_DECK', payload: { gameId, mode, cubeId, cubeCards } });
      } catch (error) {
        console.error('Failed to load cube:', error);
        dispatch({ type: 'NEW_DECK', payload: { gameId } });
      }
    } else {
      dispatch({ type: 'NEW_DECK', payload: { gameId, mode } });
    }
  }, []);

  const saveDeck = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!state.deckName.trim()) {
      return { success: false, error: 'Deck name is required' };
    }

    dispatch({ type: 'SAVE_START' });

    try {
      // Convert zones to cards array
      const cards: DeckCard[] = [];
      for (const zoneId of ['main', 'extra', 'side'] as const) {
        const order = state.zoneOrder[zoneId];
        const zone = state.zones[zoneId];
        for (const instanceId of order) {
          const card = zone.get(instanceId);
          if (card) {
            cards.push(card);
          }
        }
      }

      if (state.deckId) {
        // Update existing deck
        const result = await deckService.updateDeck(state.deckId, {
          name: state.deckName,
          description: state.deckDescription,
          cards,
        });

        if (result.error) {
          dispatch({ type: 'SAVE_ERROR', payload: result.error });
          return { success: false, error: result.error };
        }

        dispatch({ type: 'SAVE_SUCCESS', payload: { deckId: state.deckId } });
        return { success: true };
      } else {
        // Create new deck
        const result = await deckService.saveDeck({
          name: state.deckName,
          description: state.deckDescription,
          gameId: state.gameId,
          cubeId: state.cubeId || undefined,
          cards,
          creatorId: user?.id,
        });

        if (result.error) {
          dispatch({ type: 'SAVE_ERROR', payload: result.error });
          return { success: false, error: result.error };
        }

        dispatch({ type: 'SAVE_SUCCESS', payload: { deckId: result.id } });
        return { success: true };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save deck';
      dispatch({ type: 'SAVE_ERROR', payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  }, [state, user?.id]);

  const getZoneConfig = useCallback((zoneId: string): DeckZone | undefined => {
    const gameConfig = getGameConfig(state.gameId);
    return gameConfig?.deckZones.find(z => z.id === zoneId);
  }, [state.gameId]);

  const getAvailableZones = useCallback((): DeckZone[] => {
    const gameConfig = getGameConfig(state.gameId);
    return gameConfig?.deckZones || [];
  }, [state.gameId]);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const value: DeckBuilderContextValue = {
    state,
    setMetadata,
    setGame,
    setMode,
    addCard,
    addCards,
    removeCard,
    moveCard,
    hasCard,
    getCardCopyCount,
    canAddCard,
    getZoneCards,
    getTotalCardCount,
    loadDeck,
    newDeck,
    saveDeck,
    getZoneConfig,
    getAvailableZones,
    undo,
    redo,
    canUndo: state.historyIndex > 0,
    canRedo: state.historyIndex < state.history.length - 1,
    clearError,
  };

  return (
    <DeckBuilderContext.Provider value={value}>
      {children}
    </DeckBuilderContext.Provider>
  );
}

/**
 * Hook to access deck builder context
 */
export function useDeckBuilder(): DeckBuilderContextValue {
  const context = useContext(DeckBuilderContext);
  if (!context) {
    throw new Error('useDeckBuilder must be used within a DeckBuilderProvider');
  }
  return context;
}
