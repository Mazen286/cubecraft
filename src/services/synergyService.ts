/**
 * Synergy Service
 *
 * Calculates synergy bonuses for cards based on what's already been drafted.
 * Used by both bot picking logic and UI display.
 */

import type { YuGiOhCard } from '../types';
import type {
  CubeSynergies,
  SynergyTrigger,
  SynergyBoost,
  SynergyResult,
  SynergyBreakdown,
} from '../types/synergy';

// Re-export types for use by other modules
export type { CubeSynergies, SynergyResult, SynergyBreakdown };

// Cache for loaded synergies
const synergiesCache = new Map<string, CubeSynergies>();

/**
 * Load synergies for a cube
 */
export async function loadCubeSynergies(cubeId: string): Promise<CubeSynergies | null> {
  // Check cache first
  if (synergiesCache.has(cubeId)) {
    return synergiesCache.get(cubeId)!;
  }

  try {
    // Try to load from /public/synergies/{cubeId}.json
    const response = await fetch(`/synergies/${cubeId}.json`);
    if (!response.ok) {
      // No synergies file for this cube
      return null;
    }
    const synergies: CubeSynergies = await response.json();
    synergiesCache.set(cubeId, synergies);
    return synergies;
  } catch {
    // No synergies defined for this cube
    return null;
  }
}

/**
 * Get cached synergies (sync version for use after initial load)
 */
export function getCachedSynergies(cubeId: string): CubeSynergies | null {
  return synergiesCache.get(cubeId) || null;
}

/**
 * Clear synergy cache (useful when switching cubes)
 */
export function clearSynergyCache(): void {
  synergiesCache.clear();
}

/**
 * Check if a card is an Extra Deck monster (Fusion, Synchro, XYZ, Link)
 */
function isExtraDeckMonster(card: YuGiOhCard): boolean {
  const type = card.type.toLowerCase();
  return type.includes('fusion') || type.includes('synchro') || type.includes('xyz') || type.includes('link');
}

/**
 * Check if a card matches a trigger condition
 */
function cardMatchesTrigger(card: YuGiOhCard, trigger: SynergyTrigger): boolean {
  // If there's an 'and' condition, all must match
  if (trigger.and && trigger.and.length > 0) {
    return trigger.and.every(condition => cardMatchesTrigger(card, condition));
  }

  // If there's an 'or' condition, any can match
  if (trigger.or && trigger.or.length > 0) {
    return trigger.or.some(condition => cardMatchesTrigger(card, condition));
  }

  // Check individual conditions
  if (trigger.cardName && card.name !== trigger.cardName) {
    return false;
  }
  if (trigger.archetype && card.archetype !== trigger.archetype) {
    return false;
  }
  if (trigger.race && card.race !== trigger.race) {
    return false;
  }
  if (trigger.attribute && card.attribute !== trigger.attribute) {
    return false;
  }
  if (trigger.level !== undefined && card.level !== trigger.level) {
    return false;
  }
  if (trigger.maxLevel !== undefined && (card.level === undefined || card.level > trigger.maxLevel)) {
    return false;
  }
  if (trigger.cardType && !card.type.toLowerCase().includes(trigger.cardType.toLowerCase())) {
    return false;
  }
  if (trigger.notCardType && card.type.toLowerCase().includes(trigger.notCardType.toLowerCase())) {
    return false;
  }
  if (trigger.maxAtk !== undefined && (card.atk === undefined || card.atk > trigger.maxAtk)) {
    return false;
  }
  if (trigger.minAtk !== undefined && (card.atk === undefined || card.atk < trigger.minAtk)) {
    return false;
  }
  if (trigger.maxDef !== undefined && (card.def === undefined || card.def > trigger.maxDef)) {
    return false;
  }
  if (trigger.minDef !== undefined && (card.def === undefined || card.def < trigger.minDef)) {
    return false;
  }
  if (trigger.minScore !== undefined && (card.score === undefined || card.score < trigger.minScore)) {
    return false;
  }
  if (trigger.mainDeckOnly && isExtraDeckMonster(card)) {
    return false;
  }
  if (trigger.excludeCards && trigger.excludeCards.includes(card.name)) {
    return false;
  }
  return true;
}

/**
 * Check if a card matches a boost condition
 */
function cardMatchesBoost(card: YuGiOhCard, boost: SynergyBoost): boolean {
  // If there's an 'and' condition, all must match
  if (boost.and && boost.and.length > 0) {
    return boost.and.every(condition => cardMatchesBoost(card, condition));
  }

  // If there's an 'or' condition, any can match
  if (boost.or && boost.or.length > 0) {
    return boost.or.some(condition => cardMatchesBoost(card, condition));
  }

  // Check individual conditions (any defined condition must match)
  let hasCondition = false;
  let matches = true;

  if (boost.cardName !== undefined) {
    hasCondition = true;
    if (card.name !== boost.cardName) matches = false;
  }
  if (boost.archetype !== undefined) {
    hasCondition = true;
    if (card.archetype !== boost.archetype) matches = false;
  }
  if (boost.race !== undefined) {
    hasCondition = true;
    if (card.race !== boost.race) matches = false;
  }
  if (boost.attribute !== undefined) {
    hasCondition = true;
    if (card.attribute !== boost.attribute) matches = false;
  }
  if (boost.level !== undefined) {
    hasCondition = true;
    if (card.level !== boost.level) matches = false;
  }
  if (boost.maxLevel !== undefined) {
    hasCondition = true;
    if (card.level === undefined || card.level > boost.maxLevel) matches = false;
  }
  if (boost.cardType !== undefined) {
    hasCondition = true;
    if (!card.type.toLowerCase().includes(boost.cardType.toLowerCase())) matches = false;
  }
  if (boost.notCardType !== undefined) {
    hasCondition = true;
    if (card.type.toLowerCase().includes(boost.notCardType.toLowerCase())) matches = false;
  }
  if (boost.maxAtk !== undefined) {
    hasCondition = true;
    if (card.atk === undefined || card.atk > boost.maxAtk) matches = false;
  }
  if (boost.minAtk !== undefined) {
    hasCondition = true;
    if (card.atk === undefined || card.atk < boost.minAtk) matches = false;
  }
  if (boost.maxDef !== undefined) {
    hasCondition = true;
    if (card.def === undefined || card.def > boost.maxDef) matches = false;
  }
  if (boost.minDef !== undefined) {
    hasCondition = true;
    if (card.def === undefined || card.def < boost.minDef) matches = false;
  }
  if (boost.minScore !== undefined) {
    hasCondition = true;
    if (card.score === undefined || card.score < boost.minScore) matches = false;
  }
  if (boost.mainDeckOnly) {
    hasCondition = true;
    if (isExtraDeckMonster(card)) matches = false;
  }
  if (boost.excludeCards && boost.excludeCards.includes(card.name)) {
    matches = false;
  }

  // If only excludeCards is defined (no positive conditions), act as a filter
  // Return true if card is NOT excluded, false if it IS excluded
  if (!hasCondition && boost.excludeCards) {
    return !boost.excludeCards.includes(card.name);
  }

  return hasCondition && matches;
}

/**
 * Calculate synergy bonus for a single card based on drafted pool
 */
export function calculateCardSynergy(
  card: YuGiOhCard,
  draftedCards: YuGiOhCard[],
  synergies: CubeSynergies | null
): SynergyResult {
  const baseScore = card.score ?? 50;
  const breakdown: SynergyBreakdown[] = [];
  let totalBonus = 0;

  if (!synergies || synergies.rules.length === 0) {
    return {
      baseScore,
      synergyBonus: 0,
      adjustedScore: baseScore,
      breakdown: [],
    };
  }

  for (const rule of synergies.rules) {
    // Check requiresAll prerequisites - each condition must have at least one matching card
    if (rule.requiresAll && rule.requiresAll.length > 0) {
      const allRequirementsMet = rule.requiresAll.every(requirement =>
        draftedCards.some(c => cardMatchesTrigger(c, requirement))
      );
      if (!allRequirementsMet) {
        continue;
      }
    }

    // Find cards in pool that match the trigger
    const triggerCards = draftedCards.filter(c => cardMatchesTrigger(c, rule.trigger));

    if (triggerCards.length === 0) {
      continue;
    }

    // Check if the current card matches the boost condition
    if (!cardMatchesBoost(card, rule.boost)) {
      continue;
    }

    // Calculate bonus
    let bonus = rule.bonus;
    const bonusType = rule.bonusType || 'flat';

    // Apply scaling if enabled
    if (rule.scaling && triggerCards.length > 1) {
      bonus = bonus * triggerCards.length;
    }

    // Apply max bonus cap if defined
    if (rule.maxBonus !== undefined && bonus > rule.maxBonus) {
      bonus = rule.maxBonus;
    }

    // For multiplier type, convert to flat bonus based on base score
    if (bonusType === 'multiplier') {
      bonus = baseScore * (bonus - 1); // e.g., 1.5x means +50% = +0.5 * baseScore
    }

    totalBonus += bonus;
    breakdown.push({
      ruleId: rule.id,
      name: rule.name,
      category: rule.category,
      description: rule.description,
      bonus,
      triggerCards: triggerCards.map(c => c.name),
    });
  }

  // Cap adjusted score at 100
  const adjustedScore = Math.min(100, Math.round(baseScore + totalBonus));

  return {
    baseScore,
    synergyBonus: Math.round(totalBonus),
    adjustedScore,
    breakdown,
  };
}

/**
 * Calculate synergies for all cards in a pack
 */
export function calculatePackSynergies(
  packCards: YuGiOhCard[],
  draftedCards: YuGiOhCard[],
  synergies: CubeSynergies | null
): Map<number, SynergyResult> {
  const results = new Map<number, SynergyResult>();

  for (const card of packCards) {
    results.set(card.id, calculateCardSynergy(card, draftedCards, synergies));
  }

  return results;
}

/**
 * Get the best pick from a pack considering synergies
 * Used by bot AI
 */
export function getBestPickWithSynergies(
  packCards: YuGiOhCard[],
  draftedCards: YuGiOhCard[],
  synergies: CubeSynergies | null
): { card: YuGiOhCard; synergy: SynergyResult } | null {
  if (packCards.length === 0) return null;

  let bestCard = packCards[0];
  let bestSynergy = calculateCardSynergy(bestCard, draftedCards, synergies);

  for (const card of packCards.slice(1)) {
    const synergy = calculateCardSynergy(card, draftedCards, synergies);
    if (synergy.adjustedScore > bestSynergy.adjustedScore) {
      bestCard = card;
      bestSynergy = synergy;
    }
  }

  return { card: bestCard, synergy: bestSynergy };
}

/**
 * Export the service object for consistency with other services
 */
export const synergyService = {
  loadCubeSynergies,
  getCachedSynergies,
  clearSynergyCache,
  calculateCardSynergy,
  calculatePackSynergies,
  getBestPickWithSynergies,
};
