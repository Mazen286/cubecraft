export interface ArkhamKeyword {
  name: string;
  description: string;
  rules?: string; // Additional rules clarification
  category: 'cost' | 'timing' | 'deckbuilding' | 'gameplay' | 'trait';
}

export const ARKHAM_KEYWORDS: ArkhamKeyword[] = [
  // Cost Keywords
  {
    name: 'Exceptional',
    description: 'Costs double the printed XP to add to your deck. Limited to 1 copy.',
    rules: 'A deck cannot include more than 1 copy of any exceptional card.',
    category: 'cost',
  },
  {
    name: 'Myriad',
    description: 'You may include up to 3 copies. XP cost is paid only once for all copies.',
    rules: 'When you purchase a myriad card, you get 3 copies for the price of one.',
    category: 'cost',
  },

  // Timing Keywords
  {
    name: 'Fast',
    description: 'Does not cost an action to play. Play during any player window.',
    rules: 'Fast cards can be played during any player window on your turn, or when specified by the card.',
    category: 'timing',
  },
  {
    name: 'Forced',
    description: 'This effect triggers automatically when its condition is met.',
    rules: 'Forced effects must be resolved - they are not optional.',
    category: 'timing',
  },
  {
    name: 'Revelation',
    description: 'Resolve this effect when the card is drawn.',
    rules: 'Revelation effects on encounter cards must be resolved immediately when drawn.',
    category: 'timing',
  },

  // Deckbuilding Keywords
  {
    name: 'Permanent',
    description: 'Begins in play. Cannot be discarded. Does not count toward deck size.',
    rules: 'Permanent cards start the game in play and cannot leave play by any means.',
    category: 'deckbuilding',
  },
  {
    name: 'Bonded',
    description: 'Cannot be included in deck. Set aside at start and brought into play by another card.',
    rules: 'Bonded cards are set aside at the start of the game and only enter play through their bonded parent card.',
    category: 'deckbuilding',
  },
  {
    name: 'Customizable',
    description: 'Can be upgraded with checkboxes. Each checkbox costs the listed XP.',
    rules: 'Check boxes from top to bottom. Some upgrades have prerequisites requiring previous boxes to be checked first.',
    category: 'deckbuilding',
  },

  // Gameplay Keywords
  {
    name: 'Seal',
    description: 'Place a chaos token on this card. While sealed, it cannot be revealed from the bag.',
    rules: 'When a card with Seal leaves play, return the sealed token(s) to the chaos bag.',
    category: 'gameplay',
  },
  {
    name: 'Uses',
    description: 'This card enters play with the specified number of resource tokens.',
    rules: 'Uses are spent to trigger abilities. When all uses are depleted, the card often discards itself.',
    category: 'gameplay',
  },
  {
    name: 'Patrol',
    description: 'Enemy moves toward the nearest investigator during enemy phase.',
    rules: 'If multiple investigators are equidistant, the lead investigator chooses.',
    category: 'gameplay',
  },
  {
    name: 'Hunter',
    description: 'Enemy moves toward the nearest investigator during enemy phase.',
    rules: 'Hunter enemies move one location toward the nearest investigator during the enemy phase.',
    category: 'gameplay',
  },
  {
    name: 'Retaliate',
    description: 'When you fail an attack against this enemy, it attacks you.',
    rules: 'The attack of opportunity occurs immediately after the failed attack.',
    category: 'gameplay',
  },
  {
    name: 'Alert',
    description: 'When you fail an evade against this enemy, it attacks you.',
    rules: 'The attack of opportunity occurs immediately after the failed evade attempt.',
    category: 'gameplay',
  },
  {
    name: 'Massive',
    description: 'Enemy is engaged with all investigators at its location.',
    rules: 'Massive enemies do not exhaust when attacking - they attack each engaged investigator.',
    category: 'gameplay',
  },
  {
    name: 'Aloof',
    description: 'Enemy does not automatically engage. Must use engage action.',
    rules: 'Aloof enemies will not engage investigators during the enemy phase.',
    category: 'gameplay',
  },
  {
    name: 'Elusive',
    description: 'Cannot be damaged while exhausted.',
    rules: 'After evading an elusive enemy, it cannot be attacked until it readies.',
    category: 'gameplay',
  },
  {
    name: 'Surge',
    description: 'After resolving, draw another encounter card.',
    rules: 'The additional encounter card is drawn immediately after resolving the surge card.',
    category: 'gameplay',
  },
  {
    name: 'Peril',
    description: 'Other investigators cannot help or commit cards to this skill test.',
    rules: 'You must resolve peril effects alone - other players cannot commit cards or use abilities to help.',
    category: 'gameplay',
  },
  {
    name: 'Hidden',
    description: 'This card is placed in your threat area facedown.',
    rules: 'Hidden cards are placed facedown and may have effects that trigger while hidden.',
    category: 'gameplay',
  },
  {
    name: 'Victory',
    description: 'Worth victory points when in the victory display at end of scenario.',
    rules: 'Victory points are added to your campaign log and may affect future scenarios.',
    category: 'gameplay',
  },
  {
    name: 'Vengeance',
    description: 'Add to the victory display when defeated.',
    rules: 'Vengeance cards count toward a separate vengeance total that may have negative effects.',
    category: 'gameplay',
  },
  {
    name: 'Spawn',
    description: 'Determines where the enemy enters play.',
    rules: 'If the spawn location is not in play, the enemy spawns engaged with the drawing investigator.',
    category: 'gameplay',
  },
  {
    name: 'Prey',
    description: 'This enemy engages the investigator who best matches the prey criteria.',
    rules: 'If multiple investigators match the prey criteria, the enemy engages the closest one.',
    category: 'gameplay',
  },
  {
    name: 'Haunted',
    description: 'When you enter this location, resolve its haunted effect.',
    rules: 'Haunted effects also trigger when you end your turn at the location if you did not enter it that turn.',
    category: 'gameplay',
  },
  {
    name: 'Swarming',
    description: 'When this enemy spawns, place additional swarm cards underneath it.',
    rules: 'Swarm cards attack together with the host and must all be defeated to remove the enemy.',
    category: 'gameplay',
  },
  {
    name: 'Concealed',
    description: 'This enemy enters play in a concealed mini-card state.',
    rules: 'Concealed enemies must be exposed before they can be attacked or evaded.',
    category: 'gameplay',
  },
];

// Category display names
export const CATEGORY_NAMES: Record<string, string> = {
  cost: 'Cost',
  timing: 'Timing',
  deckbuilding: 'Deckbuilding',
  gameplay: 'Gameplay',
  trait: 'Trait',
};

// Helper to get keywords by category
export function getKeywordsByCategory(): Record<string, ArkhamKeyword[]> {
  return ARKHAM_KEYWORDS.reduce(
    (acc, kw) => {
      if (!acc[kw.category]) acc[kw.category] = [];
      acc[kw.category].push(kw);
      return acc;
    },
    {} as Record<string, ArkhamKeyword[]>
  );
}

// Helper to search keywords
export function searchKeywords(query: string): ArkhamKeyword[] {
  const q = query.toLowerCase();
  return ARKHAM_KEYWORDS.filter(
    (kw) => kw.name.toLowerCase().includes(q) || kw.description.toLowerCase().includes(q)
  );
}
