// Card Search Service - unified search across all game APIs
// Provides debounced search with game-specific backends

import type { Card } from '../types/card';
import { cardService } from './cardService';
import { mtgCardService } from './mtgCardService';
import { hearthstoneCardService } from './hearthstoneCardService';
import { pokemonCardService } from './pokemonCardService';

const YGOPRODECK_API = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';

// Rate limiting
let lastRequestTime: Record<string, number> = {};
const MIN_REQUEST_INTERVALS: Record<string, number> = {
  yugioh: 100,
  mtg: 100,
  pokemon: 200,
  hearthstone: 0, // Local search, no rate limit
};
const FETCH_TIMEOUT = 10000; // 10 second timeout

async function rateLimitedFetch(gameId: string, url: string, options?: RequestInit): Promise<Response> {
  const now = Date.now();
  const lastTime = lastRequestTime[gameId] || 0;
  const minInterval = MIN_REQUEST_INTERVALS[gameId] || 100;
  const timeSinceLastRequest = now - lastTime;

  if (timeSinceLastRequest < minInterval) {
    await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastRequest));
  }

  lastRequestTime[gameId] = Date.now();

  // Add timeout to fetch
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
}

const PAGE_SIZE = 50;

/**
 * Search Yu-Gi-Oh! cards using YGOProDeck API with pagination
 */
async function searchYuGiOhCards(query: string, offset = 0): Promise<{ cards: Card[]; hasMore: boolean }> {
  if (!query || query.length < 2) return { cards: [], hasMore: false };

  try {
    const response = await rateLimitedFetch(
      'yugioh',
      `${YGOPRODECK_API}?fname=${encodeURIComponent(query)}&num=${PAGE_SIZE}&offset=${offset}`
    );

    if (!response.ok) {
      if (response.status === 400) return { cards: [], hasMore: false }; // No results
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.data) return { cards: [], hasMore: false };

    const cards = data.data.map((card: Record<string, unknown>): Card => {
      // Extract image URL from card_images array or construct from ID
      const cardImages = card.card_images as Array<{ image_url_small?: string; image_url?: string }> | undefined;
      const imageUrl = cardImages?.[0]?.image_url_small
        || cardImages?.[0]?.image_url
        || `https://images.ygoprodeck.com/images/cards_small/${card.id}.jpg`;

      return {
        id: card.id as number,
        name: card.name as string,
        type: card.type as string,
        description: (card.desc as string) || '',
        imageUrl,
        attributes: {
          atk: card.atk,
          def: card.def,
          level: card.level,
          attribute: card.attribute,
          race: card.race,
          linkval: card.linkval,
          archetype: card.archetype,
        },
      };
    });

    // Check if there are more results
    const hasMore = cards.length === PAGE_SIZE;

    return { cards, hasMore };
  } catch (error) {
    console.error('YuGiOh search error:', error);
    return { cards: [], hasMore: false };
  }
}

// MTG search state for pagination
let mtgSearchNextPageUrl: string | null = null;

/**
 * Search MTG cards using Scryfall API with pagination
 */
async function searchMTGCards(query: string, loadMore = false): Promise<{ cards: Card[]; hasMore: boolean }> {
  if (!query || query.length < 2) return { cards: [], hasMore: false };

  try {
    let url: string;

    if (loadMore && mtgSearchNextPageUrl) {
      url = mtgSearchNextPageUrl;
    } else {
      // Use Scryfall search for better fuzzy matching
      url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=name`;
      mtgSearchNextPageUrl = null;
    }

    const response = await rateLimitedFetch('mtg', url);

    if (!response.ok) {
      if (response.status === 404) return { cards: [], hasMore: false }; // No results
      return { cards: [], hasMore: false };
    }

    const data = await response.json();

    // Store next page URL if available
    mtgSearchNextPageUrl = data.has_more ? data.next_page : null;

    const cards: Card[] = (data.data || []).map((card: Record<string, unknown>): Card => {
      // Get image URL
      const imageUris = card.image_uris as Record<string, string> | undefined;
      const cardFaces = card.card_faces as Array<{ image_uris?: Record<string, string> }> | undefined;
      const imageUrl = imageUris?.small
        || imageUris?.normal
        || cardFaces?.[0]?.image_uris?.small
        || cardFaces?.[0]?.image_uris?.normal
        || '';

      // Extract colors
      const colors = (card.colors as string[]) || [];
      const colorIdentity = (card.color_identity as string[]) || [];

      return {
        id: card.id as string,
        name: card.name as string,
        type: card.type_line as string || '',
        description: (card.oracle_text as string) || '',
        imageUrl,
        attributes: {
          cmc: card.cmc as number,
          colors,
          colorIdentity,
          manaCost: card.mana_cost as string,
          power: card.power as string,
          toughness: card.toughness as string,
          rarity: card.rarity as string,
          set: card.set as string,
        },
      };
    });

    return { cards, hasMore: !!mtgSearchNextPageUrl };
  } catch (error) {
    console.error('MTG search error:', error);
    return { cards: [], hasMore: false };
  }
}

/**
 * Search Hearthstone cards (uses hearthstoneCardService)
 */
async function searchHearthstoneCards(query: string): Promise<Card[]> {
  return hearthstoneCardService.searchByName(query);
}

/**
 * Search Pokemon cards (uses pokemonCardService)
 */
async function searchPokemonCards(query: string): Promise<Card[]> {
  return pokemonCardService.searchByName(query);
}

// Track pagination state per game
const paginationState: Record<string, { query: string; offset: number; hasMore: boolean }> = {};

/**
 * Main card search service
 */
export const cardSearchService = {
  /**
   * Search cards for a specific game
   */
  async search(gameId: string, query: string, loadMore = false): Promise<{ cards: Card[]; hasMore: boolean }> {
    // Reset pagination if new query
    if (!loadMore || paginationState[gameId]?.query !== query) {
      paginationState[gameId] = { query, offset: 0, hasMore: false };
    }

    switch (gameId) {
      case 'yugioh': {
        const result = await searchYuGiOhCards(query, paginationState[gameId].offset);
        if (result.cards.length > 0) {
          paginationState[gameId].offset += result.cards.length;
        }
        paginationState[gameId].hasMore = result.hasMore;
        return result;
      }
      case 'mtg': {
        const result = await searchMTGCards(query, loadMore);
        paginationState[gameId].hasMore = result.hasMore;
        return result;
      }
      case 'hearthstone': {
        const cards = await searchHearthstoneCards(query);
        return { cards, hasMore: false };
      }
      case 'pokemon': {
        const cards = await searchPokemonCards(query);
        return { cards, hasMore: false };
      }
      default:
        console.warn(`Unknown game: ${gameId}`);
        return { cards: [], hasMore: false };
    }
  },

  /**
   * Check if there are more results to load
   */
  hasMoreResults(gameId: string): boolean {
    return paginationState[gameId]?.hasMore ?? false;
  },

  /**
   * Reset pagination state for a game
   */
  resetPagination(gameId: string): void {
    delete paginationState[gameId];
    if (gameId === 'mtg') {
      mtgSearchNextPageUrl = null;
    }
  },

  /**
   * Preload cards for games that support bulk loading
   */
  async preload(gameId: string): Promise<void> {
    if (gameId === 'hearthstone') {
      await hearthstoneCardService.loadAllCards();
    }
  },

  /**
   * Check if a game uses bulk loading (local search)
   */
  usesBulkLoading(gameId: string): boolean {
    return gameId === 'hearthstone';
  },

  /**
   * Get loading status for bulk-loading games
   */
  isLoaded(gameId: string): boolean {
    if (gameId === 'hearthstone') {
      return hearthstoneCardService.isLoaded();
    }
    return true;
  },

  /**
   * Clear caches
   */
  clearCache(): void {
    cardService.clearCache();
    mtgCardService.clearCache();
    hearthstoneCardService.clearCache();
    pokemonCardService.clearCache();
  },
};
