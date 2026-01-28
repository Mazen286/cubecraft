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
 */
export function getUserId(): string {
  const key = `${getStoragePrefix()}-user-id`;
  let userId = localStorage.getItem(key);
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem(key, userId);
  }
  return userId;
}
