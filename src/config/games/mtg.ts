import type { GameConfig, DeckZone, ExportFormat, BasicResource, FilterGroup } from '../gameConfig';
import type { Card } from '../../types/card';

/**
 * MTG card attributes interface
 */
export interface MTGCardAttributes {
  manaCost?: string;
  cmc?: number;
  colors?: string[];
  colorIdentity?: string[];
  power?: number | string;
  toughness?: number | string;
  loyalty?: number;
  rarity?: string;
  setCode?: string;
  collectorNumber?: string;
  scryfallId?: string;
}

/**
 * MTG color names
 */
const MTG_COLORS: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
};

/**
 * Get power/toughness display
 */
function getPTDisplay(card: Card): string {
  const attrs = card.attributes as MTGCardAttributes;
  if (attrs.power === undefined || attrs.toughness === undefined) return '';
  return `${attrs.power}/${attrs.toughness}`;
}

/**
 * Get mana cost display
 */
function getManaCostDisplay(card: Card): string {
  const attrs = card.attributes as MTGCardAttributes;
  return attrs.manaCost || '';
}

/**
 * Get colors display
 */
function getColorsDisplay(card: Card): string {
  const attrs = card.attributes as MTGCardAttributes;
  if (!attrs.colors || attrs.colors.length === 0) return 'Colorless';
  return attrs.colors.map(c => MTG_COLORS[c] || c).join('/');
}

/**
 * Check if card is a creature
 */
function isCreature(card: Card): boolean {
  return card.type.toLowerCase().includes('creature');
}

/**
 * Check if card is a spell (instant/sorcery)
 */
function isSpell(card: Card): boolean {
  const type = card.type.toLowerCase();
  return type.includes('instant') || type.includes('sorcery');
}

/**
 * Check if card is a land
 */
function isLand(card: Card): boolean {
  return card.type.toLowerCase().includes('land');
}

/**
 * Check if card is an artifact
 */
function isArtifact(card: Card): boolean {
  return card.type.toLowerCase().includes('artifact');
}

/**
 * Check if card is an enchantment
 */
function isEnchantment(card: Card): boolean {
  return card.type.toLowerCase().includes('enchantment');
}

/**
 * Check if card is a planeswalker
 */
function isPlaneswalker(card: Card): boolean {
  return card.type.toLowerCase().includes('planeswalker');
}

/**
 * Check if card is an instant
 */
function isInstant(card: Card): boolean {
  return card.type.toLowerCase().includes('instant');
}

/**
 * Check if card is a sorcery
 */
function isSorcery(card: Card): boolean {
  return card.type.toLowerCase().includes('sorcery');
}

/**
 * Color check helpers
 */
function hasColor(card: Card, color: string): boolean {
  const attrs = card.attributes as MTGCardAttributes;
  return attrs.colors?.includes(color) ?? false;
}

function isColorless(card: Card): boolean {
  const attrs = card.attributes as MTGCardAttributes;
  return !attrs.colors || attrs.colors.length === 0;
}

function isMulticolor(card: Card): boolean {
  const attrs = card.attributes as MTGCardAttributes;
  return (attrs.colors?.length ?? 0) > 1;
}

/**
 * Generate MTG Arena format export
 */
function generateArenaFormat(cards: Card[]): string {
  const counts = new Map<string, number>();
  for (const card of cards) {
    const name = card.name;
    counts.set(name, (counts.get(name) || 0) + 1);
  }

  const lines: string[] = [];
  for (const [name, count] of counts) {
    lines.push(`${count} ${name}`);
  }
  return lines.join('\n');
}

/**
 * Generate MTGO format export
 */
function generateMTGOFormat(cards: Card[]): string {
  const counts = new Map<string, number>();
  for (const card of cards) {
    const name = card.name;
    counts.set(name, (counts.get(name) || 0) + 1);
  }

  const lines: string[] = [];
  for (const [name, count] of counts) {
    lines.push(`${count} ${name}`);
  }
  return lines.join('\n');
}

/**
 * MTG card types
 */
export const MTG_CARD_TYPES = [
  'Creature',
  'Instant',
  'Sorcery',
  'Enchantment',
  'Artifact',
  'Planeswalker',
  'Land',
] as const;

/**
 * Bot names for MTG
 */
const MTG_BOT_NAMES = [
  'Jace Bot', 'Liliana Bot', 'Chandra Bot', 'Nissa Bot',
  'Gideon Bot', 'Ajani Bot', 'Sorin Bot', 'Elspeth Bot',
];

/**
 * MTG Filter Groups for advanced filtering
 */
const mtgFilterGroups: FilterGroup[] = [
  {
    id: 'colors',
    label: 'Colors',
    type: 'multi-select',
    options: [
      { id: 'W', label: 'White', shortLabel: 'W', color: '#F9FAF4', filter: (c) => hasColor(c, 'W') },
      { id: 'U', label: 'Blue', shortLabel: 'U', color: '#0E68AB', filter: (c) => hasColor(c, 'U') },
      { id: 'B', label: 'Black', shortLabel: 'B', color: '#150B00', filter: (c) => hasColor(c, 'B') },
      { id: 'R', label: 'Red', shortLabel: 'R', color: '#D3202A', filter: (c) => hasColor(c, 'R') },
      { id: 'G', label: 'Green', shortLabel: 'G', color: '#00733E', filter: (c) => hasColor(c, 'G') },
      { id: 'C', label: 'Colorless', shortLabel: 'C', color: '#A0A0A0', filter: isColorless },
      { id: 'M', label: 'Multicolor', shortLabel: 'M', color: '#CFB53B', filter: isMulticolor },
    ],
  },
  {
    id: 'cardTypes',
    label: 'Card Type',
    type: 'multi-select',
    options: [
      { id: 'creature', label: 'Creature', filter: isCreature },
      { id: 'instant', label: 'Instant', filter: isInstant },
      { id: 'sorcery', label: 'Sorcery', filter: isSorcery },
      { id: 'enchantment', label: 'Enchantment', filter: isEnchantment },
      { id: 'artifact', label: 'Artifact', filter: isArtifact },
      { id: 'planeswalker', label: 'Planeswalker', filter: isPlaneswalker },
      { id: 'land', label: 'Land', filter: isLand },
    ],
  },
  {
    id: 'cmc',
    label: 'Mana Value',
    type: 'range',
    rangeConfig: {
      min: 0,
      max: 16,
      step: 1,
      getValue: (card) => (card.attributes as MTGCardAttributes).cmc,
      formatValue: (v) => v.toString(),
    },
  },
];

/**
 * Export formats for MTG
 */
const mtgExportFormats: ExportFormat[] = [
  {
    id: 'arena',
    name: 'MTG Arena',
    extension: '.txt',
    generate: generateArenaFormat,
  },
  {
    id: 'mtgo',
    name: 'MTGO',
    extension: '.dec',
    generate: generateMTGOFormat,
  },
];

/**
 * Basic lands - freely available after drafting
 * Using Scryfall IDs for stable image URLs
 */
const mtgBasicLands: BasicResource[] = [
  {
    id: 'plains',
    name: 'Plains',
    type: 'Basic Land — Plains',
    description: '({T}: Add {W}.)',
    imageUrl: 'https://cards.scryfall.io/normal/front/f/c/fcabc17c-67ed-4865-befd-df53a9ca0a45.jpg',
    attributes: {
      manaCost: '',
      cmc: 0,
      colors: [],
      colorIdentity: ['W'],
      rarity: 'common',
      scryfallId: 'fcabc17c-67ed-4865-befd-df53a9ca0a45',
    },
  },
  {
    id: 'island',
    name: 'Island',
    type: 'Basic Land — Island',
    description: '({T}: Add {U}.)',
    imageUrl: 'https://cards.scryfall.io/normal/front/6/3/636c60e5-7a06-4cbc-bf51-0e4eb8d3c3c4.jpg',
    attributes: {
      manaCost: '',
      cmc: 0,
      colors: [],
      colorIdentity: ['U'],
      rarity: 'common',
      scryfallId: '636c60e5-7a06-4cbc-bf51-0e4eb8d3c3c4',
    },
  },
  {
    id: 'swamp',
    name: 'Swamp',
    type: 'Basic Land — Swamp',
    description: '({T}: Add {B}.)',
    imageUrl: 'https://cards.scryfall.io/normal/front/8/7/87173c55-25a6-4a4e-9d6b-1c7e3bb9e59b.jpg',
    attributes: {
      manaCost: '',
      cmc: 0,
      colors: [],
      colorIdentity: ['B'],
      rarity: 'common',
      scryfallId: '87173c55-25a6-4a4e-9d6b-1c7e3bb9e59b',
    },
  },
  {
    id: 'mountain',
    name: 'Mountain',
    type: 'Basic Land — Mountain',
    description: '({T}: Add {R}.)',
    imageUrl: 'https://cards.scryfall.io/normal/front/6/6/66fd2d3d-0ec3-4f96-b7ed-d880d24c3a0c.jpg',
    attributes: {
      manaCost: '',
      cmc: 0,
      colors: [],
      colorIdentity: ['R'],
      rarity: 'common',
      scryfallId: '66fd2d3d-0ec3-4f96-b7ed-d880d24c3a0c',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    type: 'Basic Land — Forest',
    description: '({T}: Add {G}.)',
    imageUrl: 'https://cards.scryfall.io/normal/front/3/c/3cf23791-1b15-43ee-b81a-5fe068709bc1.jpg',
    attributes: {
      manaCost: '',
      cmc: 0,
      colors: [],
      colorIdentity: ['G'],
      rarity: 'common',
      scryfallId: '3cf23791-1b15-43ee-b81a-5fe068709bc1',
    },
  },
];

/**
 * Deck zones for MTG (single main deck for draft)
 */
const mtgDeckZones: DeckZone[] = [
  {
    id: 'main',
    name: 'Main Deck',
    minCards: 40,
    maxCards: undefined,
    cardBelongsTo: () => true,
  },
  {
    id: 'side',
    name: 'Sideboard',
    minCards: 0,
    maxCards: 15,
    cardBelongsTo: () => false, // Cards must be manually moved here
  },
];

/**
 * MTG game configuration
 */
export const mtgConfig: GameConfig = {
  id: 'mtg',
  name: 'Magic: The Gathering',
  shortName: 'MTG',

  theme: {
    primaryColor: '#b91c1c',  // red-700
    accentColor: '#1e3a8a',   // blue-800
    cardBackImage: '/images/mtg-card-back.jpg',
    backgroundColor: '#0f172a',
  },

  cardDisplay: {
    primaryStats: [
      {
        label: 'P/T',
        getValue: getPTDisplay,
        color: 'text-white',
      },
    ],
    secondaryInfo: [
      {
        label: 'Mana',
        getValue: getManaCostDisplay,
        color: 'text-yellow-300',
      },
      {
        label: 'Colors',
        getValue: getColorsDisplay,
        color: 'text-gray-300',
      },
    ],
    indicators: [],
    detailFields: [
      {
        label: 'CMC',
        getValue: (card) => String((card.attributes as MTGCardAttributes).cmc ?? ''),
        color: 'text-blue-400',
      },
      {
        label: 'Rarity',
        getValue: (card) => (card.attributes as MTGCardAttributes).rarity || '',
        color: 'text-purple-400',
      },
    ],
  },

  deckZones: mtgDeckZones,

  defaultPlayerName: 'Planeswalker',
  botNames: MTG_BOT_NAMES,

  cardTypes: MTG_CARD_TYPES,

  getCardImageUrl: (card, size) => {
    // Prefer stored imageUrl from API if available
    if (card.imageUrl) {
      return card.imageUrl;
    }

    // Fallback to constructing URL from scryfallId
    const attrs = card.attributes as MTGCardAttributes;
    const scryfallId = attrs.scryfallId;

    if (!scryfallId) {
      // Fallback - no image available
      return '';
    }

    // Scryfall image URL format:
    // https://cards.scryfall.io/{size}/front/{a}/{b}/{scryfallId}.jpg
    const a = scryfallId.charAt(0);
    const b = scryfallId.charAt(1);

    const sizeMap: Record<string, string> = {
      sm: 'small',
      md: 'normal',
      lg: 'large',
    };
    const scryfallSize = sizeMap[size] || 'normal';

    return `https://cards.scryfall.io/${scryfallSize}/front/${a}/${b}/${scryfallId}.jpg`;
  },

  exportFormats: mtgExportFormats,

  cardClassifiers: {
    isCreature: isCreature,
    isSpell: isSpell,
    isLand: isLand,
  },

  storageKeyPrefix: 'mtg-draft',

  basicResources: mtgBasicLands,

  filterOptions: [
    { id: 'all', label: 'All Cards', filter: () => true },
    { id: 'creatures', label: 'Creatures', filter: isCreature },
    { id: 'spells', label: 'Spells', filter: isSpell },
    { id: 'lands', label: 'Lands', filter: isLand },
  ],

  filterGroups: mtgFilterGroups,

  sortOptions: [
    { id: 'name', label: 'Name', compare: (a, b) => a.name.localeCompare(b.name) },
    { id: 'type', label: 'Type', compare: (a, b) => a.type.localeCompare(b.type) },
    {
      id: 'cmc',
      label: 'Mana Value',
      compare: (a, b) => {
        const aCmc = (a.attributes as MTGCardAttributes).cmc || 0;
        const bCmc = (b.attributes as MTGCardAttributes).cmc || 0;
        return aCmc - bCmc;
      },
    },
    {
      id: 'score',
      label: 'Score',
      compare: (a, b) => (b.score ?? 0) - (a.score ?? 0),
    },
  ],

  api: {
    baseUrl: 'https://api.scryfall.com',
    searchEndpoint: '/cards/search',
    getCardEndpoint: (cardId) => `/cards/${cardId}`,
  },
};

// Re-export helper functions
export { isCreature, isSpell, isLand };
