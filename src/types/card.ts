/**
 * Generic card interface that all card games implement.
 * Game-specific attributes are stored in the `attributes` object.
 */
export interface Card {
  id: string | number;
  name: string;
  type: string;
  description?: string;
  imageUrl?: string;  // Override for custom images
  score?: number;     // Draft rating (0-100)

  // Game-specific attributes stored in flexible structure
  attributes: Record<string, unknown>;
}

/**
 * Yu-Gi-Oh! specific card attributes
 */
export interface YuGiOhCardAttributes {
  atk?: number;
  def?: number;
  level?: number;
  attribute?: string;   // DARK, LIGHT, FIRE, WATER, EARTH, WIND, DIVINE
  race?: string;        // Dragon, Spellcaster, Warrior, etc.
  linkval?: number;     // Link rating for Link monsters
  archetype?: string;
}

/**
 * Magic: The Gathering specific card attributes
 */
export interface MTGCardAttributes {
  manaCost?: string;    // e.g., "{2}{U}{U}"
  cmc?: number;         // Converted mana cost
  colors?: string[];    // W, U, B, R, G
  colorIdentity?: string[];
  rarity?: string;      // common, uncommon, rare, mythic
  set?: string;         // Set code
  collectorNumber?: string;
  power?: string;       // Can be "*" for variable
  toughness?: string;
  loyalty?: number;     // For planeswalkers
  scryfallId?: string;  // For image URLs
}

/**
 * Pokemon TCG specific card attributes
 */
export interface PokemonCardAttributes {
  hp?: number;
  energyType?: string;    // Fire, Water, Grass, etc.
  stage?: string;         // Basic, Stage 1, Stage 2, VMAX, etc.
  retreatCost?: number;
  weakness?: string;
  resistance?: string;
  regulationMark?: string;
  setCode?: string;
  cardNumber?: string;
}

/**
 * Helper type to create a typed card with specific attributes
 */
export type TypedCard<T> = Omit<Card, 'attributes'> & { attributes: T };

/**
 * Legacy Yu-Gi-Oh! card type (for backward compatibility)
 * Maps to the flat structure used in existing code
 */
export interface LegacyYuGiOhCard {
  id: number;
  name: string;
  type: string;
  desc: string;
  atk?: number;
  def?: number;
  level?: number;
  attribute?: string;
  race?: string;
  linkval?: number;
  archetype?: string;
  score?: number;
}

/**
 * Convert legacy Yu-Gi-Oh! card to generic Card format
 */
export function fromLegacyYuGiOhCard(legacy: LegacyYuGiOhCard): Card {
  return {
    id: legacy.id,
    name: legacy.name,
    type: legacy.type,
    description: legacy.desc,
    score: legacy.score,
    attributes: {
      atk: legacy.atk,
      def: legacy.def,
      level: legacy.level,
      attribute: legacy.attribute,
      race: legacy.race,
      linkval: legacy.linkval,
      archetype: legacy.archetype,
    },
  };
}

/**
 * Convert generic Card to legacy Yu-Gi-Oh! format (for backward compatibility)
 */
export function toLegacyYuGiOhCard(card: Card): LegacyYuGiOhCard {
  const attrs = card.attributes as YuGiOhCardAttributes;
  return {
    id: typeof card.id === 'number' ? card.id : parseInt(card.id, 10),
    name: card.name,
    type: card.type,
    desc: card.description || '',
    atk: attrs.atk,
    def: attrs.def,
    level: attrs.level,
    attribute: attrs.attribute,
    race: attrs.race,
    linkval: attrs.linkval,
    archetype: attrs.archetype,
    score: card.score,
  };
}
