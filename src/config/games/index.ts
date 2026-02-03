import type { GameConfig } from '../gameConfig';
import { yugiohConfig } from './yugioh';
import { mtgConfig } from './mtg';
import { pokemonConfig } from './pokemon';
import { hearthstoneConfig } from './hearthstone';
import { arkhamConfig } from './arkham';

/**
 * Registry of all available game configurations
 */
const gameConfigs: Map<string, GameConfig> = new Map();

// Register built-in games
gameConfigs.set(yugiohConfig.id, yugiohConfig);
gameConfigs.set(mtgConfig.id, mtgConfig);
gameConfigs.set(pokemonConfig.id, pokemonConfig);
gameConfigs.set(hearthstoneConfig.id, hearthstoneConfig);
gameConfigs.set(arkhamConfig.id, arkhamConfig);

/**
 * Get a game configuration by ID
 * @throws Error if game not found
 */
export function getGameConfig(gameId: string): GameConfig {
  const config = gameConfigs.get(gameId);
  if (!config) {
    throw new Error(`Unknown game: ${gameId}. Available games: ${Array.from(gameConfigs.keys()).join(', ')}`);
  }
  return config;
}

/**
 * Get a game configuration by ID, or null if not found
 */
export function getGameConfigOrNull(gameId: string): GameConfig | null {
  return gameConfigs.get(gameId) || null;
}

/**
 * Get all registered game configurations
 */
export function getAllGameConfigs(): GameConfig[] {
  return Array.from(gameConfigs.values());
}

/**
 * Get all game IDs
 */
export function getAllGameIds(): string[] {
  return Array.from(gameConfigs.keys());
}

/**
 * Register a new game configuration
 */
export function registerGameConfig(config: GameConfig): void {
  if (gameConfigs.has(config.id)) {
    console.warn(`Overwriting existing game config: ${config.id}`);
  }
  gameConfigs.set(config.id, config);
}

/**
 * Unregister a game configuration
 */
export function unregisterGameConfig(gameId: string): boolean {
  return gameConfigs.delete(gameId);
}

/**
 * Check if a game is registered
 */
export function hasGameConfig(gameId: string): boolean {
  return gameConfigs.has(gameId);
}

/**
 * Default game ID (Yu-Gi-Oh! for backward compatibility)
 */
export const DEFAULT_GAME_ID = 'yugioh';

/**
 * Get the default game configuration
 */
export function getDefaultGameConfig(): GameConfig {
  return getGameConfig(DEFAULT_GAME_ID);
}

// Re-export the configs for convenience
export { yugiohConfig } from './yugioh';
export { mtgConfig } from './mtg';
export { pokemonConfig } from './pokemon';
export { hearthstoneConfig } from './hearthstone';
export { arkhamConfig } from './arkham';
