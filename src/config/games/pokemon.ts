import type { GameConfig, DeckZone, ExportFormat, BasicResource, FilterGroup } from '../gameConfig';
import type { Card } from '../../types/card';

/**
 * Pokemon attack interface
 */
export interface PokemonAttack {
  name: string;
  cost: string[]; // Array of energy types like ["Fire", "Colorless"]
  damage: string;
  text: string;
}

/**
 * Pokemon ability interface
 */
export interface PokemonAbility {
  name: string;
  type: string; // "Ability", "Poke-Power", "Poke-Body"
  text: string;
}

/**
 * Pokemon card attributes interface
 */
export interface PokemonCardAttributes {
  hp?: number;
  energyType?: string;
  stage?: string;
  evolvesFrom?: string;
  evolvesTo?: string[];
  weakness?: string;
  resistance?: string;
  retreatCost?: number;
  setId?: string;
  setNumber?: string;
  trainerType?: string;
  energyValue?: number;
  attacks?: PokemonAttack[];
  abilities?: PokemonAbility[];
}

/**
 * Pokemon energy types with colors
 */
const ENERGY_COLORS: Record<string, string> = {
  Grass: '#78C850',
  Fire: '#F08030',
  Water: '#6890F0',
  Lightning: '#F8D030',
  Psychic: '#F85888',
  Fighting: '#C03028',
  Darkness: '#705848',
  Metal: '#B8B8D0',
  Dragon: '#7038F8',
  Fairy: '#EE99AC',
  Colorless: '#A8A878',
};

/**
 * Get HP display
 */
function getHPDisplay(card: Card): string {
  const attrs = card.attributes as PokemonCardAttributes;
  if (attrs.hp === undefined) return '';
  return `${attrs.hp} HP`;
}

/**
 * Get energy type display
 */
function getEnergyDisplay(card: Card): string {
  const attrs = card.attributes as PokemonCardAttributes;
  return attrs.energyType || '';
}

/**
 * Get stage display
 */
function getStageDisplay(card: Card): string {
  const attrs = card.attributes as PokemonCardAttributes;
  return attrs.stage || '';
}

/**
 * Check if card is a Pokemon (handles both "Pokemon" and "Pokémon" with accent)
 */
function isPokemon(card: Card): boolean {
  const type = card.type.toLowerCase();
  return type.includes('pokemon') || type.includes('pokémon');
}

/**
 * Check if card is a Trainer
 */
function isTrainer(card: Card): boolean {
  return card.type.toLowerCase().includes('trainer');
}

/**
 * Check if card is an Energy
 */
function isEnergy(card: Card): boolean {
  return card.type.toLowerCase().includes('energy');
}

/**
 * Check if card is a Basic Pokemon
 */
function isBasicPokemon(card: Card): boolean {
  const attrs = card.attributes as PokemonCardAttributes;
  // Check for stage 'Basic' or type including 'Basic'
  return isPokemon(card) && (attrs.stage === 'Basic' || card.type.toLowerCase().includes('basic'));
}

/**
 * Check if card is Stage 1 Pokemon
 */
function isStage1Pokemon(card: Card): boolean {
  const attrs = card.attributes as PokemonCardAttributes;
  return isPokemon(card) && (attrs.stage === 'Stage 1' || card.type.toLowerCase().includes('stage 1'));
}

/**
 * Check if card is Stage 2 Pokemon
 */
function isStage2Pokemon(card: Card): boolean {
  const attrs = card.attributes as PokemonCardAttributes;
  return isPokemon(card) && (attrs.stage === 'Stage 2' || card.type.toLowerCase().includes('stage 2'));
}

/**
 * Check if card is a V/VMAX/ex Pokemon
 */
function isSpecialPokemon(card: Card): boolean {
  const type = card.type.toLowerCase();
  return type.includes(' v') || type.includes('vmax') || type.includes(' ex');
}

/**
 * Energy type check helper
 */
function hasEnergyType(card: Card, energyType: string): boolean {
  const attrs = card.attributes as PokemonCardAttributes;
  return attrs.energyType === energyType;
}

/**
 * Generate PTCGO format export
 */
function generatePTCGOFormat(cards: Card[]): string {
  const counts = new Map<string, { count: number; setId: string; setNumber: string }>();

  for (const card of cards) {
    const attrs = card.attributes as PokemonCardAttributes;
    const key = card.name;
    const existing = counts.get(key);

    if (existing) {
      existing.count++;
    } else {
      counts.set(key, {
        count: 1,
        setId: attrs.setId || 'UNK',
        setNumber: attrs.setNumber || '0',
      });
    }
  }

  const lines: string[] = [];
  for (const [name, data] of counts) {
    lines.push(`${data.count} ${name} ${data.setId} ${data.setNumber}`);
  }
  return lines.join('\n');
}

/**
 * Pokemon card types
 */
export const POKEMON_CARD_TYPES = [
  'Pokemon - Basic',
  'Pokemon - Stage 1',
  'Pokemon - Stage 2',
  'Pokemon - V',
  'Pokemon - VMAX',
  'Pokemon - ex',
  'Trainer',
  'Energy - Basic',
  'Energy - Special',
] as const;

/**
 * Pokemon energy types
 */
export const POKEMON_ENERGY_TYPES = [
  'Grass',
  'Fire',
  'Water',
  'Lightning',
  'Psychic',
  'Fighting',
  'Darkness',
  'Metal',
  'Dragon',
  'Fairy',
  'Colorless',
] as const;

/**
 * Bot names for Pokemon (trainers and professors across generations)
 */
const POKEMON_BOT_NAMES = [
  // Anime protagonists
  'Ash', 'Misty', 'Brock', 'May', 'Dawn', 'Serena', 'Iris', 'Cilan',
  // Game protagonists and rivals
  'Red', 'Blue', 'Green', 'Silver', 'Brendan', 'Lucas', 'Hilbert', 'Nate',
  // Champions and Elite Four
  'Cynthia', 'N', 'Leon', 'Steven', 'Lance', 'Diantha', 'Alder',
  // Gym Leaders
  'Giovanni', 'Sabrina', 'Lt. Surge', 'Erika', 'Blaine', 'Volkner', 'Elesa',
  // Professors
  'Prof. Oak', 'Prof. Elm', 'Prof. Birch', 'Prof. Rowan', 'Prof. Juniper', 'Prof. Sycamore', 'Prof. Kukui',
];

/**
 * Pokemon Filter Groups for advanced filtering
 */
const pokemonFilterGroups: FilterGroup[] = [
  {
    id: 'energyType',
    label: 'Energy Type',
    type: 'multi-select',
    options: POKEMON_ENERGY_TYPES.map(type => ({
      id: type.toLowerCase(),
      label: type,
      color: ENERGY_COLORS[type],
      filter: (c: Card) => hasEnergyType(c, type),
    })),
  },
  {
    id: 'stage',
    label: 'Stage',
    type: 'multi-select',
    options: [
      { id: 'basic', label: 'Basic', color: '#4ADE80', filter: isBasicPokemon },
      { id: 'stage1', label: 'Stage 1', color: '#60A5FA', filter: isStage1Pokemon },
      { id: 'stage2', label: 'Stage 2', color: '#A78BFA', filter: isStage2Pokemon },
      { id: 'special', label: 'V/VMAX/ex', color: '#F472B6', filter: isSpecialPokemon },
    ],
  },
  {
    id: 'hp',
    label: 'HP',
    type: 'range',
    rangeConfig: {
      min: 30,
      max: 340,
      step: 10,
      getValue: (card) => (card.attributes as PokemonCardAttributes).hp,
      formatValue: (v) => `${v} HP`,
    },
  },
];

/**
 * Export formats for Pokemon
 */
const pokemonExportFormats: ExportFormat[] = [
  {
    id: 'ptcgo',
    name: 'PTCGO/TCG Live',
    extension: '.txt',
    generate: generatePTCGOFormat,
  },
];

/**
 * Basic energy - freely available after drafting
 */
const pokemonBasicEnergy: BasicResource[] = [
  {
    id: 'grass-energy',
    name: 'Grass Energy',
    type: 'Energy - Basic',
    description: 'Provides 1 Grass Energy.',
    imageUrl: 'https://images.pokemontcg.io/sm1/164.png',
    attributes: {
      energyType: 'Grass',
      energyValue: 1,
      setId: 'sm1',
      setNumber: '164',
    },
  },
  {
    id: 'fire-energy',
    name: 'Fire Energy',
    type: 'Energy - Basic',
    description: 'Provides 1 Fire Energy.',
    imageUrl: 'https://images.pokemontcg.io/sm1/165.png',
    attributes: {
      energyType: 'Fire',
      energyValue: 1,
      setId: 'sm1',
      setNumber: '165',
    },
  },
  {
    id: 'water-energy',
    name: 'Water Energy',
    type: 'Energy - Basic',
    description: 'Provides 1 Water Energy.',
    imageUrl: 'https://images.pokemontcg.io/sm1/166.png',
    attributes: {
      energyType: 'Water',
      energyValue: 1,
      setId: 'sm1',
      setNumber: '166',
    },
  },
  {
    id: 'lightning-energy',
    name: 'Lightning Energy',
    type: 'Energy - Basic',
    description: 'Provides 1 Lightning Energy.',
    imageUrl: 'https://images.pokemontcg.io/sm1/167.png',
    attributes: {
      energyType: 'Lightning',
      energyValue: 1,
      setId: 'sm1',
      setNumber: '167',
    },
  },
  {
    id: 'psychic-energy',
    name: 'Psychic Energy',
    type: 'Energy - Basic',
    description: 'Provides 1 Psychic Energy.',
    imageUrl: 'https://images.pokemontcg.io/sm1/168.png',
    attributes: {
      energyType: 'Psychic',
      energyValue: 1,
      setId: 'sm1',
      setNumber: '168',
    },
  },
  {
    id: 'fighting-energy',
    name: 'Fighting Energy',
    type: 'Energy - Basic',
    description: 'Provides 1 Fighting Energy.',
    imageUrl: 'https://images.pokemontcg.io/sm1/169.png',
    attributes: {
      energyType: 'Fighting',
      energyValue: 1,
      setId: 'sm1',
      setNumber: '169',
    },
  },
  {
    id: 'darkness-energy',
    name: 'Darkness Energy',
    type: 'Energy - Basic',
    description: 'Provides 1 Darkness Energy.',
    imageUrl: 'https://images.pokemontcg.io/sm1/170.png',
    attributes: {
      energyType: 'Darkness',
      energyValue: 1,
      setId: 'sm1',
      setNumber: '170',
    },
  },
  {
    id: 'metal-energy',
    name: 'Metal Energy',
    type: 'Energy - Basic',
    description: 'Provides 1 Metal Energy.',
    imageUrl: 'https://images.pokemontcg.io/sm1/171.png',
    attributes: {
      energyType: 'Metal',
      energyValue: 1,
      setId: 'sm1',
      setNumber: '171',
    },
  },
  {
    id: 'fairy-energy',
    name: 'Fairy Energy',
    type: 'Energy - Basic',
    description: 'Provides 1 Fairy Energy.',
    imageUrl: 'https://images.pokemontcg.io/sm1/172.png',
    attributes: {
      energyType: 'Fairy',
      energyValue: 1,
      setId: 'sm1',
      setNumber: '172',
    },
  },
];

/**
 * Deck zones for Pokemon (single deck for draft)
 */
const pokemonDeckZones: DeckZone[] = [
  {
    id: 'main',
    name: 'Deck',
    minCards: 60,
    maxCards: 60,
    cardBelongsTo: () => true,
  },
];

/**
 * Pokemon game configuration
 */
export const pokemonConfig: GameConfig = {
  id: 'pokemon',
  name: 'Pokemon TCG',
  shortName: 'PKM',

  theme: {
    primaryColor: '#FFCB05',  // Pokemon yellow
    accentColor: '#2A75BB',   // Pokemon blue
    cardBackImage: '/images/pokemon-card-back.jpg',
    backgroundColor: '#1a1a2e',
  },

  cardDisplay: {
    primaryStats: [
      {
        label: 'HP',
        getValue: getHPDisplay,
        color: 'text-red-400',
      },
    ],
    secondaryInfo: [
      {
        label: 'Type',
        getValue: getEnergyDisplay,
        color: 'text-yellow-300',
      },
      {
        label: 'Stage',
        getValue: getStageDisplay,
        color: 'text-gray-300',
      },
    ],
    indicators: [
      {
        show: isBasicPokemon,
        color: '#4ade80',  // green
        tooltip: 'Basic Pokemon',
      },
    ],
    detailFields: [
      {
        label: 'Weakness',
        getValue: (card) => (card.attributes as PokemonCardAttributes).weakness || 'None',
        color: 'text-red-400',
      },
      {
        label: 'Retreat',
        getValue: (card) => {
          const cost = (card.attributes as PokemonCardAttributes).retreatCost;
          return cost !== undefined ? String(cost) : 'None';
        },
        color: 'text-gray-400',
      },
    ],
  },

  deckZones: pokemonDeckZones,

  defaultPlayerName: 'Trainer',
  botNames: POKEMON_BOT_NAMES,

  cardTypes: POKEMON_CARD_TYPES,
  cardAttributes: POKEMON_ENERGY_TYPES,

  getCardImageUrl: (card, size) => {
    // Prefer stored imageUrl from API if available
    if (card.imageUrl) {
      return card.imageUrl;
    }

    // Fallback to constructing URL from attributes
    const attrs = card.attributes as PokemonCardAttributes;
    const setId = attrs.setId;
    const setNumber = attrs.setNumber;

    if (!setId || !setNumber) {
      // Fallback - no image available
      return '';
    }

    // Extract just the number part from setNumber (e.g., "4/102" -> "4")
    const numberOnly = setNumber.split('/')[0];

    // Pokemon TCG API image URL format:
    // https://images.pokemontcg.io/{setId}/{cardNumber}.png
    // For hi-res: https://images.pokemontcg.io/{setId}/{cardNumber}_hires.png
    if (size === 'lg') {
      return `https://images.pokemontcg.io/${setId}/${numberOnly}_hires.png`;
    }
    return `https://images.pokemontcg.io/${setId}/${numberOnly}.png`;
  },

  exportFormats: pokemonExportFormats,

  cardClassifiers: {
    isCreature: isPokemon,
    isPokemon: isPokemon,
    isTrainer: isTrainer,
    isEnergy: isEnergy,
  },

  storageKeyPrefix: 'pokemon-draft',

  basicResources: pokemonBasicEnergy,

  filterOptions: [
    { id: 'all', label: 'All Cards', filter: () => true },
    { id: 'pokemon', label: 'Pokemon', filter: isPokemon },
    { id: 'trainers', label: 'Trainers', filter: isTrainer },
    { id: 'energy', label: 'Energy', filter: isEnergy },
    { id: 'basic', label: 'Basic Pokemon', filter: isBasicPokemon },
  ],

  filterGroups: pokemonFilterGroups,

  sortOptions: [
    { id: 'name', label: 'Name', compare: (a, b) => a.name.localeCompare(b.name) },
    { id: 'type', label: 'Type', compare: (a, b) => a.type.localeCompare(b.type) },
    {
      id: 'hp',
      label: 'HP',
      compare: (a, b) => {
        const aHP = (a.attributes as PokemonCardAttributes).hp || 0;
        const bHP = (b.attributes as PokemonCardAttributes).hp || 0;
        return bHP - aHP;
      },
    },
    {
      id: 'score',
      label: 'Score',
      compare: (a, b) => (b.score ?? 0) - (a.score ?? 0),
    },
  ],

  api: {
    baseUrl: 'https://api.pokemontcg.io/v2',
    searchEndpoint: '/cards',
    getCardEndpoint: (cardId) => `/cards/${cardId}`,
  },
};

// Re-export helper functions
export { isPokemon, isTrainer, isEnergy, isBasicPokemon, ENERGY_COLORS };
