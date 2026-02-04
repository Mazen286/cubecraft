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
  {
    name: 'Reaction',
    description: 'Triggered ability that can be used after its trigger condition occurs.',
    rules: 'Reaction abilities are optional. The trigger window closes after all players pass on using reactions.',
    category: 'timing',
  },
  {
    name: 'Free Triggered Ability',
    description: 'An ability that does not cost an action to trigger.',
    rules: 'Free triggered abilities can be used during any player window unless otherwise specified.',
    category: 'timing',
  },
  {
    name: 'Action',
    description: 'An ability that costs one of your three actions to use.',
    rules: 'You get 3 actions per turn. Action abilities are indicated by the action arrow icon.',
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
  {
    name: 'Researched',
    description: 'This card can only be added to your deck after completing specific campaign requirements.',
    rules: 'Researched cards typically require finding clues or completing objectives before they can be purchased.',
    category: 'deckbuilding',
  },
  {
    name: 'Signature',
    description: 'Cards unique to a specific investigator that must be included in their deck.',
    rules: 'Each investigator has signature assets and weaknesses that are always part of their deck.',
    category: 'deckbuilding',
  },
  {
    name: 'Basic Weakness',
    description: 'Random weakness cards added to your deck during deckbuilding.',
    rules: 'Most investigators must include one random basic weakness. Some effects add additional weaknesses.',
    category: 'deckbuilding',
  },
  {
    name: 'Advanced',
    description: 'Optional replacement signature cards with different abilities.',
    rules: 'Advanced signatures can be swapped in for standard signatures at the start of a campaign.',
    category: 'deckbuilding',
  },
  {
    name: 'Parallel',
    description: 'Alternate version of an investigator with different abilities and deckbuilding.',
    rules: 'Parallel investigators can mix and match front/back with the original version.',
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
  {
    name: 'Doom',
    description: 'Tokens that advance the agenda when thresholds are reached.',
    rules: 'During the Mythos phase, doom is added to the agenda. When doom equals or exceeds the threshold, the agenda advances.',
    category: 'gameplay',
  },
  {
    name: 'Clues',
    description: 'Tokens discovered at locations to advance the act.',
    rules: 'Investigators discover clues by successfully investigating. Clues are spent to advance act cards.',
    category: 'gameplay',
  },
  {
    name: 'Direct Damage',
    description: 'Damage that cannot be assigned to assets - must be taken on your investigator.',
    rules: 'Direct damage bypasses allies and other assets that could normally soak damage.',
    category: 'gameplay',
  },
  {
    name: 'Direct Horror',
    description: 'Horror that cannot be assigned to assets - must be taken on your investigator.',
    rules: 'Direct horror bypasses allies and other assets that could normally soak horror.',
    category: 'gameplay',
  },
  {
    name: 'Engage',
    description: 'Action to engage an enemy at your location.',
    rules: 'Engaged enemies attack you during the enemy phase. Only one investigator can be engaged with a non-Massive enemy.',
    category: 'gameplay',
  },
  {
    name: 'Evade',
    description: 'Action to exhaust and disengage from an enemy.',
    rules: 'Test your agility against the enemy\'s evade value. Success exhausts the enemy and disengages you.',
    category: 'gameplay',
  },
  {
    name: 'Fight',
    description: 'Action to attack an engaged enemy.',
    rules: 'Test your combat against the enemy\'s fight value. Success deals damage equal to your weapon\'s damage.',
    category: 'gameplay',
  },
  {
    name: 'Investigate',
    description: 'Action to discover clues at your location.',
    rules: 'Test your intellect against the location\'s shroud. Success lets you discover 1 clue.',
    category: 'gameplay',
  },
  {
    name: 'Parley',
    description: 'Action to interact with certain enemies or story cards through negotiation.',
    rules: 'Parley actions are defined on specific cards and usually involve a skill test.',
    category: 'gameplay',
  },
  {
    name: 'Move',
    description: 'Action to travel to a connected location.',
    rules: 'You can move to any revealed location connected to your current location.',
    category: 'gameplay',
  },
  {
    name: 'Resource',
    description: 'Currency used to play cards and activate abilities.',
    rules: 'You gain 1 resource during upkeep. Resources are spent to pay card costs.',
    category: 'gameplay',
  },
  {
    name: 'Exhaust',
    description: 'Turn a card sideways to indicate it has been used.',
    rules: 'Exhausted cards cannot be exhausted again until they ready during the upkeep phase.',
    category: 'gameplay',
  },
  {
    name: 'Ready',
    description: 'Return an exhausted card to its upright position.',
    rules: 'All exhausted cards ready during the upkeep phase unless an effect says otherwise.',
    category: 'gameplay',
  },
  {
    name: 'Charges',
    description: 'A type of Uses token, typically found on Spell assets.',
    rules: 'Charges are spent to activate spell abilities. When depleted, the spell is usually discarded.',
    category: 'gameplay',
  },
  {
    name: 'Ammo',
    description: 'A type of Uses token, typically found on Firearm assets.',
    rules: 'Ammo is spent when attacking with firearms. When depleted, you can no longer use the weapon\'s ability.',
    category: 'gameplay',
  },
  {
    name: 'Secrets',
    description: 'A type of Uses token, typically found on Tome and Seeker assets.',
    rules: 'Secrets are spent to activate research and knowledge-based abilities.',
    category: 'gameplay',
  },
  {
    name: 'Supplies',
    description: 'A type of Uses token, typically found on survival and tool assets.',
    rules: 'Supplies are spent to activate practical tool abilities.',
    category: 'gameplay',
  },
  {
    name: 'Attack of Opportunity',
    description: 'An enemy attacks you when you take certain actions while engaged.',
    rules: 'Moving, playing cards, or activating non-Fight/Evade abilities while engaged provokes attacks of opportunity.',
    category: 'gameplay',
  },
  {
    name: 'Weakness',
    description: 'Detrimental cards that hinder your investigator.',
    rules: 'Weaknesses cannot be optionally discarded and often have negative effects when drawn.',
    category: 'gameplay',
  },
  {
    name: 'Treachery',
    description: 'Encounter cards with harmful effects that resolve when drawn.',
    rules: 'Treacheries have revelation effects and may attach to investigators or locations.',
    category: 'gameplay',
  },
  {
    name: 'Enemy',
    description: 'Encounter cards representing hostile creatures and foes.',
    rules: 'Enemies spawn at locations, engage investigators, and attack during the enemy phase.',
    category: 'gameplay',
  },
  {
    name: 'Location',
    description: 'Cards representing places investigators can explore.',
    rules: 'Locations have shroud values for investigating and may have special abilities.',
    category: 'gameplay',
  },
  {
    name: 'Skill Test',
    description: 'The core resolution mechanic using chaos tokens.',
    rules: 'Add your skill value + committed card icons + chaos token modifier. Meet or exceed difficulty to succeed.',
    category: 'gameplay',
  },
  {
    name: 'Commit',
    description: 'Add cards from your hand to a skill test for their icons.',
    rules: 'Committed cards are discarded after the test. Each matching icon adds +1 to your skill value.',
    category: 'gameplay',
  },
  {
    name: 'Elite',
    description: 'Enemy that cannot be defeated by card effects that automatically defeat.',
    rules: 'Elite enemies must be defeated through damage. Effects that say "defeat" don\'t work on them.',
    category: 'gameplay',
  },
  {
    name: 'Unique',
    description: 'Only one copy of this card can be in play at a time.',
    rules: 'Indicated by a star before the card name. If a second copy would enter play, it\'s discarded instead.',
    category: 'gameplay',
  },
  {
    name: 'Slot',
    description: 'Equipment slots that limit how many assets you can have in play.',
    rules: 'Slots include: Hand (x2), Arcane (x2), Accessory, Body, Ally, and Tarot.',
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
