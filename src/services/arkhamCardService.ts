/**
 * ArkhamDB API Service
 * Fetches and caches card data from ArkhamDB public API
 */

import type {
  ArkhamCard,
  Investigator,
  ArkhamPack,
  ArkhamFaction,
  ArkhamCardType,
} from '../types/arkham';
import type { Card } from '../types/card';

const API_BASE = 'https://arkhamdb.com/api/public';
const CACHE_KEY = 'arkham_cards_cache';
const CACHE_VERSION = 'v4'; // Bumped to include exceptional/myriad boolean fields
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

interface CacheData {
  version: string;
  timestamp: number;
  cards: ArkhamCard[];
  packs: ArkhamPack[];
}

// In-memory cache
let cardsCache: ArkhamCard[] | null = null;
let packsCache: ArkhamPack[] | null = null;
let investigatorsCache: Investigator[] | null = null;

/**
 * Get image URL for an Arkham card
 * Uses the card's imagesrc if available, otherwise constructs from code
 */
export function getArkhamCardImageUrl(code: string, imagesrc?: string): string {
  // If card has imagesrc from API, use it (prepend domain if relative path)
  if (imagesrc) {
    if (imagesrc.startsWith('http')) {
      return imagesrc;
    }
    return `https://arkhamdb.com${imagesrc}`;
  }
  // Fallback to constructed URL - newer cards without imagesrc use .jpg
  return `https://arkhamdb.com/bundles/cards/${code}.jpg`;
}

/**
 * Get image URL from a card object (uses imagesrc when available)
 */
export function getCardImageUrl(card: ArkhamCard): string {
  return getArkhamCardImageUrl(card.code, card.imagesrc);
}

/**
 * Convert ArkhamDB card to generic Card type
 */
export function toCard(arkhamCard: ArkhamCard): Card {
  const attributes: Record<string, unknown> = {
    code: arkhamCard.code,
    faction_code: arkhamCard.faction_code,
    faction2_code: arkhamCard.faction2_code,
    type_code: arkhamCard.type_code,
    cost: arkhamCard.cost,
    xp: arkhamCard.xp,
    slot: arkhamCard.slot,
    traits: arkhamCard.traits,
    skill_willpower: arkhamCard.skill_willpower,
    skill_intellect: arkhamCard.skill_intellect,
    skill_combat: arkhamCard.skill_combat,
    skill_agility: arkhamCard.skill_agility,
    skill_wild: arkhamCard.skill_wild,
    health: arkhamCard.health,
    sanity: arkhamCard.sanity,
    is_unique: arkhamCard.is_unique,
    permanent: arkhamCard.permanent,
    deck_limit: arkhamCard.deck_limit,
    restrictions: arkhamCard.restrictions,
    pack_code: arkhamCard.pack_code,
    bonded_to: arkhamCard.bonded_to,
    hidden: arkhamCard.hidden,
    subname: arkhamCard.subname,
  };

  return {
    id: arkhamCard.code,
    name: arkhamCard.subname ? `${arkhamCard.name}: ${arkhamCard.subname}` : arkhamCard.name,
    type: arkhamCard.type_name || arkhamCard.type_code,
    description: arkhamCard.text || '',
    imageUrl: getArkhamCardImageUrl(arkhamCard.code),
    attributes,
  };
}

/**
 * Load cards from localStorage cache
 */
function loadFromCache(): CacheData | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const data = JSON.parse(cached) as CacheData;

    // Check version and expiry
    if (data.version !== CACHE_VERSION) return null;
    if (Date.now() - data.timestamp > CACHE_EXPIRY) return null;

    return data;
  } catch {
    return null;
  }
}

/**
 * Save cards to localStorage cache
 */
function saveToCache(cards: ArkhamCard[], packs: ArkhamPack[]): void {
  try {
    const data: CacheData = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      cards,
      packs,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to cache Arkham cards:', e);
  }
}

/**
 * Fetch all cards from ArkhamDB API (including encounter/story cards)
 */
async function fetchAllCards(): Promise<ArkhamCard[]> {
  // Use encounter=1 to include encounter cards (story assets, weaknesses, etc.)
  const response = await fetch(`${API_BASE}/cards/?encounter=1`);
  if (!response.ok) {
    throw new Error(`Failed to fetch cards: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch all packs from ArkhamDB API
 */
async function fetchAllPacks(): Promise<ArkhamPack[]> {
  const response = await fetch(`${API_BASE}/packs/`);
  if (!response.ok) {
    throw new Error(`Failed to fetch packs: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Initialize the card service - loads from cache or fetches from API
 */
async function initialize(): Promise<void> {
  // Check in-memory cache first
  if (cardsCache && packsCache) return;

  // Try localStorage cache
  const cached = loadFromCache();
  if (cached) {
    cardsCache = cached.cards;
    packsCache = cached.packs;
    investigatorsCache = null; // Will be derived from cards
    return;
  }

  // Fetch from API
  const [cards, packs] = await Promise.all([fetchAllCards(), fetchAllPacks()]);

  cardsCache = cards;
  packsCache = packs;
  investigatorsCache = null;

  // Cache for later
  saveToCache(cards, packs);
}

/**
 * Get all player cards (excluding encounter cards), deduplicated by name+xp
 */
function getPlayerCards(): ArkhamCard[] {
  if (!cardsCache) return [];

  // First filter to player cards only
  const playerCards = cardsCache.filter(card => {
    // Exclude encounter cards
    if (card.encounter_code) return false;

    // Exclude hidden cards
    if (card.hidden) return false;

    // Only include player card types
    const playerTypes: ArkhamCardType[] = ['asset', 'event', 'skill'];
    return playerTypes.includes(card.type_code);
  });

  // Deduplicate by name + XP level (keep earliest release = lowest code)
  // This handles reprints like Core Set vs Revised Core Set
  const seen = new Map<string, ArkhamCard>();

  for (const card of playerCards) {
    const key = `${card.name}|${card.xp ?? 0}`;

    if (!seen.has(key)) {
      seen.set(key, card);
    } else {
      // Keep the one with the lower code (earlier release)
      const existing = seen.get(key)!;
      if (card.code < existing.code) {
        seen.set(key, card);
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * Get ALL cards that can be added to decks (including story assets, weaknesses, etc.)
 * Used for campaign card additions where normal deck building rules don't apply
 */
function getAllDeckableCards(): ArkhamCard[] {
  if (!cardsCache) return [];

  // Include more card types for campaign use
  const deckableCards = cardsCache.filter(card => {
    // Exclude investigators
    if (card.type_code === 'investigator') return false;

    // Story cards and story assets are allowed even if hidden
    // (many signature and campaign cards have hidden: true)
    const isStoryCard = card.type_code === 'story';
    const isStoryAsset = card.type_code === 'asset' && card.encounter_code;

    // For regular cards, exclude hidden ones
    if (card.hidden && !isStoryCard && !isStoryAsset) return false;

    // Exclude pure encounter cards (enemies, treacheries from encounter sets, locations)
    // But KEEP story assets even if they have encounter_code
    if (card.encounter_code) {
      // Allow story type cards and assets from encounter sets (story assets)
      if (card.type_code !== 'story' && card.type_code !== 'asset') {
        return false;
      }
    }

    // Include: assets, events, skills, story, and weaknesses (treachery with subtype)
    const deckableTypes = ['asset', 'event', 'skill', 'story', 'treachery'];
    return deckableTypes.includes(card.type_code);
  });

  // Deduplicate by name + XP level
  const seen = new Map<string, ArkhamCard>();

  for (const card of deckableCards) {
    const key = `${card.name}|${card.xp ?? 0}`;

    if (!seen.has(key)) {
      seen.set(key, card);
    } else {
      const existing = seen.get(key)!;
      if (card.code < existing.code) {
        seen.set(key, card);
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * Map an ArkhamCard to an Investigator object
 */
function mapToInvestigator(card: ArkhamCard): Investigator {
  return {
    code: card.code,
    name: card.name,
    real_name: card.real_name,
    subname: card.subname,
    faction_code: card.faction_code,
    faction2_code: card.faction2_code,
    faction3_code: card.faction3_code,
    health: card.health || 0,
    sanity: card.sanity || 0,
    skill_willpower: card.skill_willpower || 0,
    skill_intellect: card.skill_intellect || 0,
    skill_combat: card.skill_combat || 0,
    skill_agility: card.skill_agility || 0,
    traits: card.traits,
    text: card.text,
    back_text: card.back_text,
    deck_requirements: (card as unknown as Investigator).deck_requirements,
    deck_options: (card as unknown as Investigator).deck_options,
    pack_code: card.pack_code,
    pack_name: card.pack_name,
    position: card.position,
    spoiler: card.spoiler,
    back_link: card.back_link,
    alternate_of_code: (card as unknown as Investigator).alternate_of_code,
    alternate_required_code: (card as unknown as Investigator).alternate_required_code,
    hidden: card.hidden,
  };
}

/**
 * Get all investigators (including parallels and promos, deduplicated by code)
 */
function getInvestigators(): Investigator[] {
  if (investigatorsCache) return investigatorsCache;
  if (!cardsCache) return [];

  // Use a Set to track codes we've seen (handles exact duplicates like 01001 vs 01501 reprints)
  const seenCodes = new Set<string>();
  const investigators: ArkhamCard[] = [];

  for (const card of cardsCache) {
    if (card.type_code !== 'investigator') continue;
    if (card.hidden) continue;

    // Skip exact reprints (01501 series are reprints of 01001 series)
    // But keep parallels (90xxx) and promos (98xxx, 99xxx)
    const isReprint = /^01[5-9]/.test(card.code);
    if (isReprint) continue;

    if (!seenCodes.has(card.code)) {
      seenCodes.add(card.code);
      investigators.push(card);
    }
  }

  // Sort by name, then by code for variants of same investigator
  investigators.sort((a, b) => {
    const nameCompare = a.name.localeCompare(b.name);
    if (nameCompare !== 0) return nameCompare;
    return a.code.localeCompare(b.code);
  });

  investigatorsCache = investigators.map(card => mapToInvestigator(card));
  return investigatorsCache;
}

/**
 * Get a specific card by code
 */
function getCard(code: string): ArkhamCard | null {
  if (!cardsCache) return null;
  return cardsCache.find(card => card.code === code) || null;
}

/**
 * Get an investigator by code
 */
function getInvestigator(code: string): Investigator | null {
  const investigators = getInvestigators();
  return investigators.find(inv => inv.code === code) || null;
}

/**
 * Search cards by name
 */
function searchByName(query: string): ArkhamCard[] {
  if (!cardsCache || !query.trim()) return [];

  const normalizedQuery = query.toLowerCase().trim();
  const playerCards = getPlayerCards();

  return playerCards.filter(card => {
    const name = card.name.toLowerCase();
    const subname = card.subname?.toLowerCase() || '';
    return name.includes(normalizedQuery) || subname.includes(normalizedQuery);
  });
}

/**
 * Filter cards by various criteria
 */
interface FilterOptions {
  faction?: ArkhamFaction | ArkhamFaction[];
  type?: ArkhamCardType | ArkhamCardType[];
  xpMin?: number;
  xpMax?: number;
  slot?: string;
  traits?: string[];
  packCodes?: string[];
  query?: string;
}

function filterCards(options: FilterOptions): ArkhamCard[] {
  let cards = getPlayerCards();

  if (options.query) {
    const query = options.query.toLowerCase();
    cards = cards.filter(card => {
      const name = card.name.toLowerCase();
      const subname = card.subname?.toLowerCase() || '';
      const traits = card.traits?.toLowerCase() || '';
      const text = card.text?.toLowerCase() || '';
      return (
        name.includes(query) ||
        subname.includes(query) ||
        traits.includes(query) ||
        text.includes(query)
      );
    });
  }

  if (options.faction) {
    const factions = Array.isArray(options.faction) ? options.faction : [options.faction];
    cards = cards.filter(card =>
      factions.includes(card.faction_code) ||
      (card.faction2_code && factions.includes(card.faction2_code))
    );
  }

  if (options.type) {
    const types = Array.isArray(options.type) ? options.type : [options.type];
    cards = cards.filter(card => types.includes(card.type_code));
  }

  if (options.xpMin !== undefined) {
    cards = cards.filter(card => (card.xp || 0) >= options.xpMin!);
  }

  if (options.xpMax !== undefined) {
    cards = cards.filter(card => (card.xp || 0) <= options.xpMax!);
  }

  if (options.slot) {
    cards = cards.filter(card => card.slot === options.slot);
  }

  if (options.traits && options.traits.length > 0) {
    cards = cards.filter(card => {
      if (!card.traits) return false;
      const cardTraits = card.traits.toLowerCase();
      return options.traits!.some(trait => cardTraits.includes(trait.toLowerCase()));
    });
  }

  if (options.packCodes && options.packCodes.length > 0) {
    cards = cards.filter(card => options.packCodes!.includes(card.pack_code));
  }

  return cards;
}

/**
 * Get signature cards for an investigator
 */
function getSignatureCards(investigator: Investigator): ArkhamCard[] {
  if (!cardsCache || !investigator.deck_requirements?.card) return [];

  const signatureCodes = Object.keys(investigator.deck_requirements.card);
  return cardsCache.filter(card => signatureCodes.includes(card.code));
}

/**
 * Get random basic weaknesses
 */
function getBasicWeaknesses(): ArkhamCard[] {
  if (!cardsCache) return [];

  return cardsCache.filter(card => {
    // Basic weaknesses have subtype_code = 'basicweakness'
    const asAny = card as unknown as Record<string, unknown>;
    return asAny.subtype_code === 'basicweakness' && !card.hidden;
  });
}

/**
 * Get all packs
 */
function getPacks(): ArkhamPack[] {
  return packsCache || [];
}

/**
 * Clear the cache and force a refresh
 */
async function refreshCache(): Promise<void> {
  cardsCache = null;
  packsCache = null;
  investigatorsCache = null;
  localStorage.removeItem(CACHE_KEY);
  await initialize();
}

/**
 * Check if the service is initialized
 */
function isInitialized(): boolean {
  return cardsCache !== null;
}

/**
 * Find a card by name (exact or partial match)
 * Used for import functionality
 */
function findCardByName(name: string, xp?: number): ArkhamCard | null {
  if (!cardsCache || !name.trim()) return null;

  const normalizedName = name.toLowerCase().trim();

  // First try exact match
  let matches = cardsCache.filter(card => {
    const cardName = card.name.toLowerCase();
    const fullName = card.subname
      ? `${card.name}: ${card.subname}`.toLowerCase()
      : cardName;

    return cardName === normalizedName || fullName === normalizedName;
  });

  // If no exact match, try partial match
  if (matches.length === 0) {
    matches = cardsCache.filter(card => {
      const cardName = card.name.toLowerCase();
      return cardName.includes(normalizedName) || normalizedName.includes(cardName);
    });
  }

  // If XP is specified, filter by XP
  if (xp !== undefined && xp > 0) {
    // First try exact XP match
    const exactXpMatches = matches.filter(card => card.xp === xp);
    if (exactXpMatches.length > 0) {
      matches = exactXpMatches;
    } else {
      // If no exact match, try to find any upgraded version (xp > 0)
      // This handles cases where the export shows a different XP than the card data
      const upgradedMatches = matches.filter(card => card.xp && card.xp > 0);
      if (upgradedMatches.length > 0) {
        // Find the closest XP match among upgraded cards
        upgradedMatches.sort((a, b) => {
          const diffA = Math.abs((a.xp || 0) - xp);
          const diffB = Math.abs((b.xp || 0) - xp);
          return diffA - diffB;
        });
        matches = [upgradedMatches[0]];
      }
    }
  } else if (xp === 0) {
    // Explicitly looking for level 0 version
    const level0Matches = matches.filter(card => !card.xp || card.xp === 0);
    if (level0Matches.length > 0) {
      matches = level0Matches;
    }
  }

  // If still multiple matches, prefer player cards over encounter cards
  if (matches.length > 1) {
    const playerCardTypes = ['asset', 'event', 'skill', 'investigator'];
    const playerMatches = matches.filter(card => playerCardTypes.includes(card.type_code));
    if (playerMatches.length > 0) {
      matches = playerMatches;
    }
  }

  // Return the first match
  // Sort by XP descending if we're looking for upgraded, otherwise by code
  if (matches.length > 0) {
    if (xp !== undefined && xp > 0) {
      // For upgraded cards, prefer higher XP versions
      matches.sort((a, b) => (b.xp || 0) - (a.xp || 0));
    } else {
      // For base cards or unspecified, prefer lowest code (original printing)
      matches.sort((a, b) => a.code.localeCompare(b.code));
    }
    return matches[0];
  }

  return null;
}

export const arkhamCardService = {
  initialize,
  isInitialized,
  getPlayerCards,
  getAllDeckableCards,
  getInvestigators,
  getInvestigator,
  getCard,
  findCardByName,
  searchByName,
  filterCards,
  getSignatureCards,
  getBasicWeaknesses,
  getPacks,
  refreshCache,
  toCard,
  getArkhamCardImageUrl,
  getCardImageUrl,
};
