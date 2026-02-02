/**
 * Script to build a Hearthstone cube from HearthstoneJSON API
 *
 * Run with: node scripts/build-hearthstone-cube.cjs
 */

const fs = require('fs');
const path = require('path');

const API_URL = 'https://api.hearthstonejson.com/v1/latest/enUS/cards.json';

// Rarity scores (base score contribution)
const RARITY_SCORES = {
  FREE: 40,
  COMMON: 50,
  RARE: 65,
  EPIC: 75,
  LEGENDARY: 90,
};

// Sets to include (classic/evergreen sets + some popular expansions)
const INCLUDED_SETS = [
  'CORE',
  'LEGACY',
  'EXPERT1',  // Classic
  'NAXX',
  'GVG',
  'BRM',
  'TGT',
  'LOE',
  'OG',
  'KARA',
  'GANGS',
  'UNGORO',
  'ICECROWN',
  'LOOTAPALOOZA',
  'GILNEAS',
  'BOOMSDAY',
  'TROLL',
  'DALARAN',
  'ULDUM',
  'DRAGONS',
  'BLACK_TEMPLE',
  'SCHOLOMANCE',
  'DARKMOON_FAIRE',
  'THE_BARRENS',
  'STORMWIND',
  'ALTERAC_VALLEY',
];

// Card types to include
const VALID_TYPES = ['MINION', 'SPELL', 'WEAPON'];

// Classes to include (skip NEUTRAL initially, add later with higher weight)
const CLASSES = [
  'NEUTRAL',
  'DRUID',
  'HUNTER',
  'MAGE',
  'PALADIN',
  'PRIEST',
  'ROGUE',
  'SHAMAN',
  'WARLOCK',
  'WARRIOR',
  'DEMONHUNTER',
  'DEATHKNIGHT',
];

async function fetchCards() {
  console.log('Fetching cards from HearthstoneJSON...');
  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch cards: ${response.statusText}`);
  }
  return response.json();
}

function filterCards(allCards) {
  return allCards.filter(card => {
    // Must be collectible
    if (!card.collectible) return false;

    // Must have valid type
    if (!VALID_TYPES.includes(card.type)) return false;

    // Must have a dbfId (needed for deck codes)
    if (!card.dbfId) return false;

    // Must have a name and id
    if (!card.name || !card.id) return false;

    // Skip cards with no cost (tokens, etc.)
    if (card.cost === undefined) return false;

    return true;
  });
}

function scoreCard(card) {
  // Base score from rarity
  let score = RARITY_SCORES[card.rarity] || 50;

  // Adjust based on mechanics (simple heuristics)
  const mechanics = card.mechanics || [];

  if (mechanics.includes('TAUNT')) score += 5;
  if (mechanics.includes('DIVINE_SHIELD')) score += 5;
  if (mechanics.includes('CHARGE')) score += 5;
  if (mechanics.includes('LIFESTEAL')) score += 5;
  if (mechanics.includes('RUSH')) score += 3;
  if (mechanics.includes('BATTLECRY')) score += 2;
  if (mechanics.includes('DEATHRATTLE')) score += 3;
  if (mechanics.includes('DISCOVER')) score += 5;

  // Legendary minions with strong effects
  if (card.rarity === 'LEGENDARY' && card.type === 'MINION') {
    score += 5;
  }

  // Cap at 100
  return Math.min(100, score);
}

function selectCardsForCube(cards, targetSize = 360) {
  const selected = [];

  // Separate by class
  const byClass = {};
  for (const cls of CLASSES) {
    byClass[cls] = cards.filter(c => c.cardClass === cls);
  }

  // Target composition: 60% neutral, 40% class cards
  const neutralTarget = Math.floor(targetSize * 0.6);
  const classTarget = targetSize - neutralTarget;
  const perClassTarget = Math.floor(classTarget / (CLASSES.length - 1)); // exclude NEUTRAL

  // Select neutral cards (prioritize higher rarity/score)
  const neutralCards = byClass['NEUTRAL']
    .sort((a, b) => scoreCard(b) - scoreCard(a))
    .slice(0, neutralTarget);
  selected.push(...neutralCards);

  // Select class cards
  for (const cls of CLASSES) {
    if (cls === 'NEUTRAL') continue;

    const classCards = byClass[cls]
      .sort((a, b) => scoreCard(b) - scoreCard(a))
      .slice(0, perClassTarget);
    selected.push(...classCards);
  }

  console.log(`Selected ${selected.length} cards:`);
  console.log(`  - Neutral: ${neutralCards.length}`);
  for (const cls of CLASSES) {
    if (cls === 'NEUTRAL') continue;
    const count = selected.filter(c => c.cardClass === cls).length;
    console.log(`  - ${cls}: ${count}`);
  }

  return selected;
}

function formatCube(cards) {
  const cardMap = {};

  cards.forEach((card, index) => {
    const id = index + 1;
    cardMap[id] = {
      id,
      name: card.name,
      type: card.type,
      description: card.text || '',
      imageUrl: `https://art.hearthstonejson.com/v1/render/latest/enUS/512x/${card.id}.png`,
      attributes: {
        cost: card.cost,
        attack: card.attack,
        health: card.health,
        cardClass: card.cardClass,
        rarity: card.rarity,
        cardType: card.type,
        mechanics: card.mechanics || [],
        dbfId: card.dbfId,
        set: card.set,
        hsCardId: card.id, // Original Hearthstone card ID for images
      },
      score: scoreCard(card),
    };
  });

  return {
    id: 'hearthstone-classic-cube',
    name: 'Classic Hearthstone Cube',
    description: 'A curated cube featuring iconic cards from Hearthstone\'s history. Heavy on neutrals for flexible class selection during draft.',
    gameId: 'hearthstone',
    version: '1.0',
    cardCount: Object.keys(cardMap).length,
    generatedAt: new Date().toISOString(),
    cardMap,
  };
}

async function main() {
  try {
    const allCards = await fetchCards();
    console.log(`Fetched ${allCards.length} total cards`);

    const validCards = filterCards(allCards);
    console.log(`Filtered to ${validCards.length} valid collectible cards`);

    const cubeCards = selectCardsForCube(validCards, 360);

    const cube = formatCube(cubeCards);

    const outputPath = path.join(__dirname, '../public/cubes/hearthstone-classic-cube.json');
    fs.writeFileSync(outputPath, JSON.stringify(cube, null, 2));

    console.log(`\nCube saved to ${outputPath}`);
    console.log(`Total cards: ${cube.cardCount}`);
  } catch (error) {
    console.error('Error building cube:', error);
    process.exit(1);
  }
}

main();
