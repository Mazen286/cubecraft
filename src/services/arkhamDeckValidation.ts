/**
 * Arkham Horror LCG Deck Validation Engine
 *
 * Validates decks against investigator-specific deck building rules
 */

import type {
  Investigator,
  ArkhamCard,
  DeckOption,
  ArkhamValidationResult,
  ArkhamValidationError,
  ArkhamFaction,
} from '../types/arkham';
import { arkhamCardService } from './arkhamCardService';

/**
 * Check if a card matches a deck option
 */
function cardMatchesDeckOption(card: ArkhamCard, option: DeckOption): boolean {
  // Check faction
  if (option.faction && option.faction.length > 0) {
    const cardFactions = [card.faction_code, card.faction2_code, card.faction3_code].filter(Boolean);
    const matchesFaction = option.faction.some(f => cardFactions.includes(f as ArkhamFaction));
    if (!matchesFaction) return false;
  }

  // Check level/XP
  if (option.level) {
    const cardXp = card.xp ?? 0;
    if (cardXp < option.level.min || cardXp > option.level.max) {
      return false;
    }
  }

  // Check type
  if (option.type && option.type.length > 0) {
    if (!option.type.includes(card.type_code)) {
      return false;
    }
  }

  // Check traits
  if (option.trait && option.trait.length > 0) {
    if (!card.traits) return false;
    const cardTraits = card.traits.toLowerCase();
    const hasMatchingTrait = option.trait.some(t => cardTraits.includes(t.toLowerCase()));
    if (!hasMatchingTrait) return false;
  }

  // Check permanent
  if (option.permanent !== undefined) {
    if (card.permanent !== option.permanent) return false;
  }

  // Check uses
  if (option.uses && option.uses.length > 0) {
    if (!card.text) return false;
    const cardText = card.text.toLowerCase();
    const hasUses = option.uses.some(use => cardText.includes(`uses (${use.toLowerCase()}`));
    if (!hasUses) return false;
  }

  // Check specific card names
  if (option.name && option.name.length > 0) {
    if (!option.name.includes(card.name)) return false;
  }

  return true;
}

/**
 * Check if an investigator can include a specific card
 */
export function canIncludeCard(
  investigator: Investigator,
  card: ArkhamCard
): { allowed: boolean; reason?: string; matchedOption?: DeckOption } {
  // Investigators can't include investigator cards
  if (card.type_code === 'investigator') {
    return { allowed: false, reason: 'Investigators cannot be included in decks' };
  }

  // Check if card is a signature card for this investigator
  if (card.restrictions?.investigator) {
    const allowedInvestigators = Object.keys(card.restrictions.investigator);
    if (allowedInvestigators.length > 0 && !allowedInvestigators.includes(investigator.code)) {
      return { allowed: false, reason: `This card is a signature card for another investigator` };
    }
    // If it IS a signature for this investigator, it's allowed
    return { allowed: true, matchedOption: undefined };
  }

  // Check investigator's deck options
  const deckOptions = investigator.deck_options || [];

  // Special handling for "not" options - these exclude cards
  const notOptions = deckOptions.filter(opt => opt.not);
  for (const notOption of notOptions) {
    if (cardMatchesDeckOption(card, { ...notOption, not: false })) {
      return { allowed: false, reason: notOption.error || 'Card excluded by deck building rules' };
    }
  }

  // Check if card matches any positive option
  const positiveOptions = deckOptions.filter(opt => !opt.not);
  for (const option of positiveOptions) {
    if (cardMatchesDeckOption(card, option)) {
      return { allowed: true, matchedOption: option };
    }
  }

  return { allowed: false, reason: 'Card does not match any deck building option' };
}

/**
 * Calculate total XP cost of cards in deck
 */
export function calculateXpCost(slots: Record<string, number>): number {
  let totalXp = 0;

  for (const [code, quantity] of Object.entries(slots)) {
    const card = arkhamCardService.getCard(code);
    if (card && card.xp) {
      totalXp += card.xp * quantity;
    }
  }

  return totalXp;
}

/**
 * Get required signature cards for an investigator
 */
function getRequiredCardCodes(investigator: Investigator): string[] {
  if (!investigator.deck_requirements?.card) return [];
  return Object.keys(investigator.deck_requirements.card);
}

/**
 * Validate an Arkham Horror deck
 */
export function validateArkhamDeck(
  investigator: Investigator,
  slots: Record<string, number>,
  xpBudget: number = 0
): ArkhamValidationResult {
  const errors: ArkhamValidationError[] = [];
  const warnings: ArkhamValidationError[] = [];

  // Get required deck size
  const requiredSize = investigator.deck_requirements?.size || 30;

  // Count total cards
  let deckSize = 0;
  for (const quantity of Object.values(slots)) {
    deckSize += quantity;
  }

  // Calculate XP spent
  const totalXp = calculateXpCost(slots);

  // Track cards by deck option for limit checking
  const optionCounts = new Map<string, number>();

  // Validate each card
  for (const [code, quantity] of Object.entries(slots)) {
    const card = arkhamCardService.getCard(code);
    if (!card) {
      errors.push({
        code: 'UNKNOWN_CARD',
        severity: 'error',
        message: `Unknown card: ${code}`,
        cardCode: code,
      });
      continue;
    }

    // Check if card can be included
    const eligibility = canIncludeCard(investigator, card);
    if (!eligibility.allowed) {
      errors.push({
        code: 'INVALID_CARD',
        severity: 'error',
        message: `${card.name}: ${eligibility.reason}`,
        cardCode: code,
      });
      continue;
    }

    // Check copy limit
    const copyLimit = card.deck_limit ?? 2;
    if (quantity > copyLimit) {
      errors.push({
        code: 'COPY_LIMIT',
        severity: 'error',
        message: `${card.name}: exceeds copy limit (${quantity}/${copyLimit})`,
        cardCode: code,
      });
    }

    // Track cards for deck option limits
    if (eligibility.matchedOption?.limit !== undefined && eligibility.matchedOption.id) {
      const optionId = eligibility.matchedOption.id;
      const currentCount = optionCounts.get(optionId) || 0;
      optionCounts.set(optionId, currentCount + quantity);
    }
  }

  // Check deck option limits
  const deckOptions = investigator.deck_options || [];
  for (const option of deckOptions) {
    if (option.limit !== undefined && option.id) {
      const count = optionCounts.get(option.id) || 0;
      if (count > option.limit) {
        errors.push({
          code: 'OPTION_LIMIT',
          severity: 'error',
          message: `Exceeded limit for ${option.id}: ${count}/${option.limit}`,
        });
      }
    }
  }

  // Check required signature cards
  const requiredCodes = getRequiredCardCodes(investigator);
  for (const code of requiredCodes) {
    if (!slots[code]) {
      const card = arkhamCardService.getCard(code);
      errors.push({
        code: 'MISSING_REQUIRED',
        severity: 'error',
        message: `Missing required card: ${card?.name || code}`,
        cardCode: code,
      });
    }
  }

  // Check deck size
  if (deckSize < requiredSize) {
    warnings.push({
      code: 'DECK_TOO_SMALL',
      severity: 'warning',
      message: `Deck needs ${requiredSize - deckSize} more cards (${deckSize}/${requiredSize})`,
    });
  } else if (deckSize > requiredSize) {
    errors.push({
      code: 'DECK_TOO_LARGE',
      severity: 'error',
      message: `Deck has too many cards: ${deckSize}/${requiredSize}`,
    });
  }

  // Check XP budget
  if (xpBudget > 0 && totalXp > xpBudget) {
    errors.push({
      code: 'XP_EXCEEDED',
      severity: 'error',
      message: `XP spent (${totalXp}) exceeds budget (${xpBudget})`,
    });
  }

  // Check for basic weakness
  const hasBasicWeakness = Object.keys(slots).some(code => {
    const card = arkhamCardService.getCard(code);
    if (!card) return false;
    const asAny = card as unknown as Record<string, unknown>;
    return asAny.subtype_code === 'basicweakness';
  });

  if (!hasBasicWeakness && investigator.deck_requirements?.random) {
    warnings.push({
      code: 'MISSING_WEAKNESS',
      severity: 'warning',
      message: 'Deck should include a random basic weakness',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    deckSize,
    requiredSize,
    totalXp,
  };
}

/**
 * Get eligible cards for an investigator
 */
export function getEligibleCards(investigator: Investigator): ArkhamCard[] {
  const allCards = arkhamCardService.getPlayerCards();
  return allCards.filter(card => canIncludeCard(investigator, card).allowed);
}

/**
 * Get eligible cards grouped by faction
 */
export function getEligibleCardsByFaction(
  investigator: Investigator
): Record<ArkhamFaction, ArkhamCard[]> {
  const eligibleCards = getEligibleCards(investigator);

  const byFaction: Record<ArkhamFaction, ArkhamCard[]> = {
    guardian: [],
    seeker: [],
    rogue: [],
    mystic: [],
    survivor: [],
    neutral: [],
    mythos: [],
  };

  for (const card of eligibleCards) {
    if (byFaction[card.faction_code]) {
      byFaction[card.faction_code].push(card);
    }
  }

  return byFaction;
}

/**
 * Calculate XP cost to upgrade from one card to another
 */
export function calculateUpgradeCost(oldCard: ArkhamCard, newCard: ArkhamCard): number {
  const oldXp = oldCard.xp || 0;
  const newXp = newCard.xp || 0;

  // Same card name - just pay the difference
  if (oldCard.name === newCard.name) {
    return Math.max(0, newXp - oldXp);
  }

  // Different cards - pay full XP of new card
  return newXp;
}
