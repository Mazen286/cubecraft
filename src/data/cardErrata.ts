/**
 * Pre-errata card text for cards that should use their original versions
 * Card ID -> Original card text
 */

export interface ErrataData {
  originalText: string;
  originalImage?: string; // Optional: URL to original card image
  notes?: string; // Optional: Brief note about what changed
}

export const cardErrata: Record<number, ErrataData> = {
  // Sangan
  26202165: {
    originalText: "When this card is sent from the field to the Graveyard: Add 1 monster with 1500 or less ATK from your Deck to your hand.",
    notes: "No activation restriction on searched card"
  },

  // Brain Control
  87910978: {
    originalText: "Pay 800 Life Points. Select 1 face-up monster your opponent controls. Take control of it until the End Phase.",
    notes: "No Normal Summon/Set restriction"
  },

  // Necrovalley
  47355498: {
    originalText: "All \"Gravekeeper's\" monsters gain 500 ATK and DEF. Cards in the Graveyard cannot be removed from play. Negate any card effect that would move a card in the Graveyard, other than itself, to a different place.",
    notes: "Didn't negate GY effects that don't move cards"
  },

  // Chaos Emperor Dragon - Envoy of the End
  82301904: {
    originalText: "Cannot be Normal Summoned/Set. Must be Special Summoned (from your hand) by banishing 1 LIGHT and 1 DARK monster from your GY. Pay 1000 LP: Send all cards in both players' hands and on the field to the GY, then inflict 300 damage to your opponent for each card sent to the GY by this effect.",
    notes: "No restriction on other effects, counts all cards sent"
  },

  // Witch of the Black Forest
  78010363: {
    originalText: "When this card is sent from the field to the Graveyard: Add 1 monster with 1500 or less DEF from your Deck to your hand.",
    notes: "No activation restriction on searched card"
  },

  // Sinister Serpent
  8131171: {
    originalText: "During your Standby Phase, if this card is in your GY: You can add this card to your hand.",
    notes: "No banish clause - infinite recursion"
  },

  // Dark Magician of Chaos
  40737112: {
    originalText: "When this card is Normal or Special Summoned: You can target 1 Spell Card in your GY; add it to your hand. Banish any monster destroyed by battle with this card. If this card is destroyed or removed from the field, banish it.",
    notes: "Banishes on destruction, not just leaving field"
  },

  // Crush Card Virus
  57728570: {
    originalText: "Tribute 1 DARK monster with 1000 or less ATK. Check your opponent's hand, all monsters they control, and all cards they draw (until the end of your opponent's 3rd turn after this card's activation), and destroy all monsters with 1500 or more ATK.",
    notes: "Affected 3 turns of draws, no deck destruction option"
  },

  // Ring of Destruction
  83555666: {
    originalText: "Destroy 1 face-up Monster Card and inflict damage equal to the destroyed card's ATK to both players' Life Points.",
    notes: "Usable on either turn, simultaneous damage"
  },

  // Dark Strike Fighter
  32646477: {
    originalText: "Once per turn: You can Tribute 1 monster; inflict damage to your opponent equal to that monster's Level × 200.",
    notes: "Could be used multiple times via leaving/re-entering field"
  },

  // Goyo Guardian
  7391448: {
    originalText: "1 Tuner + 1 or more non-Tuner monsters. When this card destroys an opponent's monster by battle and sends it to the Graveyard: You can Special Summon that monster to your side of the field.",
    notes: "No EARTH Tuner requirement"
  },

  // Night Assailant
  16226786: {
    originalText: "FLIP: Target 1 monster your opponent controls; destroy that target. When this card is sent from your hand to the GY: Target 1 Flip monster in your GY; add it to your hand.",
    notes: "Could return itself - infinite loop with discard"
  }
};

/**
 * Check if a card has errata data
 */
export function hasErrata(cardId: number | string): boolean {
  const numericId = typeof cardId === 'string' ? parseInt(cardId, 10) : cardId;
  return cardErrata[numericId] !== undefined;
}

/**
 * Get errata data for a card
 */
export function getErrata(cardId: number | string): ErrataData | null {
  const numericId = typeof cardId === 'string' ? parseInt(cardId, 10) : cardId;
  return cardErrata[numericId] || null;
}

/**
 * Get list of all card IDs with errata
 */
export function getErrataCardIds(): number[] {
  return Object.keys(cardErrata).map(Number);
}
