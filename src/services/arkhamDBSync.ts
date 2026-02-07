/**
 * ArkhamDB Sync Service
 * Handles syncing decks to/from ArkhamDB
 */

import { getAccessToken } from './arkhamDBAuth';
import type { ArkhamDeckData } from '../types/arkham';

// ArkhamDB API base URL for OAuth2 endpoints
const API_BASE = 'https://arkhamdb.com/api/oauth2';

/**
 * Response from creating a new deck on ArkhamDB
 */
interface CreateDeckResponse {
  success: boolean;
  msg?: string;
  deck_id?: number;
}

/**
 * Response from saving a deck on ArkhamDB
 */
interface SaveDeckResponse {
  success: boolean;
  msg?: string;
}

/**
 * Response from publishing a deck on ArkhamDB
 */
interface PublishDeckResponse {
  success: boolean;
  msg?: string;
  decklist_id?: number;
}

/**
 * ArkhamDB deck format
 */
interface ArkhamDBDeckFormat {
  investigator_code: string;
  name: string;
  description?: string;
  slots: Record<string, number>;
  ignoreDeckLimitSlots?: Record<string, number>;
  taboo_id?: number;
  tags?: string;
}

/**
 * Convert internal deck data to ArkhamDB API format
 */
export function formatForArkhamDB(deck: ArkhamDeckData): ArkhamDBDeckFormat {
  return {
    investigator_code: deck.investigator_code,
    name: deck.name,
    description: deck.description,
    slots: { ...deck.slots },
    ignoreDeckLimitSlots: deck.ignoreDeckLimitSlots,
    taboo_id: deck.taboo_id,
    tags: deck.tags,
  };
}

/**
 * Create a new deck on ArkhamDB
 */
export async function createDeck(
  investigatorCode: string,
  name: string,
  description?: string
): Promise<{ success: boolean; deckId?: number; error?: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, error: 'Not connected to ArkhamDB. Please connect first.' };
  }

  try {
    const response = await fetch(`${API_BASE}/deck/new`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        investigator_code: investigatorCode,
        name,
        ...(description && { description }),
      }),
    });

    const data: CreateDeckResponse = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.msg || 'Failed to create deck on ArkhamDB.',
      };
    }

    return { success: true, deckId: data.deck_id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create deck.',
    };
  }
}

/**
 * Save/update a deck on ArkhamDB
 */
export async function saveDeck(
  arkhamdbId: number,
  deck: ArkhamDeckData
): Promise<{ success: boolean; error?: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, error: 'Not connected to ArkhamDB. Please connect first.' };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('name', deck.name);
    if (deck.description) {
      // Convert tabbed JSON notes to flat HTML for ArkhamDB
      let flatDescription = deck.description;
      try {
        const obj = JSON.parse(deck.description);
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          const parts: string[] = [];
          if (obj.guide) parts.push(obj.guide);
          if (obj.strategy) parts.push('<hr>' + obj.strategy);
          if (obj.campaign) parts.push('<hr>' + obj.campaign);
          flatDescription = parts.join('\n');
        }
      } catch {
        // Not JSON, use as-is
      }
      formData.append('description', flatDescription);
    }
    formData.append('slots', JSON.stringify(deck.slots));
    if (deck.ignoreDeckLimitSlots && Object.keys(deck.ignoreDeckLimitSlots).length > 0) {
      formData.append('ignoreDeckLimitSlots', JSON.stringify(deck.ignoreDeckLimitSlots));
    }
    if (deck.taboo_id) {
      formData.append('taboo_id', deck.taboo_id.toString());
    }
    if (deck.tags) {
      formData.append('tags', deck.tags);
    }

    const response = await fetch(`${API_BASE}/deck/save/${arkhamdbId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const data: SaveDeckResponse = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.msg || 'Failed to save deck on ArkhamDB.',
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save deck.',
    };
  }
}

/**
 * Publish a deck on ArkhamDB to get a decklist ID for TTS
 */
export async function publishDeck(
  arkhamdbId: number
): Promise<{ success: boolean; decklistId?: number; error?: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, error: 'Not connected to ArkhamDB. Please connect first.' };
  }

  try {
    const response = await fetch(`${API_BASE}/deck/publish/${arkhamdbId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data: PublishDeckResponse = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.msg || 'Failed to publish deck. It may already be published.',
      };
    }

    return { success: true, decklistId: data.decklist_id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to publish deck.',
    };
  }
}

/**
 * Delete a deck from ArkhamDB
 */
export async function deleteDeck(
  arkhamdbId: number
): Promise<{ success: boolean; error?: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, error: 'Not connected to ArkhamDB. Please connect first.' };
  }

  try {
    const response = await fetch(`${API_BASE}/deck/${arkhamdbId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        success: false,
        error: data.msg || 'Failed to delete deck on ArkhamDB.',
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete deck.',
    };
  }
}

/**
 * Sync a deck to ArkhamDB (create if new, save if exists)
 * Returns the arkhamdb_id and optionally the URL
 */
export async function syncDeckToArkhamDB(
  deck: ArkhamDeckData
): Promise<{
  success: boolean;
  arkhamdbId?: number;
  arkhamdbUrl?: string;
  error?: string;
}> {
  // If deck already has an ArkhamDB ID, update it
  if (deck.arkhamdb_id) {
    const saveResult = await saveDeck(deck.arkhamdb_id, deck);
    if (!saveResult.success) {
      return saveResult;
    }
    return {
      success: true,
      arkhamdbId: deck.arkhamdb_id,
      arkhamdbUrl: `https://arkhamdb.com/deck/view/${deck.arkhamdb_id}`,
    };
  }

  // Create a new deck on ArkhamDB
  const createResult = await createDeck(
    deck.investigator_code,
    deck.name,
    deck.description
  );

  if (!createResult.success || !createResult.deckId) {
    return { success: false, error: createResult.error };
  }

  // Now save the card data
  const saveResult = await saveDeck(createResult.deckId, deck);
  if (!saveResult.success) {
    return saveResult;
  }

  return {
    success: true,
    arkhamdbId: createResult.deckId,
    arkhamdbUrl: `https://arkhamdb.com/deck/view/${createResult.deckId}`,
  };
}

/**
 * Generate URLs for a synced deck
 */
export function getArkhamDBUrls(arkhamdbId?: number, decklistId?: number): {
  deckUrl?: string;
  decklistUrl?: string;
} {
  return {
    deckUrl: arkhamdbId ? `https://arkhamdb.com/deck/view/${arkhamdbId}` : undefined,
    decklistUrl: decklistId ? `https://arkhamdb.com/decklist/view/${decklistId}` : undefined,
  };
}
