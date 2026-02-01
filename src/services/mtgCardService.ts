// MTG Card Service - fetches card data from Scryfall API
// API: https://api.scryfall.com

import type { Card } from '../types/card';
import type { MTGCardAttributes } from '../config/games/mtg';

const SCRYFALL_API = 'https://api.scryfall.com';

interface ScryfallCardFace {
  name?: string;
  printed_name?: string;
  oracle_text?: string;
  mana_cost?: string;
  image_uris?: {
    small?: string;
    normal?: string;
    large?: string;
  };
}

interface ScryfallCard {
  id: string;
  name: string;
  printed_name?: string;  // Alternate/printed name (e.g., Marvel crossover cards)
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
  card_faces?: ScryfallCardFace[];
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
  const frontFace = sc.card_faces?.[0];

  // Get image URL (handle double-faced cards)
  let imageUrl = sc.image_uris?.normal;
  if (!imageUrl && frontFace?.image_uris?.normal) {
    imageUrl = frontFace.image_uris.normal;
  }

  // Get oracle text (DFCs have it in card_faces, not top level)
  let oracleText = sc.oracle_text;
  if (!oracleText && frontFace?.oracle_text) {
    oracleText = frontFace.oracle_text;
  }

  // Use printed name if available (for Marvel crossover cards)
  // This shows "Nia, Skysail Storyteller" instead of "Gwen Stacy // Ghost-Spider"
  const displayName = sc.printed_name
    || frontFace?.printed_name
    || sc.name;

  const attributes: MTGCardAttributes = {
    manaCost: sc.mana_cost || frontFace?.mana_cost,
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
    // Store actual Scryfall name for lookups if different from display name
    scryfallName: displayName !== sc.name ? sc.name : undefined,
  };

  return {
    id: sc.id, // Use Scryfall ID as card ID
    name: displayName,
    type: sc.type_line,
    description: oracleText || '',
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
   * Cache a card by all possible lookup keys
   */
  cacheCard(card: Card, scryfallData: ScryfallCard, originalLookupName?: string): void {
    const frontFace = scryfallData.card_faces?.[0];

    // Cache by Scryfall ID
    cardCache.set(scryfallData.id.toLowerCase(), card);
    // Cache by full name
    cardCache.set(`name:${scryfallData.name.toLowerCase()}`, card);
    // For DFCs and split cards, also cache by front face name
    if (scryfallData.name.includes(' // ')) {
      const frontName = scryfallData.name.split(' // ')[0].trim().toLowerCase();
      cardCache.set(`name:${frontName}`, card);
    }
    // Cache by printed name if different (e.g., Marvel crossover cards)
    // Check both top-level and card_faces[0] for DFCs
    const printedName = scryfallData.printed_name || frontFace?.printed_name;
    if (printedName && printedName.toLowerCase() !== scryfallData.name.toLowerCase()) {
      cardCache.set(`name:${printedName.toLowerCase()}`, card);
    }
    // Cache by original lookup name if provided
    if (originalLookupName) {
      cardCache.set(`name:${originalLookupName.toLowerCase()}`, card);
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
        // Try fuzzy search (handles alternate/printed names like Marvel crossover)
        const fuzzyResponse = await rateLimitedFetch(
          `${SCRYFALL_API}/cards/named?fuzzy=${encodeURIComponent(name)}`
        );
        if (!fuzzyResponse.ok) {
          return null;
        }
        const data: ScryfallCard = await fuzzyResponse.json();
        const card = scryfallToCard(data);
        this.cacheCard(card, data, name);
        return card;
      }

      const data: ScryfallCard = await response.json();
      const card = scryfallToCard(data);
      this.cacheCard(card, data, name);
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
          this.cacheCard(card, sc);
          cards.push(card);
        }

        // Fuzzy search fallback for not-found cards (handles alternate/printed names)
        for (const nf of data.not_found) {
          if (nf.name) {
            const card = await this.getCardByName(nf.name);
            if (card) {
              cards.push(card);
            } else {
              notFound.push(nf.name);
            }
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
