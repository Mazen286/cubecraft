import type { GameConfig, DeckZone, ExportFormat, FilterGroup, PileViewConfig } from '../gameConfig';
import type { Card } from '../../types/card';

/**
 * Hearthstone Card Attributes
 */
export interface HearthstoneCardAttributes {
  cost?: number;        // Mana cost
  attack?: number;      // Attack (minions/weapons)
  health?: number;      // Health (minions) or Durability (weapons)
  cardClass?: string;   // MAGE, WARRIOR, NEUTRAL, etc.
  rarity?: string;      // COMMON, RARE, EPIC, LEGENDARY, FREE
  cardType?: string;    // MINION, SPELL, WEAPON, HERO
  mechanics?: string[]; // Battlecry, Deathrattle, Taunt, etc.
  dbfId?: number;       // Database ID (needed for deck codes)
  set?: string;         // Card set
}

/**
 * Hearthstone Classes
 */
export const HEARTHSTONE_CLASSES = [
  'NEUTRAL',
  'DEATHKNIGHT',
  'DEMONHUNTER',
  'DRUID',
  'HUNTER',
  'MAGE',
  'PALADIN',
  'PRIEST',
  'ROGUE',
  'SHAMAN',
  'WARLOCK',
  'WARRIOR',
] as const;

/**
 * Hero dbfIds for deck code generation (Classic heroes)
 */
export const HERO_DBF_IDS: Record<string, number> = {
  DEATHKNIGHT: 78065,
  DEMONHUNTER: 56550,
  DRUID: 274,
  HUNTER: 31,
  MAGE: 637,
  PALADIN: 671,
  PRIEST: 813,
  ROGUE: 930,
  SHAMAN: 1066,
  WARLOCK: 893,
  WARRIOR: 7,
};

/**
 * Class display names and colors
 */
export const CLASS_COLORS: Record<string, string> = {
  NEUTRAL: '#808080',
  DEATHKNIGHT: '#C41E3A',
  DEMONHUNTER: '#A330C9',
  DRUID: '#FF7C0A',
  HUNTER: '#AAD372',
  MAGE: '#3FC7EB',
  PALADIN: '#F48CBA',
  PRIEST: '#FFFFFF',
  ROGUE: '#FFF468',
  SHAMAN: '#0070DD',
  WARLOCK: '#8788EE',
  WARRIOR: '#C69B6D',
};

/**
 * Card type checks
 */
function isMinion(card: Card): boolean {
  const attrs = card.attributes as HearthstoneCardAttributes | undefined;
  return attrs?.cardType === 'MINION';
}

function isSpell(card: Card): boolean {
  const attrs = card.attributes as HearthstoneCardAttributes | undefined;
  return attrs?.cardType === 'SPELL';
}

function isWeapon(card: Card): boolean {
  const attrs = card.attributes as HearthstoneCardAttributes | undefined;
  return attrs?.cardType === 'WEAPON';
}

function isHeroCard(card: Card): boolean {
  const attrs = card.attributes as HearthstoneCardAttributes | undefined;
  return attrs?.cardType === 'HERO';
}

function isNeutral(card: Card): boolean {
  const attrs = card.attributes as HearthstoneCardAttributes | undefined;
  return attrs?.cardClass === 'NEUTRAL';
}

function getCardClass(card: Card): string {
  const attrs = card.attributes as HearthstoneCardAttributes | undefined;
  return attrs?.cardClass || 'NEUTRAL';
}

function getManaCost(card: Card): number | undefined {
  const attrs = card.attributes as HearthstoneCardAttributes | undefined;
  return attrs?.cost;
}

/**
 * Varint encoding for deck codes
 */
function encodeVarint(value: number): number[] {
  const bytes: number[] = [];
  while (value > 127) {
    bytes.push((value & 0x7F) | 0x80);
    value = value >>> 7;
  }
  bytes.push(value);
  return bytes;
}

/**
 * Generate Hearthstone deck code
 */
function generateDeckCode(cards: Card[], heroClass: string): string {
  const heroDbfId = HERO_DBF_IDS[heroClass] || HERO_DBF_IDS.MAGE;

  // Count card occurrences and get dbfIds
  const cardCounts = new Map<number, number>();
  for (const card of cards) {
    const attrs = card.attributes as HearthstoneCardAttributes | undefined;
    const dbfId = attrs?.dbfId;
    if (dbfId) {
      cardCounts.set(dbfId, (cardCounts.get(dbfId) || 0) + 1);
    }
  }

  // Separate into single, double, and multi-copy cards
  const singleCopy: number[] = [];
  const doubleCopy: number[] = [];
  const multiCopy: [number, number][] = []; // [dbfId, count]

  for (const [dbfId, count] of Array.from(cardCounts.entries())) {
    if (count === 1) {
      singleCopy.push(dbfId);
    } else if (count === 2) {
      doubleCopy.push(dbfId);
    } else {
      multiCopy.push([dbfId, count]);
    }
  }

  // Sort by dbfId for consistency
  singleCopy.sort((a, b) => a - b);
  doubleCopy.sort((a, b) => a - b);
  multiCopy.sort((a, b) => a[0] - b[0]);

  // Build the byte array
  const bytes: number[] = [
    0,  // Reserved byte
    1,  // Version
    1,  // Format: 1 = Wild, 2 = Standard
    1,  // Number of heroes
  ];

  // Hero dbfId
  bytes.push(...encodeVarint(heroDbfId));

  // Single copy cards
  bytes.push(...encodeVarint(singleCopy.length));
  for (const dbfId of singleCopy) {
    bytes.push(...encodeVarint(dbfId));
  }

  // Double copy cards
  bytes.push(...encodeVarint(doubleCopy.length));
  for (const dbfId of doubleCopy) {
    bytes.push(...encodeVarint(dbfId));
  }

  // Multi-copy cards
  bytes.push(...encodeVarint(multiCopy.length));
  for (const [dbfId, count] of multiCopy) {
    bytes.push(...encodeVarint(dbfId));
    bytes.push(...encodeVarint(count));
  }

  // Base64 encode
  const uint8Array = new Uint8Array(bytes);
  const binaryString = Array.from(uint8Array)
    .map(byte => String.fromCharCode(byte))
    .join('');
  return btoa(binaryString);
}

/**
 * Deck zones for Hearthstone (just main deck)
 */
const deckZones: DeckZone[] = [
  {
    id: 'main',
    name: 'Deck',
    minCards: 30,
    maxCards: 30,
    exactCards: 30,
    copyLimit: 2, // 2 copies max (1 for legendary handled by card-level check)
    cardBelongsTo: () => true,
  },
];

/**
 * Export formats for Hearthstone
 */
const exportFormats: ExportFormat[] = [
  {
    id: 'deckcode',
    name: 'Deck Code',
    extension: 'txt',
    generate: (cards, _zones) => {
      // Determine dominant class
      const classCounts = new Map<string, number>();
      for (const card of cards) {
        const cardClass = getCardClass(card);
        if (cardClass !== 'NEUTRAL') {
          classCounts.set(cardClass, (classCounts.get(cardClass) || 0) + 1);
        }
      }

      // Find the class with most cards
      let dominantClass = 'MAGE';
      let maxCount = 0;
      for (const [cls, count] of Array.from(classCounts.entries())) {
        if (count > maxCount) {
          maxCount = count;
          dominantClass = cls;
        }
      }

      const deckCode = generateDeckCode(cards, dominantClass);
      return `### CubeCraft Draft Deck\n# Class: ${dominantClass}\n# Format: Wild\n#\n${deckCode}\n#\n# Generated by CubeCraft`;
    },
  },
  {
    id: 'list',
    name: 'Card List',
    extension: 'txt',
    generate: (cards) => {
      // Group by card name and count
      const cardCounts = new Map<string, number>();
      for (const card of cards) {
        cardCounts.set(card.name, (cardCounts.get(card.name) || 0) + 1);
      }

      // Sort alphabetically
      const sortedCards = Array.from(cardCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));

      return sortedCards.map(([name, count]) => `${count}x ${name}`).join('\n');
    },
  },
];

/**
 * Filter groups for Hearthstone
 */
const filterGroups: FilterGroup[] = [
  {
    id: 'cardType',
    label: 'Type',
    type: 'multi-select',
    options: [
      { id: 'minion', label: 'Minion', filter: isMinion },
      { id: 'spell', label: 'Spell', filter: isSpell },
      { id: 'weapon', label: 'Weapon', filter: isWeapon },
      { id: 'hero', label: 'Hero', filter: isHeroCard },
    ],
  },
  {
    id: 'cardClass',
    label: 'Class',
    type: 'multi-select',
    options: HEARTHSTONE_CLASSES.map(cls => ({
      id: cls.toLowerCase(),
      label: cls.charAt(0) + cls.slice(1).toLowerCase(),
      shortLabel: cls.slice(0, 2),
      color: CLASS_COLORS[cls],
      filter: (card: Card) => getCardClass(card) === cls,
    })),
  },
  {
    id: 'rarity',
    label: 'Rarity',
    type: 'multi-select',
    options: [
      { id: 'free', label: 'Free', color: '#9d9d9d', filter: (card) => (card.attributes as HearthstoneCardAttributes)?.rarity === 'FREE' },
      { id: 'common', label: 'Common', color: '#ffffff', filter: (card) => (card.attributes as HearthstoneCardAttributes)?.rarity === 'COMMON' },
      { id: 'rare', label: 'Rare', color: '#0070dd', filter: (card) => (card.attributes as HearthstoneCardAttributes)?.rarity === 'RARE' },
      { id: 'epic', label: 'Epic', color: '#a335ee', filter: (card) => (card.attributes as HearthstoneCardAttributes)?.rarity === 'EPIC' },
      { id: 'legendary', label: 'Legendary', color: '#ff8000', filter: (card) => (card.attributes as HearthstoneCardAttributes)?.rarity === 'LEGENDARY' },
    ],
  },
  {
    id: 'manaCost',
    label: 'Mana Cost',
    type: 'range',
    rangeConfig: {
      min: 0,
      max: 10,
      step: 1,
      getValue: (card) => getManaCost(card),
      formatValue: (value) => value >= 10 ? '10+' : String(value),
    },
  },
];

/**
 * Pile view configuration - group by mana cost
 */
const pileViewConfig: PileViewConfig = {
  groups: [
    { id: '0', label: '0', matches: (card) => getManaCost(card) === 0, order: 0 },
    { id: '1', label: '1', matches: (card) => getManaCost(card) === 1, order: 1 },
    { id: '2', label: '2', matches: (card) => getManaCost(card) === 2, order: 2 },
    { id: '3', label: '3', matches: (card) => getManaCost(card) === 3, order: 3 },
    { id: '4', label: '4', matches: (card) => getManaCost(card) === 4, order: 4 },
    { id: '5', label: '5', matches: (card) => getManaCost(card) === 5, order: 5 },
    { id: '6', label: '6', matches: (card) => getManaCost(card) === 6, order: 6 },
    { id: '7+', label: '7+', matches: (card) => (getManaCost(card) ?? 0) >= 7, order: 7 },
  ],
};

/**
 * Hearthstone game configuration
 */
export const hearthstoneConfig: GameConfig = {
  id: 'hearthstone',
  name: 'Hearthstone',
  shortName: 'HS',

  theme: {
    primaryColor: '#FFB700', // Hearthstone gold
    accentColor: '#4A3C2D',  // Brown
    cardBackImage: '/card-backs/hearthstone.jpg',
    backgroundColor: '#1a1612',
  },

  cardDisplay: {
    primaryStats: [
      {
        label: 'ATK',
        getValue: (card) => {
          const attrs = card.attributes as HearthstoneCardAttributes | undefined;
          return attrs?.attack !== undefined ? String(attrs.attack) : '';
        },
        color: 'text-yellow-400',
      },
      {
        label: 'HP',
        getValue: (card) => {
          const attrs = card.attributes as HearthstoneCardAttributes | undefined;
          return attrs?.health !== undefined ? String(attrs.health) : '';
        },
        color: 'text-red-400',
      },
    ],
    secondaryInfo: [
      {
        label: 'Cost',
        getValue: (card) => {
          const attrs = card.attributes as HearthstoneCardAttributes | undefined;
          return attrs?.cost !== undefined ? `${attrs.cost} Mana` : '';
        },
      },
      {
        label: 'Class',
        getValue: (card) => {
          const cls = getCardClass(card);
          return cls.charAt(0) + cls.slice(1).toLowerCase();
        },
      },
    ],
    indicators: [
      {
        show: (card) => !isNeutral(card),
        color: 'bg-amber-500',
        tooltip: 'Class card',
      },
    ],
  },

  deckZones,

  defaultPlayerName: 'Player',

  botNames: [
    // Classic Heroes
    'Jaina', 'Thrall', 'Garrosh', 'Uther', 'Rexxar', 'Malfurion', 'Valeera', 'Gul\'dan', 'Anduin',
    // Alternate Heroes
    'Medivh', 'Alleria', 'Magni', 'Khadgar', 'Lady Liadrin', 'Morgl', 'Tyrande',
    // Legendary Characters
    'Arthas', 'Illidan', 'Ragnaros', 'Sylvanas', 'Dr. Boom', 'Kel\'Thuzad', 'Yogg-Saron',
    // Innkeeper and others
    'Innkeeper', 'Reno', 'Elise', 'Brann', 'Finley', 'Zephrys',
  ],

  cardTypes: ['MINION', 'SPELL', 'WEAPON', 'HERO'],

  cardAttributes: HEARTHSTONE_CLASSES,

  getCardImageUrl: (card, size) => {
    // If card has imageUrl stored, use it (cubes store the full URL)
    if (card.imageUrl) {
      // Swap resolution if needed
      if (size === 'sm' && card.imageUrl.includes('/512x/')) {
        return card.imageUrl.replace('/512x/', '/256x/');
      }
      return card.imageUrl;
    }
    // Fallback: use hsCardId from attributes
    const attrs = card.attributes as HearthstoneCardAttributes & { hsCardId?: string };
    const hsCardId = attrs?.hsCardId || card.id;
    const resolution = size === 'sm' ? '256x' : '512x';
    return `https://art.hearthstonejson.com/v1/render/latest/enUS/${resolution}/${hsCardId}.png`;
  },

  exportFormats,

  cardClassifiers: {
    isCreature: isMinion,
    isSpell: isSpell,
  },

  storageKeyPrefix: 'hs_',

  filterGroups,

  sortOptions: [
    {
      id: 'name',
      label: 'Name',
      compare: (a, b) => a.name.localeCompare(b.name),
    },
    {
      id: 'cost',
      label: 'Mana Cost',
      compare: (a, b) => (getManaCost(a) ?? 0) - (getManaCost(b) ?? 0),
    },
    {
      id: 'rarity',
      label: 'Rarity',
      compare: (a, b) => {
        const rarityOrder = { FREE: 0, COMMON: 1, RARE: 2, EPIC: 3, LEGENDARY: 4 };
        const aRarity = (a.attributes as HearthstoneCardAttributes)?.rarity || 'FREE';
        const bRarity = (b.attributes as HearthstoneCardAttributes)?.rarity || 'FREE';
        return (rarityOrder[aRarity as keyof typeof rarityOrder] || 0) - (rarityOrder[bRarity as keyof typeof rarityOrder] || 0);
      },
    },
  ],

  draftDefaults: {
    playerCount: 4,
    cardsPerPlayer: 45,  // Larger pool for class discovery
    packSize: 15,
    timerSeconds: 60,
  },

  pileViewConfig,

  api: {
    baseUrl: 'https://api.hearthstonejson.com/v1/latest/enUS',
    searchEndpoint: '/cards.json',
  },
};
