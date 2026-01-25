// Card Service - fetches card data from YGOProDeck API
// API: https://db.ygoprodeck.com/api/v7/cardinfo.php

import type { YuGiOhCard, YGOProDeckResponse } from '../types';

const YGOPRODECK_API = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';

// Cache for fetched cards
const cardCache: Map<number, YuGiOhCard> = new Map();

// Track in-flight requests to avoid duplicate fetches
const pendingRequests: Map<string, Promise<YuGiOhCard[]>> = new Map();

export const cardService = {
  /**
   * Fetch a single card by ID
   */
  async getCard(cardId: number): Promise<YuGiOhCard | null> {
    // Check cache first
    if (cardCache.has(cardId)) {
      return cardCache.get(cardId)!;
    }

    try {
      const response = await fetch(`${YGOPRODECK_API}?id=${cardId}`);
      if (!response.ok) {
        return null;
      }

      const data: YGOProDeckResponse = await response.json();
      if (data.data && data.data.length > 0) {
        const card = data.data[0];
        cardCache.set(cardId, card);
        return card;
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Fetch multiple cards by IDs
   * Uses batch API to minimize requests
   */
  async getCards(cardIds: number[]): Promise<YuGiOhCard[]> {
    if (cardIds.length === 0) return [];

    // Separate cached and uncached IDs
    const cachedCards: YuGiOhCard[] = [];
    const uncachedIds: number[] = [];

    for (const id of cardIds) {
      if (cardCache.has(id)) {
        cachedCards.push(cardCache.get(id)!);
      } else {
        uncachedIds.push(id);
      }
    }

    // If all cached, return immediately
    if (uncachedIds.length === 0) {
      // Return in original order
      return cardIds.map(id => cardCache.get(id)!).filter(Boolean);
    }

    // Create a request key for deduplication
    const requestKey = uncachedIds.sort().join(',');

    // Check if there's already a pending request for these cards
    if (pendingRequests.has(requestKey)) {
      await pendingRequests.get(requestKey);
      // Now all should be cached
      return cardIds.map(id => cardCache.get(id)!).filter(Boolean);
    }

    // Fetch uncached cards in batches (API allows multiple IDs)
    const fetchPromise = this.fetchCardBatch(uncachedIds);
    pendingRequests.set(requestKey, fetchPromise);

    try {
      await fetchPromise;
    } finally {
      pendingRequests.delete(requestKey);
    }

    // Return in original order
    return cardIds.map(id => cardCache.get(id)!).filter(Boolean);
  },

  /**
   * Fetch a batch of cards from the API
   */
  async fetchCardBatch(cardIds: number[]): Promise<YuGiOhCard[]> {
    if (cardIds.length === 0) return [];

    // YGOProDeck API accepts comma-separated IDs
    const idsParam = cardIds.join(',');

    try {
      const response = await fetch(`${YGOPRODECK_API}?id=${idsParam}`);
      if (!response.ok) {
        return [];
      }

      const data: YGOProDeckResponse = await response.json();
      if (data.data) {
        // Cache all fetched cards
        for (const card of data.data) {
          cardCache.set(card.id, card);
        }
        return data.data;
      }
      return [];
    } catch {
      return [];
    }
  },

  /**
   * Check if a card is cached
   */
  isCardCached(cardId: number): boolean {
    return cardCache.has(cardId);
  },

  /**
   * Get a card from cache (sync)
   */
  getCachedCard(cardId: number): YuGiOhCard | null {
    return cardCache.get(cardId) || null;
  },

  /**
   * Clear the cache
   */
  clearCache(): void {
    cardCache.clear();
  },

  /**
   * Preload cards for a cube (useful for warming cache)
   */
  async preloadCards(cardIds: number[]): Promise<void> {
    // Batch into chunks of 50 to avoid URL length limits
    const chunkSize = 50;
    for (let i = 0; i < cardIds.length; i += chunkSize) {
      const chunk = cardIds.slice(i, i + chunkSize);
      await this.getCards(chunk);
    }
  },
};
