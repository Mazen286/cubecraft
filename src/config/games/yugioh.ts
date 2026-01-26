import type { GameConfig, DeckZone, ExportFormat, FilterGroup } from '../gameConfig';
import type { Card } from '../../types/card';
import type { YuGiOhCardAttributes } from '../../types/card';

/**
 * Extra Deck monster types in Yu-Gi-Oh!
 */
const EXTRA_DECK_TYPES = [
  'Fusion Monster',
  'Synchro Monster',
  'XYZ Monster',
  'Link Monster',
  'Pendulum Effect Fusion Monster',
  'Synchro Pendulum Effect Monster',
  'XYZ Pendulum Effect Monster',
] as const;

/**
 * Check if a card is an Extra Deck card
 */
function isExtraDeckCard(card: Card): boolean {
  return EXTRA_DECK_TYPES.some(t => card.type.includes(t));
}

/**
 * Check if a card is a Monster card
 */
function isMonsterCard(card: Card): boolean {
  return card.type.toLowerCase().includes('monster');
}

/**
 * Check if a card is a Spell card
 */
function isSpellCard(card: Card): boolean {
  return card.type.toLowerCase().includes('spell');
}

/**
 * Check if a card is a Trap card
 */
function isTrapCard(card: Card): boolean {
  return card.type.toLowerCase().includes('trap');
}

/**
 * Monster mechanic checks
 */
function isNormalMonster(card: Card): boolean {
  return card.type.toLowerCase().includes('normal monster');
}

function isEffectMonster(card: Card): boolean {
  return card.type.toLowerCase().includes('effect') && isMonsterCard(card);
}

function isRitualMonster(card: Card): boolean {
  return card.type.toLowerCase().includes('ritual') && isMonsterCard(card);
}

function isFusionMonster(card: Card): boolean {
  return card.type.toLowerCase().includes('fusion');
}

function isSynchroMonster(card: Card): boolean {
  return card.type.toLowerCase().includes('synchro');
}

function isXyzMonster(card: Card): boolean {
  return card.type.toLowerCase().includes('xyz');
}

function isPendulumMonster(card: Card): boolean {
  return card.type.toLowerCase().includes('pendulum');
}

function isLinkMonster(card: Card): boolean {
  return card.type.toLowerCase().includes('link');
}

function isTunerMonster(card: Card): boolean {
  return card.type.toLowerCase().includes('tuner');
}

/**
 * Attribute check helper
 */
function hasAttribute(card: Card, attribute: string): boolean {
  const attrs = card.attributes as YuGiOhCardAttributes | undefined;
  return attrs?.attribute === attribute;
}

/**
 * Race/Type check helper
 */
function hasRace(card: Card, race: string): boolean {
  const attrs = card.attributes as YuGiOhCardAttributes | undefined;
  return attrs?.race === race;
}

/**
 * Get ATK/DEF display string
 */
function getAtkDefDisplay(card: Card): string {
  const attrs = card.attributes as YuGiOhCardAttributes | undefined;
  if (!attrs || attrs.atk === undefined) return '';

  if (attrs.def === undefined) {
    // Link monster - no DEF
    return `${formatStat(attrs.atk)} / LINK`;
  }
  return `${formatStat(attrs.atk)} / ${formatStat(attrs.def)}`;
}

/**
 * Format a stat value (handles undefined, ?, etc.)
 */
function formatStat(value: number | undefined): string {
  if (value === undefined) return '?';
  if (value === -1) return '?';
  return value.toString();
}

/**
 * Get level/rank/link display string
 */
function getLevelDisplay(card: Card): string {
  const attrs = card.attributes as YuGiOhCardAttributes | undefined;
  if (!attrs) return '';

  const level = attrs.level;
  const linkval = attrs.linkval;

  if (linkval !== undefined && linkval > 0) {
    return `Link ${linkval}`;
  }

  if (level === undefined || level === 0) return '';

  if (card.type.includes('XYZ')) {
    return `Rank ${level}`;
  }

  return `Lv ${level}`;
}

/**
 * Generate YDK format export
 * Uses _exportZone attribute if present, otherwise falls back to auto-classification
 */
function generateYDK(cards: Card[], _deckZones: DeckZone[]): string {
  const mainDeck: Card[] = [];
  const extraDeck: Card[] = [];
  const sideDeck: Card[] = [];

  for (const card of cards) {
    const zone = (card.attributes as Record<string, unknown>)?._exportZone as string | undefined;

    if (zone === 'side') {
      sideDeck.push(card);
    } else if (zone === 'extra') {
      extraDeck.push(card);
    } else if (zone === 'main') {
      mainDeck.push(card);
    } else {
      // Fallback: auto-classify based on card type
      if (isExtraDeckCard(card)) {
        extraDeck.push(card);
      } else {
        mainDeck.push(card);
      }
    }
  }

  return `#created by CubeCraft
#main
${mainDeck.map(c => c.id).join('\n')}
#extra
${extraDeck.map(c => c.id).join('\n')}
!side
${sideDeck.map(c => c.id).join('\n')}
`;
}

/**
 * Yu-Gi-Oh! card types
 */
export const YUGIOH_CARD_TYPES = [
  'Normal Monster',
  'Effect Monster',
  'Ritual Monster',
  'Fusion Monster',
  'Synchro Monster',
  'XYZ Monster',
  'Pendulum Monster',
  'Link Monster',
  'Spell Card',
  'Trap Card',
] as const;

/**
 * Yu-Gi-Oh! attributes
 */
export const YUGIOH_ATTRIBUTES = [
  'DARK',
  'DIVINE',
  'EARTH',
  'FIRE',
  'LIGHT',
  'WATER',
  'WIND',
] as const;

/**
 * Yu-Gi-Oh! monster types (races)
 */
export const YUGIOH_MONSTER_TYPES = [
  'Aqua', 'Beast', 'Beast-Warrior', 'Cyberse', 'Dinosaur', 'Divine-Beast',
  'Dragon', 'Fairy', 'Fiend', 'Fish', 'Insect', 'Machine', 'Plant',
  'Psychic', 'Pyro', 'Reptile', 'Rock', 'Sea Serpent', 'Spellcaster',
  'Thunder', 'Warrior', 'Winged Beast', 'Wyrm', 'Zombie',
] as const;

/**
 * Bot names for Yu-Gi-Oh!
 */
const YUGIOH_BOT_NAMES = [
  'Kaiba Bot', 'Yugi Bot', 'Joey Bot', 'Mai Bot',
  'Pegasus Bot', 'Marik Bot', 'Bakura Bot', 'Ishizu Bot',
];

/**
 * Yu-Gi-Oh! Filter Groups for advanced filtering
 */
const yugiohFilterGroups: FilterGroup[] = [
  {
    id: 'monsterType',
    label: 'Monster Type',
    type: 'multi-select',
    options: [
      { id: 'normal', label: 'Normal', color: '#FDE68A', filter: isNormalMonster },
      { id: 'effect', label: 'Effect', color: '#FF8B53', filter: isEffectMonster },
      { id: 'ritual', label: 'Ritual', color: '#9FC5E8', filter: isRitualMonster },
      { id: 'fusion', label: 'Fusion', color: '#A855F7', filter: isFusionMonster },
      { id: 'synchro', label: 'Synchro', color: '#FFFFFF', filter: isSynchroMonster },
      { id: 'xyz', label: 'XYZ', color: '#1F1F1F', filter: isXyzMonster },
      { id: 'pendulum', label: 'Pendulum', color: '#22D3EE', filter: isPendulumMonster },
      { id: 'link', label: 'Link', color: '#3B82F6', filter: isLinkMonster },
      { id: 'tuner', label: 'Tuner', color: '#FBBF24', filter: isTunerMonster },
    ],
  },
  {
    id: 'attribute',
    label: 'Attribute',
    type: 'multi-select',
    options: [
      { id: 'DARK', label: 'DARK', color: '#581C87', filter: (c) => hasAttribute(c, 'DARK') },
      { id: 'LIGHT', label: 'LIGHT', color: '#FEF08A', filter: (c) => hasAttribute(c, 'LIGHT') },
      { id: 'EARTH', label: 'EARTH', color: '#854D0E', filter: (c) => hasAttribute(c, 'EARTH') },
      { id: 'WATER', label: 'WATER', color: '#1D4ED8', filter: (c) => hasAttribute(c, 'WATER') },
      { id: 'FIRE', label: 'FIRE', color: '#DC2626', filter: (c) => hasAttribute(c, 'FIRE') },
      { id: 'WIND', label: 'WIND', color: '#16A34A', filter: (c) => hasAttribute(c, 'WIND') },
      { id: 'DIVINE', label: 'DIVINE', color: '#FBBF24', filter: (c) => hasAttribute(c, 'DIVINE') },
    ],
  },
  {
    id: 'race',
    label: 'Type',
    type: 'multi-select',
    options: YUGIOH_MONSTER_TYPES.map(race => ({
      id: race.toLowerCase().replace(/[- ]/g, '_'),
      label: race,
      filter: (c: Card) => hasRace(c, race),
    })),
  },
  {
    id: 'level',
    label: 'Level/Rank',
    type: 'range',
    rangeConfig: {
      min: 1,
      max: 12,
      step: 1,
      getValue: (card) => (card.attributes as YuGiOhCardAttributes | undefined)?.level,
      formatValue: (v) => `Lv ${v}`,
    },
  },
];

/**
 * Export formats for Yu-Gi-Oh!
 */
const yugiohExportFormats: ExportFormat[] = [
  {
    id: 'ydk',
    name: 'YDK (YGOPro/EDOPro)',
    extension: '.ydk',
    generate: generateYDK,
  },
];

/**
 * Deck zones for Yu-Gi-Oh!
 */
const yugiohDeckZones: DeckZone[] = [
  {
    id: 'main',
    name: 'Main Deck',
    minCards: 40,
    maxCards: 60,
    cardBelongsTo: (card) => !isExtraDeckCard(card),
  },
  {
    id: 'extra',
    name: 'Extra Deck',
    minCards: 0,
    maxCards: 15,
    cardBelongsTo: isExtraDeckCard,
  },
  {
    id: 'side',
    name: 'Side Deck',
    minCards: 0,
    maxCards: 15,
    cardBelongsTo: () => false, // Cards must be manually moved here
  },
];

/**
 * Yu-Gi-Oh! game configuration
 */
export const yugiohConfig: GameConfig = {
  id: 'yugioh',
  name: 'Yu-Gi-Oh!',
  shortName: 'YGO',

  theme: {
    primaryColor: '#fbbf24',  // gold-400
    accentColor: '#7c3aed',   // purple-600
    cardBackImage: '/card-back.jpg',
    backgroundColor: '#0a0a0f',
  },

  cardDisplay: {
    primaryStats: [
      {
        label: 'ATK/DEF',
        getValue: getAtkDefDisplay,
        color: 'text-white',
      },
    ],
    secondaryInfo: [
      {
        label: 'Level',
        getValue: getLevelDisplay,
        color: 'text-yellow-400',
      },
      {
        label: 'Attribute',
        getValue: (card) => (card.attributes as YuGiOhCardAttributes | undefined)?.attribute || '',
        color: 'text-gray-300',
      },
      {
        label: 'Type',
        getValue: (card) => (card.attributes as YuGiOhCardAttributes | undefined)?.race || '',
        color: 'text-gray-400',
      },
    ],
    indicators: [
      {
        show: isExtraDeckCard,
        color: '#7c3aed',  // purple
        tooltip: 'Extra Deck',
      },
    ],
    detailFields: [
      {
        label: 'ATK',
        getValue: (card) => formatStat((card.attributes as YuGiOhCardAttributes | undefined)?.atk),
        color: 'text-red-400',
      },
      {
        label: 'DEF',
        getValue: (card) => {
          const def = (card.attributes as YuGiOhCardAttributes | undefined)?.def;
          return def === undefined ? 'LINK' : formatStat(def);
        },
        color: 'text-blue-400',
      },
    ],
  },

  deckZones: yugiohDeckZones,

  defaultPlayerName: 'Duelist',
  botNames: YUGIOH_BOT_NAMES,

  cardTypes: YUGIOH_CARD_TYPES,
  cardAttributes: YUGIOH_ATTRIBUTES,

  getCardImageUrl: (card, size) => {
    const id = card.id;
    if (size === 'sm') {
      return `/images/cards_small/${id}.jpg`;
    }
    return `/images/cards/${id}.jpg`;
  },

  exportFormats: yugiohExportFormats,

  cardClassifiers: {
    isExtraDeck: isExtraDeckCard,
    isCreature: isMonsterCard,
    isSpell: isSpellCard,
    isTrap: isTrapCard,
  },

  storageKeyPrefix: 'yugioh-draft',

  filterOptions: [
    { id: 'all', label: 'All Cards', filter: () => true },
    { id: 'monsters', label: 'Monsters', filter: isMonsterCard },
    { id: 'spells', label: 'Spells', filter: isSpellCard },
    { id: 'traps', label: 'Traps', filter: isTrapCard },
    { id: 'main', label: 'Main Deck', filter: (c) => !isExtraDeckCard(c) },
    { id: 'extra', label: 'Extra Deck', filter: isExtraDeckCard },
  ],

  filterGroups: yugiohFilterGroups,

  sortOptions: [
    { id: 'name', label: 'Name', compare: (a, b) => a.name.localeCompare(b.name) },
    { id: 'type', label: 'Type', compare: (a, b) => a.type.localeCompare(b.type) },
    {
      id: 'level',
      label: 'Level',
      compare: (a, b) => {
        const aLevel = (a.attributes as YuGiOhCardAttributes | undefined)?.level || 0;
        const bLevel = (b.attributes as YuGiOhCardAttributes | undefined)?.level || 0;
        return bLevel - aLevel;
      },
    },
    {
      id: 'atk',
      label: 'ATK',
      compare: (a, b) => {
        const aAtk = (a.attributes as YuGiOhCardAttributes | undefined)?.atk ?? -1;
        const bAtk = (b.attributes as YuGiOhCardAttributes | undefined)?.atk ?? -1;
        return bAtk - aAtk;
      },
    },
    {
      id: 'def',
      label: 'DEF',
      compare: (a, b) => {
        const aDef = (a.attributes as YuGiOhCardAttributes | undefined)?.def ?? -1;
        const bDef = (b.attributes as YuGiOhCardAttributes | undefined)?.def ?? -1;
        return bDef - aDef;
      },
    },
    {
      id: 'score',
      label: 'Score',
      compare: (a, b) => (b.score ?? 0) - (a.score ?? 0),
    },
  ],

  api: {
    baseUrl: 'https://db.ygoprodeck.com/api/v7',
    searchEndpoint: '/cardinfo.php',
    getCardEndpoint: (cardId) => `/cardinfo.php?id=${cardId}`,
  },
};

// Re-export helper functions for use elsewhere
export { isExtraDeckCard, isMonsterCard, isSpellCard, isTrapCard };
