/**
 * MTG Keyword Glossary
 * Definitions for common Magic: The Gathering keywords
 * Used to display tooltips in card descriptions
 */

export interface KeywordDefinition {
  name: string;
  reminder: string;
  category: 'evergreen' | 'deciduous' | 'ability-word' | 'keyword-action' | 'other';
}

/**
 * Comprehensive MTG keyword definitions
 * Sorted by most common usage in cube/limited formats
 */
export const MTG_KEYWORDS: Record<string, KeywordDefinition> = {
  // === EVERGREEN KEYWORDS (always available) ===
  'flying': {
    name: 'Flying',
    reminder: 'This creature can only be blocked by creatures with flying or reach.',
    category: 'evergreen',
  },
  'first strike': {
    name: 'First Strike',
    reminder: 'This creature deals combat damage before creatures without first strike.',
    category: 'evergreen',
  },
  'double strike': {
    name: 'Double Strike',
    reminder: 'This creature deals both first-strike and regular combat damage.',
    category: 'evergreen',
  },
  'deathtouch': {
    name: 'Deathtouch',
    reminder: 'Any amount of damage this deals to a creature is enough to destroy it.',
    category: 'evergreen',
  },
  'haste': {
    name: 'Haste',
    reminder: 'This creature can attack and tap as soon as it comes under your control.',
    category: 'evergreen',
  },
  'hexproof': {
    name: 'Hexproof',
    reminder: "This can't be the target of spells or abilities your opponents control.",
    category: 'evergreen',
  },
  'indestructible': {
    name: 'Indestructible',
    reminder: "Effects that say \"destroy\" don't destroy this. Damage doesn't destroy it.",
    category: 'evergreen',
  },
  'lifelink': {
    name: 'Lifelink',
    reminder: 'Damage dealt by this creature also causes you to gain that much life.',
    category: 'evergreen',
  },
  'menace': {
    name: 'Menace',
    reminder: "This creature can't be blocked except by two or more creatures.",
    category: 'evergreen',
  },
  'reach': {
    name: 'Reach',
    reminder: 'This creature can block creatures with flying.',
    category: 'evergreen',
  },
  'trample': {
    name: 'Trample',
    reminder: 'This creature can deal excess combat damage to the defending player or planeswalker.',
    category: 'evergreen',
  },
  'vigilance': {
    name: 'Vigilance',
    reminder: "Attacking doesn't cause this creature to tap.",
    category: 'evergreen',
  },
  'defender': {
    name: 'Defender',
    reminder: "This creature can't attack.",
    category: 'evergreen',
  },
  'flash': {
    name: 'Flash',
    reminder: 'You may cast this spell any time you could cast an instant.',
    category: 'evergreen',
  },
  'ward': {
    name: 'Ward',
    reminder: 'Whenever this becomes the target of a spell or ability an opponent controls, counter it unless that player pays the ward cost.',
    category: 'evergreen',
  },

  // === DECIDUOUS KEYWORDS (used when needed) ===
  'protection': {
    name: 'Protection',
    reminder: "This can't be blocked, targeted, dealt damage, enchanted, or equipped by sources of the specified quality.",
    category: 'deciduous',
  },
  'equip': {
    name: 'Equip',
    reminder: 'Pay the equip cost to attach this Equipment to target creature you control. Equip only as a sorcery.',
    category: 'deciduous',
  },
  'cycling': {
    name: 'Cycling',
    reminder: 'Pay the cycling cost and discard this card to draw a card.',
    category: 'deciduous',
  },
  'kicker': {
    name: 'Kicker',
    reminder: 'You may pay an additional cost as you cast this spell for an enhanced effect.',
    category: 'deciduous',
  },
  'flashback': {
    name: 'Flashback',
    reminder: 'You may cast this card from your graveyard for its flashback cost, then exile it.',
    category: 'deciduous',
  },
  'affinity': {
    name: 'Affinity',
    reminder: 'This spell costs {1} less to cast for each permanent of the specified type you control.',
    category: 'deciduous',
  },
  'convoke': {
    name: 'Convoke',
    reminder: 'Your creatures can help cast this spell. Each creature you tap while casting this spell pays for {1} or one mana of that creature\'s color.',
    category: 'deciduous',
  },
  'delve': {
    name: 'Delve',
    reminder: 'Each card you exile from your graveyard while casting this spell pays for {1}.',
    category: 'deciduous',
  },
  'prowess': {
    name: 'Prowess',
    reminder: 'Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.',
    category: 'deciduous',
  },
  'scry': {
    name: 'Scry',
    reminder: 'Look at the top N cards of your library, then put any number of them on the bottom and the rest on top in any order.',
    category: 'deciduous',
  },
  'cascade': {
    name: 'Cascade',
    reminder: 'When you cast this spell, exile cards from the top of your library until you exile a nonland card with lesser mana value. You may cast it without paying its mana cost.',
    category: 'deciduous',
  },

  // === COMMON SET MECHANICS ===
  'adventure': {
    name: 'Adventure',
    reminder: 'Cast this as an Adventure from your hand. After it resolves, exile it. You may cast the creature later from exile.',
    category: 'other',
  },
  'transform': {
    name: 'Transform',
    reminder: 'Turn this card over to its other face.',
    category: 'other',
  },
  'morph': {
    name: 'Morph',
    reminder: 'You may cast this face down as a 2/2 creature for {3}. Turn it face up any time for its morph cost.',
    category: 'other',
  },
  'megamorph': {
    name: 'Megamorph',
    reminder: 'You may cast this face down as a 2/2 for {3}. Turn it face up for its megamorph cost and put a +1/+1 counter on it.',
    category: 'other',
  },
  'madness': {
    name: 'Madness',
    reminder: 'If you discard this card, you may cast it for its madness cost instead of putting it into your graveyard.',
    category: 'other',
  },
  'suspend': {
    name: 'Suspend',
    reminder: 'Rather than cast this from your hand, pay its suspend cost and exile it with time counters. At the beginning of your upkeep, remove a time counter. When the last is removed, cast it without paying its mana cost.',
    category: 'other',
  },
  'evoke': {
    name: 'Evoke',
    reminder: 'You may cast this spell for its evoke cost. If you do, sacrifice it when it enters the battlefield.',
    category: 'other',
  },
  'echo': {
    name: 'Echo',
    reminder: 'At the beginning of your upkeep, if this came under your control since the beginning of your last upkeep, sacrifice it unless you pay its echo cost.',
    category: 'other',
  },
  'unearth': {
    name: 'Unearth',
    reminder: 'Pay the unearth cost to return this from your graveyard to the battlefield. It gains haste. Exile it at end of turn or if it would leave the battlefield.',
    category: 'other',
  },
  'persist': {
    name: 'Persist',
    reminder: 'When this creature dies, if it had no -1/-1 counters on it, return it to the battlefield with a -1/-1 counter on it.',
    category: 'other',
  },
  'undying': {
    name: 'Undying',
    reminder: 'When this creature dies, if it had no +1/+1 counters on it, return it to the battlefield with a +1/+1 counter on it.',
    category: 'other',
  },
  'wither': {
    name: 'Wither',
    reminder: 'This deals damage to creatures in the form of -1/-1 counters.',
    category: 'other',
  },
  'infect': {
    name: 'Infect',
    reminder: 'This deals damage to creatures as -1/-1 counters and to players as poison counters.',
    category: 'other',
  },
  'annihilator': {
    name: 'Annihilator',
    reminder: 'Whenever this creature attacks, defending player sacrifices that many permanents.',
    category: 'other',
  },
  'exalted': {
    name: 'Exalted',
    reminder: 'Whenever a creature you control attacks alone, it gets +1/+1 until end of turn.',
    category: 'other',
  },
  'extort': {
    name: 'Extort',
    reminder: 'Whenever you cast a spell, you may pay {W/B}. If you do, each opponent loses 1 life and you gain that much life.',
    category: 'other',
  },
  'rebound': {
    name: 'Rebound',
    reminder: 'If you cast this from your hand, exile it as it resolves. At the beginning of your next upkeep, you may cast it from exile without paying its mana cost.',
    category: 'other',
  },
  'miracle': {
    name: 'Miracle',
    reminder: 'You may cast this card for its miracle cost when you draw it if it\'s the first card you drew this turn.',
    category: 'other',
  },
  'overload': {
    name: 'Overload',
    reminder: 'You may cast this for its overload cost. If you do, change "target" to "each."',
    category: 'other',
  },
  'bestow': {
    name: 'Bestow',
    reminder: 'Cast this for its bestow cost to make it an Aura that enchants a creature. When the creature leaves, this becomes a creature.',
    category: 'other',
  },
  'exploit': {
    name: 'Exploit',
    reminder: 'When this creature enters the battlefield, you may sacrifice a creature.',
    category: 'other',
  },
  'skulk': {
    name: 'Skulk',
    reminder: 'This creature can\'t be blocked by creatures with greater power.',
    category: 'other',
  },
  'embalm': {
    name: 'Embalm',
    reminder: 'Pay the embalm cost and exile this from your graveyard to create a token copy that\'s a white Zombie.',
    category: 'other',
  },
  'eternalize': {
    name: 'Eternalize',
    reminder: 'Pay the eternalize cost and exile this from your graveyard to create a 4/4 black Zombie token copy.',
    category: 'other',
  },
  'afflict': {
    name: 'Afflict',
    reminder: 'Whenever this creature becomes blocked, defending player loses that much life.',
    category: 'other',
  },
  'riot': {
    name: 'Riot',
    reminder: 'This creature enters the battlefield with your choice of a +1/+1 counter or haste.',
    category: 'other',
  },
  'spectacle': {
    name: 'Spectacle',
    reminder: 'You may cast this spell for its spectacle cost if an opponent lost life this turn.',
    category: 'other',
  },
  'escape': {
    name: 'Escape',
    reminder: 'You may cast this from your graveyard for its escape cost, exiling cards from your graveyard.',
    category: 'other',
  },
  'mutate': {
    name: 'Mutate',
    reminder: 'Cast this for its mutate cost to merge it with a non-Human creature you own. They become one creature with all abilities.',
    category: 'other',
  },
  'foretell': {
    name: 'Foretell',
    reminder: 'During your turn, you may pay {2} and exile this from your hand face down. Cast it on a later turn for its foretell cost.',
    category: 'other',
  },
  'disturb': {
    name: 'Disturb',
    reminder: 'You may cast this from your graveyard transformed for its disturb cost.',
    category: 'other',
  },
  'cleave': {
    name: 'Cleave',
    reminder: 'You may cast this for its cleave cost. If you do, remove the words in brackets.',
    category: 'other',
  },
  'connive': {
    name: 'Connive',
    reminder: 'Draw a card, then discard a card. If you discarded a nonland card, put a +1/+1 counter on this creature.',
    category: 'other',
  },
  'blitz': {
    name: 'Blitz',
    reminder: 'Cast this for its blitz cost. It gains haste and "When this dies, draw a card." Sacrifice it at end of turn.',
    category: 'other',
  },
  'casualty': {
    name: 'Casualty',
    reminder: 'As you cast this, you may sacrifice a creature with power N or greater. If you do, copy this spell.',
    category: 'other',
  },

  // === ABILITY WORDS (italicized, no rules meaning) ===
  'landfall': {
    name: 'Landfall',
    reminder: 'Triggers whenever a land enters the battlefield under your control.',
    category: 'ability-word',
  },
  'metalcraft': {
    name: 'Metalcraft',
    reminder: 'Active when you control three or more artifacts.',
    category: 'ability-word',
  },
  'threshold': {
    name: 'Threshold',
    reminder: 'Active when you have seven or more cards in your graveyard.',
    category: 'ability-word',
  },
  'delirium': {
    name: 'Delirium',
    reminder: 'Active when you have four or more card types among cards in your graveyard.',
    category: 'ability-word',
  },
  'revolt': {
    name: 'Revolt',
    reminder: 'Active if a permanent you controlled left the battlefield this turn.',
    category: 'ability-word',
  },
  'raid': {
    name: 'Raid',
    reminder: 'Active if you attacked with a creature this turn.',
    category: 'ability-word',
  },
  'ferocious': {
    name: 'Ferocious',
    reminder: 'Active when you control a creature with power 4 or greater.',
    category: 'ability-word',
  },
  'formidable': {
    name: 'Formidable',
    reminder: 'Active when creatures you control have total power 8 or greater.',
    category: 'ability-word',
  },
  'spell mastery': {
    name: 'Spell Mastery',
    reminder: 'Active when you have two or more instant and/or sorcery cards in your graveyard.',
    category: 'ability-word',
  },
  'constellation': {
    name: 'Constellation',
    reminder: 'Triggers whenever an enchantment enters the battlefield under your control.',
    category: 'ability-word',
  },
  'morbid': {
    name: 'Morbid',
    reminder: 'Active if a creature died this turn.',
    category: 'ability-word',
  },
  'battalion': {
    name: 'Battalion',
    reminder: 'Triggers whenever this creature and at least two other creatures attack.',
    category: 'ability-word',
  },
  'heroic': {
    name: 'Heroic',
    reminder: 'Triggers whenever you cast a spell that targets this creature.',
    category: 'ability-word',
  },
  'magecraft': {
    name: 'Magecraft',
    reminder: 'Triggers whenever you cast or copy an instant or sorcery spell.',
    category: 'ability-word',
  },

  // === KEYWORD ACTIONS ===
  'exile': {
    name: 'Exile',
    reminder: 'Put the card into the exile zone. It\'s removed from the game.',
    category: 'keyword-action',
  },
  'sacrifice': {
    name: 'Sacrifice',
    reminder: 'Move a permanent you control to its owner\'s graveyard. This can\'t be regenerated.',
    category: 'keyword-action',
  },
  'destroy': {
    name: 'Destroy',
    reminder: 'Move a permanent to its owner\'s graveyard.',
    category: 'keyword-action',
  },
  'regenerate': {
    name: 'Regenerate',
    reminder: 'The next time this permanent would be destroyed this turn, instead tap it, remove all damage from it, and remove it from combat.',
    category: 'keyword-action',
  },
  'proliferate': {
    name: 'Proliferate',
    reminder: 'Choose any number of permanents and/or players with counters on them, then give each another counter of a kind already there.',
    category: 'keyword-action',
  },
  'populate': {
    name: 'Populate',
    reminder: 'Create a token that\'s a copy of a creature token you control.',
    category: 'keyword-action',
  },
  'investigate': {
    name: 'Investigate',
    reminder: 'Create a colorless Clue artifact token with "{2}, Sacrifice this: Draw a card."',
    category: 'keyword-action',
  },
  'surveil': {
    name: 'Surveil',
    reminder: 'Look at the top N cards of your library. Put any number into your graveyard and the rest on top in any order.',
    category: 'keyword-action',
  },
  'mill': {
    name: 'Mill',
    reminder: 'Put the top N cards of your library into your graveyard.',
    category: 'keyword-action',
  },
  'fight': {
    name: 'Fight',
    reminder: 'Each creature deals damage equal to its power to the other.',
    category: 'keyword-action',
  },
  'fateseal': {
    name: 'Fateseal',
    reminder: 'Look at the top N cards of an opponent\'s library, then put any number on the bottom and the rest on top in any order.',
    category: 'keyword-action',
  },
  'bolster': {
    name: 'Bolster',
    reminder: 'Choose a creature with the least toughness among creatures you control and put N +1/+1 counters on it.',
    category: 'keyword-action',
  },
  'manifest': {
    name: 'Manifest',
    reminder: 'Put the top card of your library onto the battlefield face down as a 2/2 creature. Turn it face up any time for its mana cost if it\'s a creature card.',
    category: 'keyword-action',
  },
  'amass': {
    name: 'Amass',
    reminder: 'Put N +1/+1 counters on an Army you control. If you don\'t control one, create a 0/0 black Zombie Army creature token first.',
    category: 'keyword-action',
  },
  'adapt': {
    name: 'Adapt',
    reminder: 'If this creature has no +1/+1 counters on it, put N +1/+1 counters on it.',
    category: 'keyword-action',
  },
  'explore': {
    name: 'Explore',
    reminder: 'Reveal the top card of your library. Put it into your hand if it\'s a land. Otherwise, put a +1/+1 counter on this creature, then you may put that card in your graveyard.',
    category: 'keyword-action',
  },
  'venture': {
    name: 'Venture',
    reminder: 'Enter the first room of a dungeon or move to the next room. When you complete a dungeon, its final room ability triggers.',
    category: 'keyword-action',
  },
  'learn': {
    name: 'Learn',
    reminder: 'You may reveal a Lesson card from outside the game and put it into your hand, or discard a card to draw a card.',
    category: 'keyword-action',
  },
  'create': {
    name: 'Create',
    reminder: 'Put a token onto the battlefield with the specified characteristics.',
    category: 'keyword-action',
  },
};

/**
 * Get keyword definition by name (case-insensitive)
 */
export function getKeywordDefinition(keyword: string): KeywordDefinition | undefined {
  return MTG_KEYWORDS[keyword.toLowerCase()];
}

/**
 * Check if a word is a known MTG keyword
 */
export function isKeyword(word: string): boolean {
  return word.toLowerCase() in MTG_KEYWORDS;
}

/**
 * Get all evergreen keywords
 */
export function getEvergreenKeywords(): KeywordDefinition[] {
  return Object.values(MTG_KEYWORDS).filter(k => k.category === 'evergreen');
}

/**
 * Get all keywords sorted by category
 */
export function getKeywordsByCategory(): Record<string, KeywordDefinition[]> {
  const result: Record<string, KeywordDefinition[]> = {
    evergreen: [],
    deciduous: [],
    'ability-word': [],
    'keyword-action': [],
    other: [],
  };

  for (const keyword of Object.values(MTG_KEYWORDS)) {
    result[keyword.category].push(keyword);
  }

  return result;
}
