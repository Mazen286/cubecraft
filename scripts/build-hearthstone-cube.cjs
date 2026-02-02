/**
 * Script to build a Hearthstone cube from HearthstoneJSON API
 *
 * Run with: node scripts/build-hearthstone-cube.cjs
 */

const fs = require('fs');
const path = require('path');

const API_URL = 'https://api.hearthstonejson.com/v1/latest/enUS/cards.json';

// Rarity base scores
const RARITY_BASE = {
  FREE: 35,
  COMMON: 40,
  RARE: 50,
  EPIC: 55,
  LEGENDARY: 60,
};

// Manual overrides for iconic/powerful cards (dbfId -> score)
// These are cards that are historically powerful in arena/constructed
const MANUAL_SCORES = {
  // === S-TIER LEGENDARIES (90-100) ===
  2078: 98,   // Dr. Boom (the original, not the hero)
  374: 96,    // Ragnaros the Firelord
  49184: 97,  // Zilliax (original)
  97112: 97,  // Zilliax (reprint)
  42818: 93,  // The Lich King (original)
  95765: 93,  // The Lich King (reprint)
  890: 95,    // Tirion Fordring (original)
  69613: 95,  // Tirion Fordring (reprint)
  1721: 92,   // Sylvanas Windrunner (original) - mind control deathrattle
  111463: 92, // Sylvanas Windrunner (reprint)
  53756: 95,  // Zephrys the Great - wishes for perfect card

  // === A-TIER LEGENDARIES (80-89) ===
  2741: 85,   // Ysera
  1914: 88,   // Loatheb (original) - shuts down spells
  120998: 88, // Loatheb (reprint)
  420: 85,    // Cairne Bloodhoof (original) - sticky 8/10 value
  69667: 85,  // Cairne Bloodhoof (reprint)
  336: 82,    // Baron Geddon (original) - board clear on a body
  69674: 82,  // Baron Geddon (reprint)
  912: 80,    // Harrison Jones - weapon tech + card draw
  2082: 82,   // Sneed's Old Shredder (original) - great value deathrattle
  120575: 82, // Sneed's Old Shredder (reprint)
  40596: 82,  // Aya Blackpaw - jade value engine
  102681: 82, // Aya Blackpaw (reprint)
  117762: 78, // Elise the Navigator
  834: 80,    // Deathwing (original) - board reset
  70093: 80,  // Deathwing (reprint)
  57197: 78,  // Maiev Shadowsong - tempo legendary
  52413: 78,  // Barista Lynchen - battlecry value
  2951: 78,   // Elise Starseeker (original) - late game value
  76313: 78,  // Elise Starseeker (reprint)
  41935: 78,  // Elise the Trailblazer
  40465: 75,  // Patches the Pirate - still strong tempo

  // === STRONG SPELLS (80-90) ===
  315: 88,    // Fireball
  69502: 90,  // Flamestrike
  69640: 85,  // Brawl

  // === TERRIBLE CARDS - OVERRIDE LOW (25-40) ===
  1653: 25,   // Magma Rager (5/1 for 3 - awful)
  1401: 45,   // Raid Leader (needs board to be good)
  582: 30,    // Wisp
  602: 35,    // Angry Chicken
  179: 35,    // Core Hound (9 stats for 7, but 5 health is bad)
  1688: 30,   // Target Dummy
  994: 38,    // War Golem (vanilla 7/7 for 7, just bad)

  // === GLASS CANNONS - penalize ===
  512: 40,    // Oasis Snapjaw (2/7 for 4 - no attack)
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

/**
 * Clean up card text while preserving meaningful formatting
 * - Keep <b> tags for keyword bolding (Rush, Taunt, etc.)
 * - Remove [x] which is just a Hearthstone text-wrapping hint
 */
function cleanCardText(text) {
  if (!text) return '';
  return text
    .replace(/\[x\]/gi, '')       // Remove [x] formatting markers
    .replace(/<br\s*\/?>/gi, '\n') // Replace <br> with newline
    .replace(/\n+/g, ' ')         // Collapse newlines to space for single-line display
    .replace(/\s+/g, ' ')         // Collapse multiple spaces
    .trim();
}

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
  // Check for manual override first
  if (MANUAL_SCORES[card.dbfId]) {
    return MANUAL_SCORES[card.dbfId];
  }

  // Base score from rarity
  let score = RARITY_BASE[card.rarity] || 45;
  const mechanics = card.mechanics || [];

  // === MINION SCORING ===
  if (card.type === 'MINION') {
    const cost = card.cost || 0;
    const attack = card.attack || 0;
    const health = card.health || 0;
    const totalStats = attack + health;

    // Vanilla test: good stats = cost * 2 + 1 (e.g., 4 mana = 9 stats)
    const expectedStats = cost * 2 + 1;
    const statDiff = totalStats - expectedStats;

    // Stat efficiency bonus/penalty (-10 to +10)
    score += Math.max(-10, Math.min(10, statDiff * 2));

    // === HEALTH PENALTIES - low health minions die too easily ===
    if (health === 1 && cost >= 2) score -= 15;  // 1 health is terrible (pings kill it)
    if (health === 2 && cost >= 4) score -= 10;  // 2 health at 4+ mana is weak
    if (health <= 2 && attack >= 5) score -= 8;  // Glass cannon penalty

    // === ATTACK PENALTIES - low attack means bad trades ===
    if (attack === 0 && !mechanics.includes('TAUNT')) score -= 12;  // Can't attack, no taunt
    if (attack <= 1 && cost >= 4) score -= 8;  // Low attack expensive minion

    // Premium keywords
    if (mechanics.includes('TAUNT')) score += 8;
    if (mechanics.includes('DIVINE_SHIELD')) score += 10;
    if (mechanics.includes('CHARGE')) score += 6;  // Often overcosted
    if (mechanics.includes('RUSH')) score += 8;
    if (mechanics.includes('LIFESTEAL')) score += 7;
    if (mechanics.includes('WINDFURY')) score += 5;
    if (mechanics.includes('POISONOUS')) score += 6;
    if (mechanics.includes('REBORN')) score += 7;

    // Value generators
    if (mechanics.includes('BATTLECRY')) score += 3;
    if (mechanics.includes('DEATHRATTLE')) score += 5;
    if (mechanics.includes('DISCOVER')) score += 8;

    // Drawbacks
    if (mechanics.includes('OVERLOAD')) score -= 3;
    if (mechanics.includes('CANT_ATTACK')) score -= 8;

    // Tribe bonuses (standalone value, not synergy)
    if (card.race === 'DRAGON') score += 3;
    if (card.race === 'MECH') score += 2;
    if (card.race === 'ELEMENTAL') score += 2;

    // Cost curve adjustments (early game premium)
    if (cost <= 2 && totalStats >= cost * 2) score += 5;  // Good early drops
    if (cost >= 8) score -= 3;  // Late game harder to play

  // === SPELL SCORING ===
  } else if (card.type === 'SPELL') {
    const cost = card.cost || 0;
    const text = (card.text || '').toLowerCase();

    // Removal spells
    if (text.includes('destroy') || text.includes('deal') && text.includes('damage')) {
      score += 10;
      // Efficient removal bonus
      if (cost <= 4) score += 5;
    }

    // Board clears
    if (text.includes('all minions') || text.includes('all enemy')) {
      score += 12;
    }

    // Draw
    if (text.includes('draw')) {
      score += 8;
      const drawMatch = text.match(/draw (\d+)/);
      if (drawMatch && parseInt(drawMatch[1]) >= 2) score += 4;
    }

    // Buffs (less valuable in arena/draft)
    if (text.includes('+') && text.includes('attack')) {
      score += 3;
    }

    // Secrets (inconsistent value)
    if (mechanics.includes('SECRET')) {
      score += 2;
    }

    // Discover (high value)
    if (mechanics.includes('DISCOVER')) {
      score += 10;
    }

  // === WEAPON SCORING ===
  } else if (card.type === 'WEAPON') {
    const cost = card.cost || 0;
    const attack = card.attack || 0;
    const durability = card.durability || card.health || 0;
    const totalValue = attack * durability;

    // Weapons are generally strong - base bonus
    score += 8;

    // Value per mana
    const expectedValue = cost * 2;
    if (totalValue >= expectedValue) score += 5;
    if (totalValue >= expectedValue + 2) score += 5;
  }

  // === UNIVERSAL ADJUSTMENTS ===

  // Class cards slightly more powerful (by design)
  if (card.cardClass !== 'NEUTRAL') {
    score += 3;
  }

  // Legendary bonus (unique effects)
  if (card.rarity === 'LEGENDARY') {
    score += 5;
  }

  // Cap between 30 and 95 (save 96-100 for manual overrides)
  return Math.max(30, Math.min(95, Math.round(score)));
}

/**
 * Deduplicate cards:
 * - Legendaries: only 1 copy (keep highest scoring version)
 * - Non-legendaries: up to 2 copies (keep highest scoring versions)
 */
function deduplicateCards(cards) {
  const cardsByName = new Map();

  // Group cards by name
  for (const card of cards) {
    const name = card.name;
    if (!cardsByName.has(name)) {
      cardsByName.set(name, []);
    }
    cardsByName.get(name).push(card);
  }

  const result = [];

  for (const [name, versions] of cardsByName) {
    // Sort by score descending (best version first)
    versions.sort((a, b) => scoreCard(b) - scoreCard(a));

    const isLegendary = versions[0].rarity === 'LEGENDARY';

    if (isLegendary) {
      // Only keep 1 copy of legendaries
      result.push(versions[0]);
    } else {
      // Keep up to 2 copies of non-legendaries
      result.push(...versions.slice(0, 2));
    }
  }

  return result;
}

function selectCardsForCube(cards, targetSize = 540) {
  // First, deduplicate the card pool
  const deduped = deduplicateCards(cards);
  console.log(`Deduplicated to ${deduped.length} cards (legendaries=1, others<=2)`);

  const selected = [];

  // Separate by class, then by rarity
  const byClassAndRarity = {};
  for (const cls of CLASSES) {
    const classCards = deduped.filter(c => c.cardClass === cls);
    byClassAndRarity[cls] = {
      legendary: classCards.filter(c => c.rarity === 'LEGENDARY'),
      nonLegendary: classCards.filter(c => c.rarity !== 'LEGENDARY'),
    };
  }

  // === CLASS CARDS: 40 per class (20 legendary + 20 non-legendary) ===
  const legendaryPerClass = 20;
  const nonLegendaryPerClass = 20;
  const numClasses = CLASSES.length - 1; // exclude NEUTRAL

  for (const cls of CLASSES) {
    if (cls === 'NEUTRAL') continue;

    const { legendary, nonLegendary } = byClassAndRarity[cls];

    // Select legendaries (sorted by score)
    const classLegendaries = legendary
      .sort((a, b) => scoreCard(b) - scoreCard(a))
      .slice(0, legendaryPerClass);

    // Select non-legendaries (sorted by score)
    const classNonLegendaries = nonLegendary
      .sort((a, b) => scoreCard(b) - scoreCard(a))
      .slice(0, nonLegendaryPerClass);

    selected.push(...classLegendaries);
    selected.push(...classNonLegendaries);

    console.log(`  - ${cls}: ${classLegendaries.length} leg + ${classNonLegendaries.length} non-leg = ${classLegendaries.length + classNonLegendaries.length}`);
  }

  // === NEUTRAL CARDS: Fill remaining with balanced legendary/non-legendary ===
  const classCardsTotal = selected.length;
  const neutralTarget = Math.max(0, targetSize - classCardsTotal);
  const neutralLegendaryTarget = Math.floor(neutralTarget / 2);
  const neutralNonLegendaryTarget = neutralTarget - neutralLegendaryTarget;

  const { legendary: neutralLeg, nonLegendary: neutralNonLeg } = byClassAndRarity['NEUTRAL'];

  const selectedNeutralLeg = neutralLeg
    .sort((a, b) => scoreCard(b) - scoreCard(a))
    .slice(0, neutralLegendaryTarget);

  const selectedNeutralNonLeg = neutralNonLeg
    .sort((a, b) => scoreCard(b) - scoreCard(a))
    .slice(0, neutralNonLegendaryTarget);

  selected.push(...selectedNeutralLeg);
  selected.push(...selectedNeutralNonLeg);

  const neutralTotal = selectedNeutralLeg.length + selectedNeutralNonLeg.length;

  console.log(`\nSelected ${selected.length} cards:`);
  console.log(`  - Class cards: ${classCardsTotal} (${numClasses} classes × ~30 each)`);
  console.log(`  - Neutral: ${neutralTotal} (${selectedNeutralLeg.length} leg + ${selectedNeutralNonLeg.length} non-leg)`);

  // Summary by class
  console.log(`\nBreakdown by class:`);
  for (const cls of CLASSES) {
    const count = selected.filter(c => c.cardClass === cls).length;
    const legCount = selected.filter(c => c.cardClass === cls && c.rarity === 'LEGENDARY').length;
    console.log(`  - ${cls}: ${count} (${legCount} legendary)`);
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
      description: cleanCardText(card.text),
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

    const cubeCards = selectCardsForCube(validCards, 540);

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
