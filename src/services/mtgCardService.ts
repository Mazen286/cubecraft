// MTG Card Service - fetches card data from Scryfall API
// API: https://api.scryfall.com

import type { Card } from '../types/card';
import type { MTGCardAttributes } from '../config/games/mtg';

const SCRYFALL_API = 'https://api.scryfall.com';

interface ScryfallCard {
  id: string;
  name: string;
  type_line: string;
  oracle_text?: string;
  mana_cost?: string;
  cmc?: number;
  colors?: string[];
  color_identity?: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  rarity?: string;
  set?: string;
  collector_number?: string;
  image_uris?: {
    small?: string;
    normal?: string;
    large?: string;
  };
  card_faces?: Array<{
    image_uris?: {
      small?: string;
      normal?: string;
      large?: string;
    };
  }>;
}

interface ScryfallCollectionResponse {
  data: ScryfallCard[];
  not_found: Array<{ id?: string; name?: string }>;
}

// Cache for fetched cards
const cardCache: Map<string, Card> = new Map();

// Rate limiting - Scryfall asks for 50-100ms between requests
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100;

async function rateLimitedFetch(url: string, options?: RequestInit): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }

  lastRequestTime = Date.now();
  return fetch(url, options);
}

/**
 * Convert Scryfall card to our Card format
 */
function scryfallToCard(sc: ScryfallCard, userScore?: number): Card {
  // Get image URL (handle double-faced cards)
  let imageUrl = sc.image_uris?.normal;
  if (!imageUrl && sc.card_faces?.[0]?.image_uris?.normal) {
    imageUrl = sc.card_faces[0].image_uris.normal;
  }

  const attributes: MTGCardAttributes = {
    manaCost: sc.mana_cost,
    cmc: sc.cmc,
    colors: sc.colors,
    colorIdentity: sc.color_identity,
    power: sc.power,
    toughness: sc.toughness,
    loyalty: sc.loyalty ? parseInt(sc.loyalty, 10) : undefined,
    rarity: sc.rarity,
    setCode: sc.set,
    collectorNumber: sc.collector_number,
    scryfallId: sc.id,
  };

  return {
    id: sc.id, // Use Scryfall ID as card ID
    name: sc.name,
    type: sc.type_line,
    description: sc.oracle_text || '',
    score: userScore,
    imageUrl,
    attributes: attributes as Record<string, unknown>,
  };
}

export const mtgCardService = {
  /**
   * Fetch a single card by Scryfall ID
   */
  async getCard(scryfallId: string): Promise<Card | null> {
    const cacheKey = scryfallId.toLowerCase();
    if (cardCache.has(cacheKey)) {
      return cardCache.get(cacheKey)!;
    }

    try {
      const response = await rateLimitedFetch(`${SCRYFALL_API}/cards/${scryfallId}`);
      if (!response.ok) {
        return null;
      }

      const data: ScryfallCard = await response.json();
      const card = scryfallToCard(data);
      cardCache.set(cacheKey, card);
      return card;
    } catch {
      return null;
    }
  },

  /**
   * Fetch a card by exact name
   */
  async getCardByName(name: string): Promise<Card | null> {
    const cacheKey = `name:${name.toLowerCase()}`;
    if (cardCache.has(cacheKey)) {
      return cardCache.get(cacheKey)!;
    }

    try {
      const response = await rateLimitedFetch(
        `${SCRYFALL_API}/cards/named?exact=${encodeURIComponent(name)}`
      );
      if (!response.ok) {
        // Try fuzzy search
        const fuzzyResponse = await rateLimitedFetch(
          `${SCRYFALL_API}/cards/named?fuzzy=${encodeURIComponent(name)}`
        );
        if (!fuzzyResponse.ok) {
          return null;
        }
        const data: ScryfallCard = await fuzzyResponse.json();
        const card = scryfallToCard(data);
        cardCache.set(cacheKey, card);
        cardCache.set(data.id.toLowerCase(), card);
        return card;
      }

      const data: ScryfallCard = await response.json();
      const card = scryfallToCard(data);
      cardCache.set(cacheKey, card);
      cardCache.set(data.id.toLowerCase(), card);
      return card;
    } catch {
      return null;
    }
  },

  /**
   * Normalize card name for Scryfall lookup
   * Split cards like "Life // Death" need to be searched as just "Life"
   */
  normalizeCardName(name: string): string {
    // For split cards (Life // Death), use just the first half
    if (name.includes(' // ')) {
      return name.split(' // ')[0].trim();
    }
    return name;
  },

  /**
   * Fetch multiple cards by name using Scryfall collection endpoint
   * More efficient than individual requests
   */
  async getCardsByNames(names: string[]): Promise<{ cards: Card[]; notFound: string[] }> {
    if (names.length === 0) return { cards: [], notFound: [] };

    const cards: Card[] = [];
    const notFound: string[] = [];
    const uncachedNames: string[] = [];

    // Check cache first (try both original and normalized names)
    for (const name of names) {
      const cacheKey = `name:${name.toLowerCase()}`;
      const normalizedKey = `name:${this.normalizeCardName(name).toLowerCase()}`;
      if (cardCache.has(cacheKey)) {
        cards.push(cardCache.get(cacheKey)!);
      } else if (cardCache.has(normalizedKey)) {
        cards.push(cardCache.get(normalizedKey)!);
      } else {
        uncachedNames.push(name);
      }
    }

    if (uncachedNames.length === 0) {
      return { cards, notFound };
    }

    // Use Scryfall collection endpoint (max 75 cards per request)
    const batchSize = 75;
    for (let i = 0; i < uncachedNames.length; i += batchSize) {
      const batch = uncachedNames.slice(i, i + batchSize);

      try {
        // Normalize names for Scryfall (handles split cards)
        const identifiers = batch.map(name => ({ name: this.normalizeCardName(name) }));
        const response = await rateLimitedFetch(`${SCRYFALL_API}/cards/collection`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifiers }),
        });

        if (!response.ok) {
          // Fallback to individual requests
          for (const name of batch) {
            const card = await this.getCardByName(name);
            if (card) {
              cards.push(card);
            } else {
              notFound.push(name);
            }
          }
          continue;
        }

        const data: ScryfallCollectionResponse = await response.json();

        // Process found cards
        for (const sc of data.data) {
          const card = scryfallToCard(sc);
          // Cache by full name (e.g., "Life // Death")
          cardCache.set(`name:${sc.name.toLowerCase()}`, card);
          // Cache by Scryfall ID
          cardCache.set(sc.id.toLowerCase(), card);
          // For DFCs and split cards, also cache by front face name
          if (sc.name.includes(' // ')) {
            const frontName = sc.name.split(' // ')[0].trim().toLowerCase();
            cardCache.set(`name:${frontName}`, card);
          }
          cards.push(card);
        }

        // Track not found
        for (const nf of data.not_found) {
          if (nf.name) {
            notFound.push(nf.name);
          }
        }
      } catch (error) {
        console.error('Failed to fetch MTG card batch:', error);
        // Add all batch names to notFound on error
        notFound.push(...batch);
      }
    }

    return { cards, notFound };
  },

  /**
   * Check if a card is cached
   */
  isCardCached(identifier: string): boolean {
    return cardCache.has(identifier.toLowerCase()) || cardCache.has(`name:${identifier.toLowerCase()}`);
  },

  /**
   * Get a card from cache (sync)
   */
  getCachedCard(identifier: string): Card | null {
    return cardCache.get(identifier.toLowerCase()) ||
           cardCache.get(`name:${identifier.toLowerCase()}`) ||
           null;
  },

  /**
   * Clear the cache
   */
  clearCache(): void {
    cardCache.clear();
  },
};
