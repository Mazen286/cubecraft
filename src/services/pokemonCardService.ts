// Pokemon Card Service - fetches card data from Pokemon TCG API
// API: https://pokemontcg.io/

import type { Card } from '../types/card';

const POKEMON_API = 'https://api.pokemontcg.io/v2/cards';

export interface PokemonCardAttributes {
  hp?: number;
  types?: string[];
  subtypes?: string[];
  evolvesFrom?: string;
  evolvesTo?: string[];
  abilities?: Array<{
    name: string;
    text: string;
    type: string;
  }>;
  attacks?: Array<{
    name: string;
    cost: string[];
    damage: string;
    text: string;
  }>;
  weaknesses?: Array<{
    type: string;
    value: string;
  }>;
  resistances?: Array<{
    type: string;
    value: string;
  }>;
  retreatCost?: string[];
  rarity?: string;
  set?: {
    id: string;
    name: string;
    series: string;
  };
  number?: string;
  regulationMark?: string;
  pokemonTcgId?: string;
}

interface PokemonRawCard {
  id: string;
  name: string;
  supertype: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  evolvesFrom?: string;
  evolvesTo?: string[];
  abilities?: Array<{
    name: string;
    text: string;
    type: string;
  }>;
  attacks?: Array<{
    name: string;
    cost: string[];
    damage: string;
    text: string;
  }>;
  weaknesses?: Array<{
    type: string;
    value: string;
  }>;
  resistances?: Array<{
    type: string;
    value: string;
  }>;
  retreatCost?: string[];
  rarity?: string;
  set: {
    id: string;
    name: string;
    series: string;
  };
  number: string;
  regulationMark?: string;
  images: {
    small: string;
    large: string;
  };
}

interface PokemonApiResponse {
  data: PokemonRawCard[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
}

// Cache for fetched cards
const cardCache: Map<string, Card> = new Map();

// Rate limiting - Pokemon TCG API recommends 100ms between requests
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 200;
const FETCH_TIMEOUT = 10000; // 10 second timeout

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }

  lastRequestTime = Date.now();

  // Add timeout to fetch
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Convert raw Pokemon card to our Card format
 */
function pokemonToCard(raw: PokemonRawCard): Card {
  const attributes: PokemonCardAttributes = {
    hp: raw.hp ? parseInt(raw.hp, 10) : undefined,
    types: raw.types,
    subtypes: raw.subtypes,
    evolvesFrom: raw.evolvesFrom,
    evolvesTo: raw.evolvesTo,
    abilities: raw.abilities,
    attacks: raw.attacks,
    weaknesses: raw.weaknesses,
    resistances: raw.resistances,
    retreatCost: raw.retreatCost,
    rarity: raw.rarity,
    set: raw.set,
    number: raw.number,
    regulationMark: raw.regulationMark,
    pokemonTcgId: raw.id,
  };

  return {
    id: raw.id,
    name: raw.name,
    type: raw.supertype,
    description: raw.abilities?.[0]?.text || raw.attacks?.[0]?.text || '',
    imageUrl: raw.images.small,
    attributes: attributes as Record<string, unknown>,
  };
}

export const pokemonCardService = {
  /**
   * Fetch a single card by ID
   */
  async getCard(cardId: string): Promise<Card | null> {
    // Check cache first
    const cacheKey = cardId.toLowerCase();
    if (cardCache.has(cacheKey)) {
      return cardCache.get(cacheKey)!;
    }

    try {
      const response = await rateLimitedFetch(`${POKEMON_API}/${cardId}`);
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const card = pokemonToCard(data.data);
      cardCache.set(cacheKey, card);
      return card;
    } catch {
      return null;
    }
  },

  /**
   * Search cards by name
   */
  async searchByName(query: string): Promise<Card[]> {
    if (!query || query.length < 2) return [];

    try {
      // Use wildcard search for better matching
      const searchUrl = `${POKEMON_API}?q=name:"${encodeURIComponent(query)}*"&pageSize=50&orderBy=name`;
      console.log('[Pokemon] Searching:', searchUrl);

      const response = await rateLimitedFetch(searchUrl);

      if (!response.ok) {
        console.error('[Pokemon] API error:', response.status, response.statusText);
        // Try alternative search format if first fails
        const altUrl = `${POKEMON_API}?q=name:*${encodeURIComponent(query)}*&pageSize=50`;
        console.log('[Pokemon] Retrying with:', altUrl);
        const altResponse = await rateLimitedFetch(altUrl);
        if (!altResponse.ok) {
          return [];
        }
        const altData: PokemonApiResponse = await altResponse.json();
        if (!altData.data) return [];
        const cards = altData.data.map(pokemonToCard);
        for (const card of cards) {
          cardCache.set(String(card.id).toLowerCase(), card);
        }
        return cards;
      }

      const data: PokemonApiResponse = await response.json();
      console.log('[Pokemon] Results:', data.count, 'cards');
      if (!data.data) return [];

      const cards = data.data.map(pokemonToCard);

      // Cache all fetched cards
      for (const card of cards) {
        cardCache.set(String(card.id).toLowerCase(), card);
      }

      return cards;
    } catch (error) {
      console.error('[Pokemon] Search error:', error);
      return [];
    }
  },

  /**
   * Search cards by set
   */
  async searchBySet(setId: string, page = 1, pageSize = 50): Promise<{ cards: Card[]; totalCount: number }> {
    try {
      const response = await rateLimitedFetch(
        `${POKEMON_API}?q=set.id:${encodeURIComponent(setId)}&page=${page}&pageSize=${pageSize}`
      );

      if (!response.ok) {
        return { cards: [], totalCount: 0 };
      }

      const data: PokemonApiResponse = await response.json();
      if (!data.data) return { cards: [], totalCount: 0 };

      const cards = data.data.map(pokemonToCard);

      // Cache all fetched cards
      for (const card of cards) {
        cardCache.set(String(card.id).toLowerCase(), card);
      }

      return { cards, totalCount: data.totalCount };
    } catch (error) {
      console.error('Pokemon set search error:', error);
      return { cards: [], totalCount: 0 };
    }
  },

  /**
   * Search cards by type
   */
  async searchByType(type: string): Promise<Card[]> {
    try {
      const response = await rateLimitedFetch(
        `${POKEMON_API}?q=types:${encodeURIComponent(type)}&pageSize=50`
      );

      if (!response.ok) {
        return [];
      }

      const data: PokemonApiResponse = await response.json();
      if (!data.data) return [];

      const cards = data.data.map(pokemonToCard);

      // Cache all fetched cards
      for (const card of cards) {
        cardCache.set(String(card.id).toLowerCase(), card);
      }

      return cards;
    } catch (error) {
      console.error('Pokemon type search error:', error);
      return [];
    }
  },

  /**
   * Get multiple cards by IDs
   */
  async getCardsByIds(cardIds: string[]): Promise<{ cards: Card[]; notFound: string[] }> {
    if (cardIds.length === 0) return { cards: [], notFound: [] };

    const cards: Card[] = [];
    const notFound: string[] = [];

    // Check cache first
    const uncachedIds: string[] = [];
    for (const id of cardIds) {
      const cached = cardCache.get(id.toLowerCase());
      if (cached) {
        cards.push(cached);
      } else {
        uncachedIds.push(id);
      }
    }

    // Fetch uncached cards
    for (const id of uncachedIds) {
      const card = await this.getCard(id);
      if (card) {
        cards.push(card);
      } else {
        notFound.push(id);
      }
    }

    return { cards, notFound };
  },

  /**
   * Check if a card is cached
   */
  isCardCached(cardId: string): boolean {
    return cardCache.has(cardId.toLowerCase());
  },

  /**
   * Get a card from cache (sync)
   */
  getCachedCard(cardId: string): Card | null {
    return cardCache.get(cardId.toLowerCase()) || null;
  },

  /**
   * Clear the cache
   */
  clearCache(): void {
    cardCache.clear();
  },
};
