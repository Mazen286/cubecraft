/**
 * Card Synergy System Types
 *
 * Defines synergy relationships between cards that affect draft scoring.
 * Synergies are defined per-cube and adjust card values based on what's already drafted.
 */

/**
 * Defines what triggers a synergy bonus
 */
export interface SynergyTrigger {
  /** Specific card name (e.g., "Tour Guide From the Underworld") */
  cardName?: string;
  /** Card archetype (e.g., "Kashtira", "Maliss") */
  archetype?: string;
  /** Card type (e.g., "Zombie", "Machine") - refers to race/monster type */
  race?: string;
  /** Card attribute (e.g., "DARK", "LIGHT", "EARTH") */
  attribute?: string;
  /** Card level/rank */
  level?: number;
  /** Maximum level/rank */
  maxLevel?: number;
  /** Card type category (e.g., "Spell Card", "Trap Card") */
  cardType?: string;
  /** Maximum ATK value (for recruiters like Giant Rat) */
  maxAtk?: number;
  /** Minimum ATK value (for Deck Devastation Virus, etc.) */
  minAtk?: number;
  /** Maximum DEF value (for recruiters like Pyramid Turtle) */
  maxDef?: number;
  /** Minimum DEF value */
  minDef?: number;
  /** Only match Main Deck monsters (excludes Fusion, Synchro, XYZ, Link) */
  mainDeckOnly?: boolean;
  /** Exclude specific card names from matching */
  excludeCards?: string[];
  /** Combined conditions - all must match */
  and?: SynergyTrigger[];
  /** Alternative conditions - any can match */
  or?: SynergyTrigger[];
}

/**
 * Defines what receives a synergy bonus
 */
export interface SynergyBoost {
  /** Specific card name to boost */
  cardName?: string;
  /** Boost all cards of this archetype */
  archetype?: string;
  /** Boost all cards of this race/monster type */
  race?: string;
  /** Boost all cards with this attribute */
  attribute?: string;
  /** Boost all cards of this level */
  level?: number;
  /** Maximum level/rank */
  maxLevel?: number;
  /** Boost all cards of this card type category */
  cardType?: string;
  /** Maximum ATK value (for recruiters) */
  maxAtk?: number;
  /** Minimum ATK value (for Deck Devastation Virus tribute, etc.) */
  minAtk?: number;
  /** Maximum DEF value (for recruiters) */
  maxDef?: number;
  /** Minimum DEF value */
  minDef?: number;
  /** Only match Main Deck monsters (excludes Fusion, Synchro, XYZ, Link) */
  mainDeckOnly?: boolean;
  /** Exclude specific card names from matching */
  excludeCards?: string[];
  /** Combined conditions - all must match (e.g., level 3 AND Fiend) */
  and?: SynergyBoost[];
  /** Alternative conditions - any can match (e.g., Synchro OR Fusion) */
  or?: SynergyBoost[];
}

/**
 * A single synergy rule
 */
export interface SynergyRule {
  /** Unique ID for this synergy */
  id: string;
  /** Human-readable name for this synergy */
  name: string;
  /** Description shown in UI */
  description: string;
  /**
   * Prerequisites that must ALL be met before this rule applies.
   * Each condition needs at least one card in your pool to match it.
   * Example: Dark Simorgh needs both DARK and WIND monsters.
   */
  requiresAll?: SynergyTrigger[];
  /** What card(s) in your pool trigger this synergy */
  trigger: SynergyTrigger;
  /** What card(s) receive the bonus */
  boost: SynergyBoost;
  /**
   * How strong the synergy is.
   * Can be a flat bonus (e.g., 20) or a multiplier (e.g., 1.5)
   */
  bonus: number;
  /** Whether bonus is 'flat' (+X) or 'multiplier' (*X). Defaults to 'flat' */
  bonusType?: 'flat' | 'multiplier';
  /**
   * Whether the bonus scales with count of triggers.
   * e.g., if true and you have 3 zombies, Zombie World gets 3x the bonus
   */
  scaling?: boolean;
  /** Maximum bonus when scaling (prevents runaway values) */
  maxBonus?: number;
}

/**
 * Synergy configuration for a cube
 */
export interface CubeSynergies {
  /** The cube ID these synergies apply to */
  cubeId: string;
  /** List of synergy rules */
  rules: SynergyRule[];
  /** Version for future migrations */
  version: number;
}

/**
 * Result of calculating synergies for a card
 */
export interface SynergyResult {
  /** Original base score */
  baseScore: number;
  /** Total synergy bonus */
  synergyBonus: number;
  /** Final adjusted score */
  adjustedScore: number;
  /** Breakdown of each synergy that applied */
  breakdown: SynergyBreakdown[];
}

/**
 * Details of a single synergy bonus applied
 */
export interface SynergyBreakdown {
  /** The synergy rule that triggered */
  ruleId: string;
  /** Name of the synergy */
  name: string;
  /** Description for tooltip */
  description: string;
  /** The bonus amount applied */
  bonus: number;
  /** Cards in pool that triggered this synergy */
  triggerCards: string[];
}
