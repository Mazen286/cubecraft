import { createContext, useContext, useReducer, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { Card } from '../types/card';
import { cubeService } from '../services/cubeService';
import { useAuth } from './AuthContext';

/**
 * Card with score in the cube
 */
export interface CubeCard extends Card {
  addedAt: number; // Timestamp when card was added
  instanceId: string; // Unique instance ID (allows multiple copies)
}

/**
 * Cube builder state
 */
export interface CubeBuilderState {
  cubeId: string | null;
  cubeName: string;
  cubeDescription: string;
  gameId: string;
  isPublic: boolean;
  cards: Map<string, CubeCard>;
  cardOrder: string[]; // Maintains insertion order
  isDirty: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
  // History for undo/redo
  history: Array<{ cards: Map<string, CubeCard>; cardOrder: string[] }>;
  historyIndex: number;
  // Duplicate limit: null = unlimited, number = max copies per card
  duplicateLimit: number | null;
}

/**
 * Action types for the reducer
 */
type CubeBuilderAction =
  | { type: 'SET_METADATA'; payload: { name?: string; description?: string; isPublic?: boolean } }
  | { type: 'SET_GAME'; payload: string }
  | { type: 'ADD_CARD'; payload: Card }
  | { type: 'ADD_CARDS'; payload: Card[] }
  | { type: 'REMOVE_CARD'; payload: string }
  | { type: 'REMOVE_CARDS'; payload: string[] }
  | { type: 'UPDATE_CARD_SCORE'; payload: { cardId: string; score: number } }
  | { type: 'UPDATE_ALL_COPIES_SCORE'; payload: { cardId: string | number; score: number } }
  | { type: 'SET_ALL_SCORES'; payload: number }
  | { type: 'LOAD_CUBE'; payload: { cubeId: string; name: string; description: string; gameId: string; isPublic: boolean; cards: Map<string, CubeCard>; cardOrder: string[]; duplicateLimit?: number | null } }
  | { type: 'NEW_CUBE'; payload: { gameId: string } }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS'; payload: { cubeId: string } }
  | { type: 'SAVE_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'MARK_CLEAN' }
  | { type: 'SET_DUPLICATE_LIMIT'; payload: number | null };

const MAX_HISTORY = 50;

/**
 * Push current state to history
 */
function pushHistory(state: CubeBuilderState): CubeBuilderState {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push({
    cards: new Map(state.cards),
    cardOrder: [...state.cardOrder],
  });

  // Limit history size
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
 * Cube builder reducer
 */
function cubeBuilderReducer(state: CubeBuilderState, action: CubeBuilderAction): CubeBuilderState {
  switch (action.type) {
    case 'SET_METADATA': {
      return {
        ...state,
        cubeName: action.payload.name ?? state.cubeName,
        cubeDescription: action.payload.description ?? state.cubeDescription,
        isPublic: action.payload.isPublic ?? state.isPublic,
        isDirty: true,
      };
    }

    case 'SET_GAME': {
      // Changing game clears all cards
      return {
        ...state,
        gameId: action.payload,
        cards: new Map(),
        cardOrder: [],
        isDirty: true,
        history: [],
        historyIndex: -1,
      };
    }

    case 'ADD_CARD': {
      // Generate unique instance ID to allow multiple copies
      const instanceId = `${action.payload.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const stateWithHistory = pushHistory(state);
      const newCards = new Map(stateWithHistory.cards);
      const cubeCard: CubeCard = {
        ...action.payload,
        addedAt: Date.now(),
        instanceId,
      };
      newCards.set(instanceId, cubeCard);

      return {
        ...stateWithHistory,
        cards: newCards,
        cardOrder: [...stateWithHistory.cardOrder, instanceId],
        isDirty: true,
      };
    }

    case 'ADD_CARDS': {
      const stateWithHistory = pushHistory(state);
      const newCards = new Map(stateWithHistory.cards);
      const newOrder = [...stateWithHistory.cardOrder];

      for (const card of action.payload) {
        // Generate unique instance ID for each card
        const instanceId = `${card.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const cubeCard: CubeCard = {
          ...card,
          addedAt: Date.now(),
          instanceId,
        };
        newCards.set(instanceId, cubeCard);
        newOrder.push(instanceId);
      }

      return {
        ...stateWithHistory,
        cards: newCards,
        cardOrder: newOrder,
        isDirty: true,
      };
    }

    case 'REMOVE_CARD': {
      const cardId = action.payload;
      if (!state.cards.has(cardId)) {
        return state;
      }

      const stateWithHistory = pushHistory(state);
      const newCards = new Map(stateWithHistory.cards);
      newCards.delete(cardId);

      return {
        ...stateWithHistory,
        cards: newCards,
        cardOrder: stateWithHistory.cardOrder.filter(id => id !== cardId),
        isDirty: true,
      };
    }

    case 'REMOVE_CARDS': {
      const idsToRemove = new Set(action.payload);
      if (idsToRemove.size === 0) {
        return state;
      }

      // Check if any of the cards exist
      const hasAnyCard = action.payload.some(id => state.cards.has(id));
      if (!hasAnyCard) {
        return state;
      }

      const stateWithHistory = pushHistory(state);
      const newCards = new Map(stateWithHistory.cards);
      for (const id of idsToRemove) {
        newCards.delete(id);
      }

      return {
        ...stateWithHistory,
        cards: newCards,
        cardOrder: stateWithHistory.cardOrder.filter(id => !idsToRemove.has(id)),
        isDirty: true,
      };
    }

    case 'UPDATE_CARD_SCORE': {
      const { cardId, score } = action.payload;
      const card = state.cards.get(cardId);
      if (!card) {
        return state;
      }

      const stateWithHistory = pushHistory(state);
      const newCards = new Map(stateWithHistory.cards);
      newCards.set(cardId, { ...card, score });

      return {
        ...stateWithHistory,
        cards: newCards,
        isDirty: true,
      };
    }

    case 'UPDATE_ALL_COPIES_SCORE': {
      const { cardId, score } = action.payload;
      const cardIdStr = String(cardId);

      // Find all instances of this card
      const hasCard = Array.from(state.cards.values()).some(
        card => String(card.id) === cardIdStr
      );
      if (!hasCard) {
        return state;
      }

      const stateWithHistory = pushHistory(state);
      const newCards = new Map(stateWithHistory.cards);

      // Update all copies of this card
      for (const [instanceId, card] of newCards) {
        if (String(card.id) === cardIdStr) {
          newCards.set(instanceId, { ...card, score });
        }
      }

      return {
        ...stateWithHistory,
        cards: newCards,
        isDirty: true,
      };
    }

    case 'SET_ALL_SCORES': {
      const stateWithHistory = pushHistory(state);
      const newCards = new Map<string, CubeCard>();

      for (const [id, card] of stateWithHistory.cards) {
        newCards.set(id, { ...card, score: action.payload });
      }

      return {
        ...stateWithHistory,
        cards: newCards,
        isDirty: true,
      };
    }

    case 'LOAD_CUBE': {
      return {
        ...state,
        cubeId: action.payload.cubeId,
        cubeName: action.payload.name,
        cubeDescription: action.payload.description,
        gameId: action.payload.gameId,
        isPublic: action.payload.isPublic,
        cards: action.payload.cards,
        cardOrder: action.payload.cardOrder,
        isDirty: false,
        isSaving: false,
        error: null,
        history: [],
        historyIndex: -1,
        duplicateLimit: action.payload.duplicateLimit ?? null,
      };
    }

    case 'NEW_CUBE': {
      return {
        ...createInitialState(),
        gameId: action.payload.gameId,
      };
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
        cubeId: action.payload.cubeId,
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
      if (state.historyIndex <= 0) {
        return state;
      }

      const previousState = state.history[state.historyIndex - 1];
      return {
        ...state,
        cards: new Map(previousState.cards),
        cardOrder: [...previousState.cardOrder],
        historyIndex: state.historyIndex - 1,
        isDirty: true,
      };
    }

    case 'REDO': {
      if (state.historyIndex >= state.history.length - 1) {
        return state;
      }

      const nextState = state.history[state.historyIndex + 1];
      return {
        ...state,
        cards: new Map(nextState.cards),
        cardOrder: [...nextState.cardOrder],
        historyIndex: state.historyIndex + 1,
        isDirty: true,
      };
    }

    case 'MARK_CLEAN': {
      return {
        ...state,
        isDirty: false,
      };
    }

    case 'SET_DUPLICATE_LIMIT': {
      return {
        ...state,
        duplicateLimit: action.payload,
        isDirty: true,
      };
    }

    default:
      return state;
  }
}

/**
 * Create initial state
 */
function createInitialState(): CubeBuilderState {
  return {
    cubeId: null,
    cubeName: '',
    cubeDescription: '',
    gameId: 'yugioh',
    isPublic: false,
    cards: new Map(),
    cardOrder: [],
    isDirty: false,
    isSaving: false,
    lastSaved: null,
    error: null,
    history: [],
    historyIndex: -1,
    duplicateLimit: null, // null = unlimited
  };
}

/**
 * Context value interface
 */
interface CubeBuilderContextValue {
  state: CubeBuilderState;
  // Metadata
  setMetadata: (updates: { name?: string; description?: string; isPublic?: boolean }) => void;
  setGame: (gameId: string) => void;
  // Card operations
  addCard: (card: Card) => void;
  addCards: (cards: Card[]) => void;
  removeCard: (instanceId: string) => void;
  removeCards: (instanceIds: string[]) => void;
  updateCardScore: (instanceId: string, score: number) => void;
  updateAllCopiesScore: (cardId: string | number, score: number) => void;
  setAllScores: (score: number) => void;
  hasCard: (cardId: string | number) => boolean;
  getCardCopyCount: (cardId: string | number) => number;
  getCardScore: (cardId: string | number) => number | undefined;
  canAddCard: (cardId: string | number) => boolean;
  // Duplicate limit
  setDuplicateLimit: (limit: number | null) => void;
  // Cube operations
  loadCube: (cubeId: string) => Promise<void>;
  newCube: (gameId: string) => void;
  saveCube: () => Promise<{ success: boolean; error?: string }>;
  // History
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  // Utilities
  clearError: () => void;
  getCardsArray: () => CubeCard[];
  getCardMap: () => Record<string | number, unknown>;
}

const CubeBuilderContext = createContext<CubeBuilderContextValue | null>(null);

interface CubeBuilderProviderProps {
  children: ReactNode;
  initialCubeId?: string;
  initialGameId?: string;
}

/**
 * Cube builder context provider
 */
export function CubeBuilderProvider({ children, initialCubeId, initialGameId }: CubeBuilderProviderProps) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(cubeBuilderReducer, createInitialState());
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load initial cube if cubeId is provided
  useEffect(() => {
    if (initialCubeId) {
      loadCube(initialCubeId);
    } else if (initialGameId) {
      dispatch({ type: 'NEW_CUBE', payload: { gameId: initialGameId } });
    }
  }, [initialCubeId, initialGameId]);

  // Auto-save with debounce
  useEffect(() => {
    if (state.isDirty && state.cubeId && !state.isSaving) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      autoSaveTimeoutRef.current = setTimeout(() => {
        saveCube();
      }, 3000);
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [state.isDirty, state.cubeId, state.isSaving, state.cards]);

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

  const setMetadata = useCallback((updates: { name?: string; description?: string; isPublic?: boolean }) => {
    dispatch({ type: 'SET_METADATA', payload: updates });
  }, []);

  const setGame = useCallback((gameId: string) => {
    dispatch({ type: 'SET_GAME', payload: gameId });
  }, []);

  const addCard = useCallback((card: Card) => {
    dispatch({ type: 'ADD_CARD', payload: card });
  }, []);

  const addCards = useCallback((cards: Card[]) => {
    dispatch({ type: 'ADD_CARDS', payload: cards });
  }, []);

  const removeCard = useCallback((cardId: string) => {
    dispatch({ type: 'REMOVE_CARD', payload: cardId });
  }, []);

  const removeCards = useCallback((cardIds: string[]) => {
    dispatch({ type: 'REMOVE_CARDS', payload: cardIds });
  }, []);

  const updateCardScore = useCallback((cardId: string, score: number) => {
    dispatch({ type: 'UPDATE_CARD_SCORE', payload: { cardId, score } });
  }, []);

  const updateAllCopiesScore = useCallback((cardId: string | number, score: number) => {
    dispatch({ type: 'UPDATE_ALL_COPIES_SCORE', payload: { cardId, score } });
  }, []);

  const getCardScore = useCallback((cardId: string | number): number | undefined => {
    const cardIdStr = String(cardId);
    for (const card of state.cards.values()) {
      if (String(card.id) === cardIdStr) {
        return card.score;
      }
    }
    return undefined;
  }, [state.cards]);

  const setAllScores = useCallback((score: number) => {
    dispatch({ type: 'SET_ALL_SCORES', payload: score });
  }, []);

  const hasCard = useCallback((cardId: string | number): boolean => {
    const cardIdStr = String(cardId);
    for (const card of state.cards.values()) {
      if (String(card.id) === cardIdStr) return true;
    }
    return false;
  }, [state.cards]);

  const getCardCopyCount = useCallback((cardId: string | number): number => {
    const cardIdStr = String(cardId);
    let count = 0;
    for (const card of state.cards.values()) {
      if (String(card.id) === cardIdStr) count++;
    }
    return count;
  }, [state.cards]);

  const canAddCard = useCallback((cardId: string | number): boolean => {
    if (state.duplicateLimit === null) return true;
    const copyCount = getCardCopyCount(cardId);
    return copyCount < state.duplicateLimit;
  }, [state.duplicateLimit, getCardCopyCount]);

  const setDuplicateLimit = useCallback((limit: number | null) => {
    dispatch({ type: 'SET_DUPLICATE_LIMIT', payload: limit });
  }, []);

  const loadCube = useCallback(async (cubeId: string) => {
    try {
      const cubeData = await cubeService.loadAnyCube(cubeId);

      const cards = new Map<string, CubeCard>();
      const cardOrder: string[] = [];

      // Use cubeData.cards array which preserves duplicates
      for (const card of cubeData.cards) {
        // Generate unique instanceId for each card instance
        const instanceId = `${card.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const cubeCard: CubeCard = {
          id: card.id,
          name: card.name,
          type: card.type,
          description: card.desc || '',
          score: card.score,
          imageUrl: card.imageUrl,
          attributes: card.attributes || {
            atk: card.atk,
            def: card.def,
            level: card.level,
            attribute: card.attribute,
            race: card.race,
            linkval: card.linkval,
            archetype: card.archetype,
          },
          addedAt: Date.now(),
          instanceId,
        };
        cards.set(instanceId, cubeCard);
        cardOrder.push(instanceId);
      }

      // Fetch cube metadata from database if it's a db cube
      let isPublic = false;
      if (cubeService.isDatabaseCube(cubeId)) {
        // The cube data doesn't include is_public, we need to check the raw cube info
        const { cubes } = await cubeService.loadMyCubes(user?.id || '', { limit: 100 });
        const cubeInfo = cubes.find(c => c.id === cubeId);
        isPublic = cubeInfo?.isPublic ?? false;
      }

      dispatch({
        type: 'LOAD_CUBE',
        payload: {
          cubeId,
          name: cubeData.name,
          description: '', // Would need to fetch from DB
          gameId: cubeData.gameId,
          isPublic,
          cards,
          cardOrder,
          duplicateLimit: cubeData.duplicateLimit,
        },
      });
    } catch (error) {
      dispatch({
        type: 'SAVE_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to load cube',
      });
    }
  }, [user?.id]);

  const newCube = useCallback((gameId: string) => {
    dispatch({ type: 'NEW_CUBE', payload: { gameId } });
  }, []);

  const saveCube = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!state.cubeName.trim()) {
      return { success: false, error: 'Cube name is required' };
    }

    dispatch({ type: 'SAVE_START' });

    try {
      const cardMap = getCardMap();

      if (state.cubeId) {
        // Update existing cube
        const result = await cubeService.updateDatabaseCube(state.cubeId, {
          name: state.cubeName,
          description: state.cubeDescription,
          cardMap,
          isPublic: state.isPublic,
          duplicateLimit: state.duplicateLimit,
        });

        if (result.error) {
          dispatch({ type: 'SAVE_ERROR', payload: result.error });
          return { success: false, error: result.error };
        }

        dispatch({ type: 'SAVE_SUCCESS', payload: { cubeId: state.cubeId } });
        return { success: true };
      } else {
        // Create new cube
        const result = await cubeService.saveCubeToDatabase(
          state.cubeName,
          state.cubeDescription,
          state.gameId,
          cardMap,
          {
            isPublic: state.isPublic,
            creatorId: user?.id,
            duplicateLimit: state.duplicateLimit,
          }
        );

        if (result.error) {
          dispatch({ type: 'SAVE_ERROR', payload: result.error });
          return { success: false, error: result.error };
        }

        dispatch({ type: 'SAVE_SUCCESS', payload: { cubeId: result.id } });
        return { success: true };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save cube';
      dispatch({ type: 'SAVE_ERROR', payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  }, [state.cubeId, state.cubeName, state.cubeDescription, state.gameId, state.isPublic, state.duplicateLimit, state.cards, user?.id]);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const getCardsArray = useCallback((): CubeCard[] => {
    return state.cardOrder.map(id => state.cards.get(id)!).filter(Boolean);
  }, [state.cards, state.cardOrder]);

  const getCardMap = useCallback((): Record<string | number, unknown> => {
    const cardMap: Record<string | number, unknown> = {};
    for (const [instanceId, card] of state.cards) {
      cardMap[instanceId] = {
        id: card.id,
        name: card.name,
        type: card.type,
        desc: card.description || '',
        score: card.score,
        imageUrl: card.imageUrl,
        attributes: card.attributes,
        instanceId: card.instanceId,
        // Flatten YuGiOh attributes for backward compatibility
        ...(card.attributes || {}),
      };
    }
    return cardMap;
  }, [state.cards]);

  const value: CubeBuilderContextValue = {
    state,
    setMetadata,
    setGame,
    addCard,
    addCards,
    removeCard,
    removeCards,
    updateCardScore,
    updateAllCopiesScore,
    setAllScores,
    hasCard,
    getCardCopyCount,
    getCardScore,
    canAddCard,
    setDuplicateLimit,
    loadCube,
    newCube,
    saveCube,
    undo,
    redo,
    canUndo: state.historyIndex > 0,
    canRedo: state.historyIndex < state.history.length - 1,
    clearError,
    getCardsArray,
    getCardMap,
  };

  return (
    <CubeBuilderContext.Provider value={value}>
      {children}
    </CubeBuilderContext.Provider>
  );
}

/**
 * Hook to access cube builder context
 */
export function useCubeBuilder(): CubeBuilderContextValue {
  const context = useContext(CubeBuilderContext);
  if (!context) {
    throw new Error('useCubeBuilder must be used within a CubeBuilderProvider');
  }
  return context;
}
