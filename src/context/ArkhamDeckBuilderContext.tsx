import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type {
  Investigator,
  ArkhamCard,
  ArkhamDeckData,
  ArkhamValidationResult,
} from '../types/arkham';
import { arkhamCardService } from '../services/arkhamCardService';
import { arkhamDeckService } from '../services/arkhamDeckService';
import { validateArkhamDeck, calculateXpCost, canIncludeCard } from '../services/arkhamDeckValidation';
import { parseArkhamDeck } from '../services/arkhamDeckImport';
import { useAuth } from './AuthContext';

/**
 * Arkham Deck Builder State
 */
export interface ArkhamDeckBuilderState {
  // Core deck data
  deckId: string | null;
  deckName: string;
  deckDescription: string;

  // Investigator
  investigator: Investigator | null;

  // Cards: code -> quantity
  slots: Record<string, number>;
  sideSlots: Record<string, number>;

  // XP tracking
  xpEarned: number;
  xpSpent: number;

  // Campaign tracking
  campaignId: string | null;
  version: number;
  previousVersionId: string | null;

  // Validation
  validationResult: ArkhamValidationResult | null;

  // State flags
  isInitialized: boolean;
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  lastSaved: Date | null;
  error: string | null;

  // History for undo/redo
  history: Array<{
    slots: Record<string, number>;
    xpSpent: number;
  }>;
  historyIndex: number;
}

/**
 * Action types for the reducer
 */
type ArkhamDeckBuilderAction =
  | { type: 'INITIALIZE' }
  | { type: 'SET_INVESTIGATOR'; payload: Investigator }
  | { type: 'SET_METADATA'; payload: { name?: string; description?: string } }
  | { type: 'ADD_CARD'; payload: { code: string; quantity?: number } }
  | { type: 'REMOVE_CARD'; payload: { code: string; quantity?: number } }
  | { type: 'SET_CARD_QUANTITY'; payload: { code: string; quantity: number } }
  | { type: 'UPGRADE_CARD'; payload: { oldCode: string; newCode: string } }
  | { type: 'ADD_XP'; payload: number }
  | { type: 'SET_XP'; payload: { earned?: number; spent?: number } }
  | { type: 'LOAD_DECK'; payload: ArkhamDeckData }
  | { type: 'NEW_DECK'; payload: { investigator: Investigator } }
  | { type: 'IMPORT_DECK'; payload: { investigatorCode: string; slots: Record<string, number>; name?: string } }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS'; payload: { deckId: string } }
  | { type: 'SAVE_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'VALIDATE' };

const MAX_HISTORY = 50;

/**
 * Push current state to history
 */
function pushHistory(state: ArkhamDeckBuilderState): ArkhamDeckBuilderState {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push({
    slots: { ...state.slots },
    xpSpent: state.xpSpent,
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
 * Run validation on current state
 */
function runValidation(state: ArkhamDeckBuilderState): ArkhamValidationResult | null {
  if (!state.investigator) return null;

  const xpBudget = state.xpEarned > 0 ? state.xpEarned : 0;
  return validateArkhamDeck(state.investigator, state.slots, xpBudget);
}

/**
 * Arkham Deck Builder reducer
 */
function arkhamDeckBuilderReducer(
  state: ArkhamDeckBuilderState,
  action: ArkhamDeckBuilderAction
): ArkhamDeckBuilderState {
  switch (action.type) {
    case 'INITIALIZE': {
      return {
        ...state,
        isInitialized: true,
      };
    }

    case 'SET_INVESTIGATOR': {
      // When setting investigator, add signature cards
      const investigator = action.payload;
      const slots: Record<string, number> = {};

      // Add signature cards
      if (investigator.deck_requirements?.card) {
        for (const code of Object.keys(investigator.deck_requirements.card)) {
          const card = arkhamCardService.getCard(code);
          if (card) {
            slots[code] = card.quantity || 1;
          }
        }
      }

      const newState: ArkhamDeckBuilderState = {
        ...state,
        investigator,
        slots,
        sideSlots: {},
        xpEarned: 0,
        xpSpent: 0,
        isDirty: true,
        history: [],
        historyIndex: -1,
      };

      return {
        ...newState,
        validationResult: runValidation(newState),
      };
    }

    case 'SET_METADATA': {
      return {
        ...state,
        deckName: action.payload.name ?? state.deckName,
        deckDescription: action.payload.description ?? state.deckDescription,
        isDirty: true,
      };
    }

    case 'ADD_CARD': {
      const { code, quantity = 1 } = action.payload;
      const stateWithHistory = pushHistory(state);

      const newSlots = { ...stateWithHistory.slots };
      const currentQty = newSlots[code] || 0;
      newSlots[code] = currentQty + quantity;

      // Recalculate XP spent
      const newXpSpent = calculateXpCost(newSlots);

      const newState = {
        ...stateWithHistory,
        slots: newSlots,
        xpSpent: newXpSpent,
        isDirty: true,
      };

      return {
        ...newState,
        validationResult: runValidation(newState),
      };
    }

    case 'REMOVE_CARD': {
      const { code, quantity = 1 } = action.payload;
      const stateWithHistory = pushHistory(state);

      const newSlots = { ...stateWithHistory.slots };
      const currentQty = newSlots[code] || 0;
      const newQty = Math.max(0, currentQty - quantity);

      if (newQty === 0) {
        delete newSlots[code];
      } else {
        newSlots[code] = newQty;
      }

      // Recalculate XP spent
      const newXpSpent = calculateXpCost(newSlots);

      const newState = {
        ...stateWithHistory,
        slots: newSlots,
        xpSpent: newXpSpent,
        isDirty: true,
      };

      return {
        ...newState,
        validationResult: runValidation(newState),
      };
    }

    case 'SET_CARD_QUANTITY': {
      const { code, quantity } = action.payload;
      const stateWithHistory = pushHistory(state);

      const newSlots = { ...stateWithHistory.slots };

      if (quantity <= 0) {
        delete newSlots[code];
      } else {
        newSlots[code] = quantity;
      }

      // Recalculate XP spent
      const newXpSpent = calculateXpCost(newSlots);

      const newState = {
        ...stateWithHistory,
        slots: newSlots,
        xpSpent: newXpSpent,
        isDirty: true,
      };

      return {
        ...newState,
        validationResult: runValidation(newState),
      };
    }

    case 'UPGRADE_CARD': {
      const { oldCode, newCode } = action.payload;
      const stateWithHistory = pushHistory(state);

      const newSlots = { ...stateWithHistory.slots };

      // Remove old card
      const oldQty = newSlots[oldCode] || 0;
      if (oldQty > 1) {
        newSlots[oldCode] = oldQty - 1;
      } else {
        delete newSlots[oldCode];
      }

      // Add new card
      newSlots[newCode] = (newSlots[newCode] || 0) + 1;

      // Recalculate XP spent
      const newXpSpent = calculateXpCost(newSlots);

      const newState = {
        ...stateWithHistory,
        slots: newSlots,
        xpSpent: newXpSpent,
        isDirty: true,
      };

      return {
        ...newState,
        validationResult: runValidation(newState),
      };
    }

    case 'ADD_XP': {
      return {
        ...state,
        xpEarned: state.xpEarned + action.payload,
        isDirty: true,
      };
    }

    case 'SET_XP': {
      const newState = {
        ...state,
        xpEarned: action.payload.earned ?? state.xpEarned,
        xpSpent: action.payload.spent ?? state.xpSpent,
        isDirty: true,
      };

      return {
        ...newState,
        validationResult: runValidation(newState),
      };
    }

    case 'LOAD_DECK': {
      const deckData = action.payload;
      const investigator = arkhamCardService.getInvestigator(deckData.investigator_code);

      const newState: ArkhamDeckBuilderState = {
        ...state,
        deckId: deckData.id,
        deckName: deckData.name,
        deckDescription: deckData.description || '',
        investigator,
        slots: deckData.slots,
        sideSlots: deckData.sideSlots || {},
        xpEarned: deckData.xp_earned,
        xpSpent: deckData.xp_spent,
        campaignId: deckData.campaign_id || null,
        version: deckData.version,
        previousVersionId: deckData.previous_version_id || null,
        isDirty: false,
        isSaving: false,
        isLoading: false,
        error: null,
        history: [],
        historyIndex: -1,
      };

      return {
        ...newState,
        validationResult: runValidation(newState),
      };
    }

    case 'NEW_DECK': {
      const { investigator } = action.payload;
      const slots: Record<string, number> = {};

      // Add signature cards
      if (investigator.deck_requirements?.card) {
        for (const code of Object.keys(investigator.deck_requirements.card)) {
          const card = arkhamCardService.getCard(code);
          if (card) {
            slots[code] = card.quantity || 1;
          }
        }
      }

      const newState: ArkhamDeckBuilderState = {
        ...createInitialState(),
        isInitialized: state.isInitialized,
        investigator,
        slots,
        deckName: `${investigator.name} Deck`,
      };

      return {
        ...newState,
        validationResult: runValidation(newState),
      };
    }

    case 'IMPORT_DECK': {
      const { investigatorCode, slots: importedSlots, name } = action.payload;
      const investigator = arkhamCardService.getInvestigator(investigatorCode);

      if (!investigator) {
        return {
          ...state,
          error: 'Investigator not found in imported deck',
        };
      }

      // Start with signature cards
      const slots: Record<string, number> = {};
      if (investigator.deck_requirements?.card) {
        for (const code of Object.keys(investigator.deck_requirements.card)) {
          const card = arkhamCardService.getCard(code);
          if (card) {
            slots[code] = card.quantity || 1;
          }
        }
      }

      // Add imported cards
      for (const [code, qty] of Object.entries(importedSlots)) {
        slots[code] = qty;
      }

      // Calculate XP spent
      const xpSpent = calculateXpCost(slots);

      const newState: ArkhamDeckBuilderState = {
        ...createInitialState(),
        isInitialized: state.isInitialized,
        investigator,
        slots,
        deckName: name || `${investigator.name} Deck (Imported)`,
        xpSpent,
        isDirty: true,
      };

      return {
        ...newState,
        validationResult: runValidation(newState),
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
        slots: { ...previousState.slots },
        xpSpent: previousState.xpSpent,
        historyIndex: state.historyIndex - 1,
        isDirty: true,
      };

      return {
        ...newState,
        validationResult: runValidation(newState),
      };
    }

    case 'REDO': {
      if (state.historyIndex >= state.history.length - 1) return state;

      const nextState = state.history[state.historyIndex + 1];
      const newState = {
        ...state,
        slots: { ...nextState.slots },
        xpSpent: nextState.xpSpent,
        historyIndex: state.historyIndex + 1,
        isDirty: true,
      };

      return {
        ...newState,
        validationResult: runValidation(newState),
      };
    }

    case 'SET_LOADING': {
      return {
        ...state,
        isLoading: action.payload,
      };
    }

    case 'VALIDATE': {
      return {
        ...state,
        validationResult: runValidation(state),
      };
    }

    default:
      return state;
  }
}

/**
 * Create initial state
 */
function createInitialState(): ArkhamDeckBuilderState {
  return {
    deckId: null,
    deckName: '',
    deckDescription: '',
    investigator: null,
    slots: {},
    sideSlots: {},
    xpEarned: 0,
    xpSpent: 0,
    campaignId: null,
    version: 1,
    previousVersionId: null,
    validationResult: null,
    isInitialized: false,
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
interface ArkhamDeckBuilderContextValue {
  state: ArkhamDeckBuilderState;

  // Investigator
  setInvestigator: (investigator: Investigator) => void;
  investigators: Investigator[];

  // Metadata
  setMetadata: (updates: { name?: string; description?: string }) => void;

  // Card operations
  addCard: (code: string, quantity?: number) => void;
  removeCard: (code: string, quantity?: number) => void;
  setCardQuantity: (code: string, quantity: number) => void;
  upgradeCard: (oldCode: string, newCode: string) => void;

  // Card queries
  getCardQuantity: (code: string) => number;
  hasCard: (code: string) => boolean;
  canAddCard: (code: string) => { allowed: boolean; reason?: string };
  getTotalCardCount: () => number;
  getCard: (code: string) => ArkhamCard | null;

  // XP operations
  addXP: (amount: number) => void;
  setXP: (earned?: number, spent?: number) => void;
  getAvailableXP: () => number;

  // Deck operations
  loadDeck: (deckId: string) => Promise<void>;
  newDeck: (investigator: Investigator) => void;
  saveDeck: () => Promise<{ success: boolean; error?: string }>;
  createUpgradedVersion: (xpEarned: number) => Promise<{ success: boolean; id?: string; error?: string }>;
  importDeck: (content: string) => { success: boolean; warnings: string[]; errors: string[] };

  // History
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Utilities
  clearError: () => void;
}

const ArkhamDeckBuilderContext = createContext<ArkhamDeckBuilderContextValue | null>(null);

interface ArkhamDeckBuilderProviderProps {
  children: ReactNode;
  initialDeckId?: string;
}

/**
 * Arkham Deck Builder context provider
 */
export function ArkhamDeckBuilderProvider({
  children,
  initialDeckId,
}: ArkhamDeckBuilderProviderProps) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(arkhamDeckBuilderReducer, createInitialState());
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize card service
  useEffect(() => {
    const init = async () => {
      try {
        console.log('Initializing Arkham card service...');
        await arkhamCardService.initialize();
        console.log('Arkham card service initialized, investigators:', arkhamCardService.getInvestigators().length);
        dispatch({ type: 'INITIALIZE' });

        // Load deck if ID provided
        if (initialDeckId) {
          loadDeck(initialDeckId);
        }
      } catch (error) {
        console.error('Failed to initialize Arkham card service:', error);
        dispatch({ type: 'SAVE_ERROR', payload: error instanceof Error ? error.message : 'Failed to load card data' });
      }
    };

    init();
  }, [initialDeckId]);

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
  }, [state.isDirty, state.deckId, state.isSaving, state.slots]);

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

  const setInvestigator = useCallback((investigator: Investigator) => {
    dispatch({ type: 'SET_INVESTIGATOR', payload: investigator });
  }, []);

  const setMetadata = useCallback((updates: { name?: string; description?: string }) => {
    dispatch({ type: 'SET_METADATA', payload: updates });
  }, []);

  const addCard = useCallback((code: string, quantity: number = 1) => {
    dispatch({ type: 'ADD_CARD', payload: { code, quantity } });
  }, []);

  const removeCard = useCallback((code: string, quantity: number = 1) => {
    dispatch({ type: 'REMOVE_CARD', payload: { code, quantity } });
  }, []);

  const setCardQuantity = useCallback((code: string, quantity: number) => {
    dispatch({ type: 'SET_CARD_QUANTITY', payload: { code, quantity } });
  }, []);

  const upgradeCard = useCallback((oldCode: string, newCode: string) => {
    dispatch({ type: 'UPGRADE_CARD', payload: { oldCode, newCode } });
  }, []);

  const getCardQuantity = useCallback((code: string): number => {
    return state.slots[code] || 0;
  }, [state.slots]);

  const hasCard = useCallback((code: string): boolean => {
    return (state.slots[code] || 0) > 0;
  }, [state.slots]);

  const canAddCard = useCallback((code: string): { allowed: boolean; reason?: string } => {
    if (!state.investigator) {
      return { allowed: false, reason: 'No investigator selected' };
    }

    const card = arkhamCardService.getCard(code);
    if (!card) {
      return { allowed: false, reason: 'Card not found' };
    }

    // Check deck limit
    const currentQty = state.slots[code] || 0;
    const deckLimit = card.deck_limit ?? 2;
    if (currentQty >= deckLimit) {
      return { allowed: false, reason: `Maximum copies (${deckLimit}) already in deck` };
    }

    // Check eligibility using validation service
    const eligibility = canIncludeCard(state.investigator, card);

    return eligibility;
  }, [state.investigator, state.slots]);

  const getTotalCardCount = useCallback((): number => {
    let total = 0;
    for (const qty of Object.values(state.slots)) {
      total += qty;
    }
    return total;
  }, [state.slots]);

  const getCard = useCallback((code: string): ArkhamCard | null => {
    return arkhamCardService.getCard(code);
  }, []);

  const addXP = useCallback((amount: number) => {
    dispatch({ type: 'ADD_XP', payload: amount });
  }, []);

  const setXP = useCallback((earned?: number, spent?: number) => {
    dispatch({ type: 'SET_XP', payload: { earned, spent } });
  }, []);

  const getAvailableXP = useCallback((): number => {
    return state.xpEarned - state.xpSpent;
  }, [state.xpEarned, state.xpSpent]);

  const loadDeck = useCallback(async (deckId: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const deckData = await arkhamDeckService.loadDeck(deckId);
      dispatch({ type: 'LOAD_DECK', payload: deckData });
    } catch (error) {
      dispatch({
        type: 'SAVE_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to load deck',
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const newDeck = useCallback((investigator: Investigator) => {
    dispatch({ type: 'NEW_DECK', payload: { investigator } });
  }, []);

  const importDeck = useCallback((content: string): { success: boolean; warnings: string[]; errors: string[] } => {
    const result = parseArkhamDeck(content);

    if (result.errors.length > 0) {
      return { success: false, warnings: result.warnings, errors: result.errors };
    }

    if (!result.investigatorCode) {
      return {
        success: false,
        warnings: result.warnings,
        errors: ['No investigator found in imported deck'],
      };
    }

    dispatch({
      type: 'IMPORT_DECK',
      payload: {
        investigatorCode: result.investigatorCode,
        slots: result.slots,
        name: result.name,
      },
    });

    return { success: true, warnings: result.warnings, errors: [] };
  }, []);

  const saveDeck = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!state.investigator) {
      return { success: false, error: 'No investigator selected' };
    }

    if (!state.deckName.trim()) {
      return { success: false, error: 'Deck name is required' };
    }

    dispatch({ type: 'SAVE_START' });

    try {
      if (state.deckId) {
        // Update existing deck
        const result = await arkhamDeckService.updateDeck(state.deckId, {
          name: state.deckName,
          description: state.deckDescription,
          slots: state.slots,
          sideSlots: state.sideSlots,
          xpEarned: state.xpEarned,
          xpSpent: state.xpSpent,
        });

        if (result.error) {
          dispatch({ type: 'SAVE_ERROR', payload: result.error });
          return { success: false, error: result.error };
        }

        dispatch({ type: 'SAVE_SUCCESS', payload: { deckId: state.deckId } });
        return { success: true };
      } else {
        // Create new deck
        const result = await arkhamDeckService.saveDeck({
          name: state.deckName,
          description: state.deckDescription,
          investigatorCode: state.investigator.code,
          investigatorName: state.investigator.name,
          slots: state.slots,
          sideSlots: state.sideSlots,
          xpEarned: state.xpEarned,
          xpSpent: state.xpSpent,
          campaignId: state.campaignId || undefined,
          version: state.version,
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

  const createUpgradedVersion = useCallback(async (
    xpEarned: number
  ): Promise<{ success: boolean; id?: string; error?: string }> => {
    if (!state.deckId) {
      return { success: false, error: 'Must save deck before creating upgrade' };
    }

    try {
      const result = await arkhamDeckService.createUpgradedVersion(state.deckId, {
        slots: state.slots,
        sideSlots: state.sideSlots,
        xpEarned: state.xpEarned + xpEarned,
        xpSpent: state.xpSpent,
      });

      if (result.error) {
        return { success: false, error: result.error };
      }

      // Load the new version
      await loadDeck(result.id);

      return { success: true, id: result.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create upgrade',
      };
    }
  }, [state.deckId, state.slots, state.sideSlots, state.xpEarned, state.xpSpent, loadDeck]);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const investigators = state.isInitialized ? arkhamCardService.getInvestigators() : [];

  const value: ArkhamDeckBuilderContextValue = {
    state,
    setInvestigator,
    investigators,
    setMetadata,
    addCard,
    removeCard,
    setCardQuantity,
    upgradeCard,
    getCardQuantity,
    hasCard,
    canAddCard,
    getTotalCardCount,
    getCard,
    addXP,
    setXP,
    getAvailableXP,
    loadDeck,
    newDeck,
    saveDeck,
    importDeck,
    createUpgradedVersion,
    undo,
    redo,
    canUndo: state.historyIndex > 0,
    canRedo: state.historyIndex < state.history.length - 1,
    clearError,
  };

  return (
    <ArkhamDeckBuilderContext.Provider value={value}>
      {children}
    </ArkhamDeckBuilderContext.Provider>
  );
}

/**
 * Hook to access Arkham deck builder context
 */
export function useArkhamDeckBuilder(): ArkhamDeckBuilderContextValue {
  const context = useContext(ArkhamDeckBuilderContext);
  if (!context) {
    throw new Error('useArkhamDeckBuilder must be used within an ArkhamDeckBuilderProvider');
  }
  return context;
}
