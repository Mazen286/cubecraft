import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { GameConfig } from '../config/gameConfig';
import { getGameConfig, getGameConfigOrNull, DEFAULT_GAME_ID, getAllGameConfigs } from '../config/games';

/**
 * Game context value interface
 */
interface GameContextValue {
  /** Current game configuration */
  gameConfig: GameConfig;
  /** Current game ID */
  gameId: string;
  /** Change the active game */
  setGame: (gameId: string) => void;
  /** Get all available games */
  availableGames: GameConfig[];
}

/**
 * Game context
 */
const GameContext = createContext<GameContextValue | null>(null);

/**
 * Storage key for preferred game
 */
const PREFERRED_GAME_KEY = 'cube-draft-preferred-game';

/**
 * Get initial game ID from URL params, localStorage, or default
 */
function getInitialGameId(): string {
  // Check URL params first (e.g., ?game=mtg)
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const urlGame = params.get('game');
    if (urlGame && getGameConfigOrNull(urlGame)) {
      return urlGame;
    }

    // Check localStorage
    const storedGame = localStorage.getItem(PREFERRED_GAME_KEY);
    if (storedGame && getGameConfigOrNull(storedGame)) {
      return storedGame;
    }
  }

  return DEFAULT_GAME_ID;
}

/**
 * Props for GameProvider
 */
interface GameProviderProps {
  children: ReactNode;
  /** Override the initial game (useful for testing or specific pages) */
  initialGame?: string;
}

/**
 * Game context provider component.
 * Wraps the app to provide game configuration to all components.
 */
export function GameProvider({ children, initialGame }: GameProviderProps) {
  const [gameId, setGameId] = useState(() => initialGame || getInitialGameId());

  const gameConfig = getGameConfig(gameId);
  const availableGames = getAllGameConfigs();

  const setGame = useCallback((newGameId: string) => {
    // Validate the game exists
    const config = getGameConfigOrNull(newGameId);
    if (!config) {
      console.error(`Unknown game: ${newGameId}`);
      return;
    }

    setGameId(newGameId);

    // Persist preference
    if (typeof window !== 'undefined') {
      localStorage.setItem(PREFERRED_GAME_KEY, newGameId);
    }
  }, []);

  // Apply theme when game changes
  useEffect(() => {
    applyGameTheme(gameConfig);
  }, [gameConfig]);

  const value: GameContextValue = {
    gameConfig,
    gameId,
    setGame,
    availableGames,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

/**
 * Hook to access the current game configuration.
 * Must be used within a GameProvider.
 */
export function useGameConfig(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGameConfig must be used within a GameProvider');
  }
  return context;
}

/**
 * Hook to access just the game config (convenience)
 */
export function useGame(): GameConfig {
  const { gameConfig } = useGameConfig();
  return gameConfig;
}

/**
 * Apply game theme to CSS variables
 */
function applyGameTheme(config: GameConfig): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // Set CSS custom properties
  root.style.setProperty('--game-primary', config.theme.primaryColor);
  root.style.setProperty('--game-accent', config.theme.accentColor);

  if (config.theme.backgroundColor) {
    root.style.setProperty('--game-bg', config.theme.backgroundColor);
  }

  // Update meta theme-color for mobile browsers
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', config.theme.primaryColor);
  }
}

/**
 * Get game config outside of React context (for services, etc.)
 * Uses the stored preference or default
 */
export function getActiveGameConfig(): GameConfig {
  if (typeof window !== 'undefined') {
    const storedGame = localStorage.getItem(PREFERRED_GAME_KEY);
    if (storedGame) {
      const config = getGameConfigOrNull(storedGame);
      if (config) return config;
    }
  }
  return getGameConfig(DEFAULT_GAME_ID);
}
