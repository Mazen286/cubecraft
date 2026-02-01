/**
 * Shared utilities for services
 * Extracted from draftService and auctionService to avoid duplication
 */

import { getActiveGameConfig } from '../context/GameContext';

/**
 * Get the storage key prefix for the current game.
 * Falls back to 'yugioh-draft' if context is not available.
 */
export function getStoragePrefix(): string {
  try {
    return getActiveGameConfig().storageKeyPrefix;
  } catch {
    // Fallback if context not available
    return 'yugioh-draft';
  }
}

/**
 * Get or generate a unique user ID for this browser session.
 * Stored in localStorage for persistence across page reloads.
 *
 * IMPORTANT: Uses a fixed key to ensure the same user ID is returned
 * regardless of which game is active. This prevents race conditions
 * where the game config might not be loaded yet.
 */
export function getUserId(): string {
  // Use a fixed key - user ID should be consistent across all games
  const key = 'cubecraft-user-id';
  let userId = localStorage.getItem(key);

  // Migration: check for legacy keys and migrate if found
  if (!userId) {
    const legacyKeys = ['yugioh-draft-user-id', 'mtg-draft-user-id', 'pokemon-draft-user-id'];
    for (const legacyKey of legacyKeys) {
      const legacyId = localStorage.getItem(legacyKey);
      if (legacyId) {
        userId = legacyId;
        localStorage.setItem(key, userId);
        break;
      }
    }
  }

  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem(key, userId);
  }
  return userId;
}
