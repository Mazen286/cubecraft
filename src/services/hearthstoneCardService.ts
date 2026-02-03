// Hearthstone Card Service - fetches card data from HearthstoneJSON
// API: https://hearthstonejson.com/

import type { Card } from '../types/card';

const HEARTHSTONE_JSON_URL = 'https://api.hearthstonejson.com/v1/latest/enUS/cards.json';

export interface HearthstoneCardAttributes {
  cost?: number;
  attack?: number;
  health?: number;
  durability?: number;
  armor?: number;
  rarity?: string;
  cardClass?: string;
  set?: string;
  mechanics?: string[];
  race?: string;
  spellSchool?: string;
  dbfId?: number;
  cardId?: string;
}

interface HearthstoneRawCard {
  id: string;
  dbfId: number;
  name: string;
  type: string;
  text?: string;
  cost?: number;
  attack?: number;
  health?: number;
  durability?: number;
  armor?: number;
  rarity?: string;
  cardClass?: string;
  set?: string;
  mechanics?: string[];
  race?: string;
  spellSchool?: string;
  collectible?: boolean;
}

// Cache for all Hearthstone cards
let allCardsCache: Card[] | null = null;
let loadingPromise: Promise<Card[]> | null = null;

// Cache for individual cards by dbfId
const cardCache: Map<number, Card> = new Map();

/**
 * Convert raw Hearthstone card to our Card format
 */
function hearthstoneToCard(raw: HearthstoneRawCard): Card {
  const attributes: HearthstoneCardAttributes = {
    cost: raw.cost,
    attack: raw.attack,
    health: raw.health,
    durability: raw.durability,
    armor: raw.armor,
    rarity: raw.rarity,
    cardClass: raw.cardClass,
    set: raw.set,
    mechanics: raw.mechanics,
    race: raw.race,
    spellSchool: raw.spellSchool,
    dbfId: raw.dbfId,
    cardId: raw.id,
  };

  return {
    id: raw.dbfId,
    name: raw.name,
    type: raw.type,
    description: raw.text || '',
    imageUrl: `https://art.hearthstonejson.com/v1/render/latest/enUS/256x/${raw.id}.png`,
    attributes: attributes as Record<string, unknown>,
  };
}

export const hearthstoneCardService = {
  /**
   * Load all collectible Hearthstone cards
   * Uses bulk fetch since HearthstoneJSON provides all cards in one request
   */
  async loadAllCards(): Promise<Card[]> {
    // Return cached if available
    if (allCardsCache) {
      return allCardsCache;
    }

    // Return existing promise if loading
    if (loadingPromise) {
      return loadingPromise;
    }

    loadingPromise = (async () => {
      try {
        const response = await fetch(HEARTHSTONE_JSON_URL);
        if (!response.ok) {
          throw new Error(`Failed to fetch Hearthstone cards: ${response.status}`);
        }

        const data: HearthstoneRawCard[] = await response.json();

        // Filter to only collectible cards and exclude enchantments, hero powers
        const collectibleCards = data.filter(card =>
          card.collectible === true &&
          card.type !== 'ENCHANTMENT' &&
          card.type !== 'HERO_POWER'
        );

        // Convert to our card format
        const cards = collectibleCards.map(hearthstoneToCard);

        // Cache individual cards
        for (const card of cards) {
          cardCache.set(card.id as number, card);
        }

        allCardsCache = cards;
        return cards;
      } catch (error) {
        loadingPromise = null;
        throw error;
      }
    })();

    return loadingPromise;
  },

  /**
   * Get a single card by dbfId
   */
  async getCard(dbfId: number): Promise<Card | null> {
    // Check cache first
    if (cardCache.has(dbfId)) {
      return cardCache.get(dbfId)!;
    }

    // Load all cards if not cached
    await this.loadAllCards();
    return cardCache.get(dbfId) || null;
  },

  /**
   * Search cards by name (local filter on cached data)
   */
  async searchByName(query: string): Promise<Card[]> {
    const cards = await this.loadAllCards();
    if (!query || query.length < 2) return [];

    const lowerQuery = query.toLowerCase();
    return cards.filter(card =>
      card.name.toLowerCase().includes(lowerQuery)
    ).slice(0, 50);
  },

  /**
   * Get cards by class
   */
  async getCardsByClass(cardClass: string): Promise<Card[]> {
    const cards = await this.loadAllCards();
    return cards.filter(card => {
      const attrs = card.attributes as HearthstoneCardAttributes;
      return attrs.cardClass?.toUpperCase() === cardClass.toUpperCase();
    });
  },

  /**
   * Get cards by rarity
   */
  async getCardsByRarity(rarity: string): Promise<Card[]> {
    const cards = await this.loadAllCards();
    return cards.filter(card => {
      const attrs = card.attributes as HearthstoneCardAttributes;
      return attrs.rarity?.toUpperCase() === rarity.toUpperCase();
    });
  },

  /**
   * Get cards by cost
   */
  async getCardsByCost(cost: number): Promise<Card[]> {
    const cards = await this.loadAllCards();
    return cards.filter(card => {
      const attrs = card.attributes as HearthstoneCardAttributes;
      return attrs.cost === cost;
    });
  },

  /**
   * Check if cards are loaded
   */
  isLoaded(): boolean {
    return allCardsCache !== null;
  },

  /**
   * Check if a card is cached
   */
  isCardCached(dbfId: number): boolean {
    return cardCache.has(dbfId);
  },

  /**
   * Get a card from cache (sync)
   */
  getCachedCard(dbfId: number): Card | null {
    return cardCache.get(dbfId) || null;
  },

  /**
   * Clear the cache
   */
  clearCache(): void {
    allCardsCache = null;
    loadingPromise = null;
    cardCache.clear();
  },
};
