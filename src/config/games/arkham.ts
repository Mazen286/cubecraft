import type { GameConfig, FilterGroup } from '../gameConfig';
import type { Card } from '../../types/card';
import type { ArkhamFaction } from '../../types/arkham';

/**
 * Type-safe getter for Arkham card attributes
 */
interface ArkhamAttrs {
  code?: string;
  faction_code?: ArkhamFaction;
  faction2_code?: ArkhamFaction;
  type_code?: string;
  cost?: number | null;
  xp?: number;
  slot?: string;
  traits?: string;
  skill_willpower?: number;
  skill_intellect?: number;
  skill_combat?: number;
  skill_agility?: number;
  skill_wild?: number;
  health?: number;
  sanity?: number;
  is_unique?: boolean;
  permanent?: boolean;
  deck_limit?: number;
  restrictions?: {
    investigator?: Record<string, string>;
  };
  pack_code?: string;
  bonded_to?: string;
  hidden?: boolean;
  subname?: string;
}

function getAttrs(card: Card): ArkhamAttrs {
  return card.attributes as ArkhamAttrs;
}

/**
 * Faction colors for Arkham Horror LCG
 */
const FACTION_COLORS: Record<ArkhamFaction, string> = {
  guardian: '#2B80C5', // Blue
  seeker: '#EC8426', // Orange
  rogue: '#107116', // Green
  mystic: '#4331B9', // Purple
  survivor: '#CC3038', // Red
  neutral: '#808080', // Gray
  mythos: '#000000', // Black
};

/**
 * Faction display names
 */
const FACTION_NAMES: Record<ArkhamFaction, string> = {
  guardian: 'Guardian',
  seeker: 'Seeker',
  rogue: 'Rogue',
  mystic: 'Mystic',
  survivor: 'Survivor',
  neutral: 'Neutral',
  mythos: 'Mythos',
};

/**
 * Get faction color for a card
 */
function getFactionColor(card: Card): string {
  const attrs = getAttrs(card);
  return attrs.faction_code ? FACTION_COLORS[attrs.faction_code] : FACTION_COLORS.neutral;
}

/**
 * Get XP display for a card
 */
function getXpDisplay(card: Card): string {
  const attrs = getAttrs(card);
  const xp = attrs.xp || 0;
  if (xp === 0) return 'Level 0';
  return `Level ${xp}`;
}

/**
 * Get cost display for a card
 */
function getCostDisplay(card: Card): string {
  const attrs = getAttrs(card);
  if (attrs.cost === null || attrs.cost === undefined) return '';
  if (attrs.cost === -2) return 'X';
  return String(attrs.cost);
}

/**
 * Get skill icons display
 */
function getSkillIconsDisplay(card: Card): string {
  const attrs = getAttrs(card);
  const icons: string[] = [];

  if (attrs.skill_willpower) icons.push(`W:${attrs.skill_willpower}`);
  if (attrs.skill_intellect) icons.push(`I:${attrs.skill_intellect}`);
  if (attrs.skill_combat) icons.push(`C:${attrs.skill_combat}`);
  if (attrs.skill_agility) icons.push(`A:${attrs.skill_agility}`);
  if (attrs.skill_wild) icons.push(`?:${attrs.skill_wild}`);

  return icons.join(' ');
}

/**
 * Get faction display
 */
function getFactionDisplay(card: Card): string {
  const attrs = getAttrs(card);
  if (!attrs.faction_code) return '';
  const factions: string[] = [FACTION_NAMES[attrs.faction_code]];
  if (attrs.faction2_code) {
    factions.push(FACTION_NAMES[attrs.faction2_code]);
  }
  return factions.join('/');
}

/**
 * Get slot display
 */
function getSlotDisplay(card: Card): string {
  const attrs = getAttrs(card);
  return attrs.slot || '';
}

/**
 * Get traits display
 */
function getTraitsDisplay(card: Card): string {
  const attrs = getAttrs(card);
  return attrs.traits || '';
}

/**
 * Check card type helpers
 */
function isAsset(card: Card): boolean {
  const attrs = getAttrs(card);
  return attrs.type_code === 'asset';
}

function isEvent(card: Card): boolean {
  const attrs = getAttrs(card);
  return attrs.type_code === 'event';
}

function isSkill(card: Card): boolean {
  const attrs = getAttrs(card);
  return attrs.type_code === 'skill';
}

/**
 * Check faction helpers
 */
function hasFaction(card: Card, faction: ArkhamFaction): boolean {
  const attrs = getAttrs(card);
  return attrs.faction_code === faction || attrs.faction2_code === faction;
}

/**
 * Check XP level helpers
 */
function isLevel0(card: Card): boolean {
  const attrs = getAttrs(card);
  return (attrs.xp || 0) === 0;
}

function isLevel1to2(card: Card): boolean {
  const attrs = getAttrs(card);
  const xp = attrs.xp || 0;
  return xp >= 1 && xp <= 2;
}

function isLevel3Plus(card: Card): boolean {
  const attrs = getAttrs(card);
  return (attrs.xp || 0) >= 3;
}

/**
 * Filter groups for Arkham Horror LCG
 */
const arkhamFilterGroups: FilterGroup[] = [
  {
    id: 'faction',
    label: 'Faction',
    type: 'multi-select',
    options: [
      {
        id: 'guardian',
        label: 'Guardian',
        shortLabel: 'G',
        color: FACTION_COLORS.guardian,
        filter: (c) => hasFaction(c, 'guardian'),
      },
      {
        id: 'seeker',
        label: 'Seeker',
        shortLabel: 'S',
        color: FACTION_COLORS.seeker,
        filter: (c) => hasFaction(c, 'seeker'),
      },
      {
        id: 'rogue',
        label: 'Rogue',
        shortLabel: 'R',
        color: FACTION_COLORS.rogue,
        filter: (c) => hasFaction(c, 'rogue'),
      },
      {
        id: 'mystic',
        label: 'Mystic',
        shortLabel: 'M',
        color: FACTION_COLORS.mystic,
        filter: (c) => hasFaction(c, 'mystic'),
      },
      {
        id: 'survivor',
        label: 'Survivor',
        shortLabel: 'V',
        color: FACTION_COLORS.survivor,
        filter: (c) => hasFaction(c, 'survivor'),
      },
      {
        id: 'neutral',
        label: 'Neutral',
        shortLabel: 'N',
        color: FACTION_COLORS.neutral,
        filter: (c) => hasFaction(c, 'neutral'),
      },
    ],
  },
  {
    id: 'type',
    label: 'Type',
    type: 'multi-select',
    options: [
      { id: 'asset', label: 'Asset', filter: isAsset },
      { id: 'event', label: 'Event', filter: isEvent },
      { id: 'skill', label: 'Skill', filter: isSkill },
    ],
  },
  {
    id: 'level',
    label: 'Level',
    type: 'multi-select',
    options: [
      { id: 'level0', label: 'Level 0', filter: isLevel0 },
      { id: 'level1-2', label: 'Level 1-2', filter: isLevel1to2 },
      { id: 'level3+', label: 'Level 3+', filter: isLevel3Plus },
    ],
  },
  {
    id: 'cost',
    label: 'Cost',
    type: 'range',
    rangeConfig: {
      min: 0,
      max: 10,
      step: 1,
      getValue: (card) => {
        const attrs = getAttrs(card);
        const cost = attrs.cost;
        if (cost === null || cost === undefined || cost < 0) return undefined;
        return cost;
      },
      formatValue: (v) => v.toString(),
    },
  },
];

/**
 * Card types for Arkham Horror LCG
 */
export const ARKHAM_CARD_TYPES = ['Asset', 'Event', 'Skill'] as const;

/**
 * Arkham Horror LCG game configuration
 */
export const arkhamConfig: GameConfig = {
  id: 'arkham',
  name: 'Arkham Horror LCG',
  shortName: 'AHLCG',

  theme: {
    primaryColor: '#1a472a', // Dark green
    accentColor: '#4a3728', // Brown
    cardBackImage: '/images/arkham-card-back.jpg',
    backgroundColor: '#0d1117',
  },

  cardDisplay: {
    primaryStats: [
      {
        label: 'XP',
        getValue: getXpDisplay,
        color: 'text-yellow-400',
      },
    ],
    secondaryInfo: [
      {
        label: 'Cost',
        getValue: getCostDisplay,
        color: 'text-blue-300',
      },
      {
        label: 'Faction',
        getValue: getFactionDisplay,
        color: 'text-gray-300',
      },
    ],
    indicators: [
      {
        show: (card) => {
          const attrs = getAttrs(card);
          return attrs.is_unique || false;
        },
        color: '#FFD700',
        tooltip: 'Unique',
      },
      {
        show: (card) => {
          const attrs = getAttrs(card);
          return attrs.permanent || false;
        },
        color: '#9370DB',
        tooltip: 'Permanent',
      },
    ],
    detailFields: [
      {
        label: 'Skills',
        getValue: getSkillIconsDisplay,
        color: 'text-green-400',
      },
      {
        label: 'Slot',
        getValue: getSlotDisplay,
        color: 'text-purple-400',
      },
      {
        label: 'Traits',
        getValue: getTraitsDisplay,
        color: 'text-gray-400',
      },
    ],
  },

  // Arkham decks use a different zone structure than typical card games
  // For cube drafting, we use a simple main deck
  deckZones: [
    {
      id: 'main',
      name: 'Deck',
      minCards: 30,
      maxCards: 50,
      copyLimit: 2,
      cardBelongsTo: () => true,
    },
  ],

  defaultPlayerName: 'Investigator',

  botNames: [
    'Roland',
    'Daisy',
    'Skids',
    'Agnes',
    'Wendy',
    'Zoey',
    'Rex',
    'Jenny',
    'Jim',
    'Ashcan',
    'Mark',
    'Minh',
    'Sefina',
    'Akachi',
    'William',
    'Leo',
    'Ursula',
    'Finn',
    'Father Mateo',
    'Calvin',
  ],

  cardTypes: ARKHAM_CARD_TYPES,

  getCardImageUrl: (card, size) => {
    const attrs = getAttrs(card);
    const code = attrs.code || card.id;

    // Size mapping for potential future CDN support
    const sizeMap: Record<string, string> = {
      sm: '',
      md: '',
      lg: '',
    };

    // ArkhamDB image URL
    return `https://arkhamdb.com/bundles/cards/${code}.png${sizeMap[size] || ''}`;
  },

  exportFormats: [
    {
      id: 'arkhamdb',
      name: 'ArkhamDB',
      extension: '.txt',
      generate: (cards) => {
        // Group by quantity
        const counts = new Map<string, number>();
        for (const card of cards) {
          const attrs = getAttrs(card);
          const code = attrs.code || String(card.id);
          counts.set(code, (counts.get(code) || 0) + 1);
        }

        const lines: string[] = [];
        for (const [code, count] of counts) {
          const card = cards.find(c => {
            const attrs = getAttrs(c);
            return (attrs.code || String(c.id)) === code;
          });
          if (card) {
            lines.push(`${count}x ${card.name} (${code})`);
          }
        }

        return lines.join('\n');
      },
    },
  ],

  cardClassifiers: {
    isCreature: () => false, // No creatures in Arkham
  },

  storageKeyPrefix: 'arkham-draft',

  filterOptions: [
    { id: 'all', label: 'All Cards', filter: () => true },
    { id: 'assets', label: 'Assets', filter: isAsset },
    { id: 'events', label: 'Events', filter: isEvent },
    { id: 'skills', label: 'Skills', filter: isSkill },
  ],

  filterGroups: arkhamFilterGroups,

  sortOptions: [
    { id: 'name', label: 'Name', compare: (a, b) => a.name.localeCompare(b.name) },
    { id: 'type', label: 'Type', compare: (a, b) => a.type.localeCompare(b.type) },
    {
      id: 'faction',
      label: 'Faction',
      compare: (a, b) => {
        const aFaction = getAttrs(a).faction_code || '';
        const bFaction = getAttrs(b).faction_code || '';
        return aFaction.localeCompare(bFaction);
      },
    },
    {
      id: 'cost',
      label: 'Cost',
      compare: (a, b) => {
        const aCost = getAttrs(a).cost ?? 99;
        const bCost = getAttrs(b).cost ?? 99;
        return (aCost as number) - (bCost as number);
      },
    },
    {
      id: 'xp',
      label: 'XP Level',
      compare: (a, b) => {
        const aXp = getAttrs(a).xp || 0;
        const bXp = getAttrs(b).xp || 0;
        return aXp - bXp;
      },
    },
  ],

  // Arkham draft defaults (adapted for cube format)
  draftDefaults: {
    playerCount: 4,
    cardsPerPlayer: 30,
    packSize: 10,
    burnedPerPack: 0,
    timerSeconds: 45,
  },

  api: {
    baseUrl: 'https://arkhamdb.com/api/public',
    searchEndpoint: '/cards/',
    getCardEndpoint: (cardId) => `/card/${cardId}`,
  },
};

// Export helper functions
export { getFactionColor, FACTION_COLORS, FACTION_NAMES };
