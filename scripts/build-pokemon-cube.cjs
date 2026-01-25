#!/usr/bin/env node

/**
 * Build script to fetch Pokemon TCG card data
 * Creates a balanced cube with evolution lines, trainers, and energy
 *
 * Usage: node scripts/build-pokemon-cube.cjs
 */

const fs = require('fs');
const path = require('path');

const POKEMON_API = 'https://api.pokemontcg.io/v2';
const CUBES_DIR = path.join(__dirname, '../public/cubes');
const DELAY_MS = 200; // Rate limit

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchCards(query) {
  const url = `${POKEMON_API}/cards?q=${encodeURIComponent(query)}&pageSize=50`;

  const response = await fetch(url);
  if (!response.ok) {
    console.warn(`  API error: ${response.status}`);
    return [];
  }

  const data = await response.json();
  return data.data || [];
}

async function fetchCardById(id) {
  const url = `${POKEMON_API}/cards/${id}`;

  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.data;
}

// Fallback search by name and set when direct ID doesn't work
async function searchCard(name, set) {
  // Escape special characters in name
  const escapedName = name.replace(/'/g, "\\'").replace(/\./g, '');

  // First try with set restriction
  let query = `name:"${escapedName}" set.id:${set}`;
  let url = `${POKEMON_API}/cards?q=${encodeURIComponent(query)}&pageSize=1`;

  let response = await fetch(url);
  if (response.ok) {
    const data = await response.json();
    if (data.data?.[0]) return data.data[0];
  }

  // If that fails, try just by name (from classic era sets)
  await sleep(DELAY_MS);
  query = `name:"${escapedName}" (set.id:base1 OR set.id:base2 OR set.id:fossil OR set.id:jungle OR set.id:gym1 OR set.id:gym2 OR set.id:base4)`;
  url = `${POKEMON_API}/cards?q=${encodeURIComponent(query)}&pageSize=1`;

  response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.data?.[0] || null;
}

function transformCard(card, score = 70) {
  if (!card) return null;

  // Determine stage
  let stage = 'Basic';
  if (card.evolvesFrom) {
    if (card.evolvesTo) {
      stage = 'Stage 1';
    } else {
      stage = 'Stage 2';
    }
  }
  if (card.supertype === 'Trainer') {
    stage = undefined;
  }

  // Get energy type from types array
  const energyType = card.types?.[0] || (card.supertype === 'Energy' ? 'Colorless' : undefined);

  // Get image URL from API response - prefer large, fall back to small
  const imageUrl = card.images?.large || card.images?.small || '';

  // Transform attacks to a simpler format
  const attacks = card.attacks?.map(attack => ({
    name: attack.name,
    cost: attack.cost || [], // Array of energy types like ["Fire", "Colorless"]
    damage: attack.damage || '',
    text: attack.text || '',
  })) || [];

  // Transform abilities
  const abilities = card.abilities?.map(ability => ({
    name: ability.name,
    type: ability.type, // "Ability" or "Poke-Power" or "Poke-Body"
    text: ability.text || '',
  })) || [];

  return {
    id: card.id,
    name: card.name,
    type: `${card.supertype}${card.subtypes ? ' - ' + card.subtypes.join(' ') : ''}`,
    description: card.rules?.join(' ') || card.flavorText || '',
    imageUrl, // Store the actual image URL from API
    attributes: {
      hp: card.hp ? parseInt(card.hp) : undefined,
      energyType,
      stage,
      evolvesFrom: card.evolvesFrom,
      evolvesTo: card.evolvesTo,
      weakness: card.weaknesses?.[0]?.type,
      resistance: card.resistances?.[0]?.type,
      retreatCost: card.retreatCost?.length || 0,
      setId: card.set?.id,
      setNumber: card.number + '/' + (card.set?.printedTotal || card.set?.total || '???'),
      trainerType: card.subtypes?.[0],
      attacks,
      abilities,
    },
    score,
  };
}

// Cube composition - balanced for draft play
// Format: [searchQuery, score, count]
// We'll fetch cards matching these queries
const CUBE_COMPOSITION = [
  // === POPULAR POKEMON EVOLUTION LINES ===
  // Charizard line
  { name: 'Charmander', set: 'base1', number: '46', score: 65 },
  { name: 'Charmeleon', set: 'base1', number: '24', score: 70 },
  { name: 'Charizard', set: 'base1', number: '4', score: 95 },
  // Blastoise line
  { name: 'Squirtle', set: 'base1', number: '63', score: 65 },
  { name: 'Wartortle', set: 'base1', number: '42', score: 70 },
  { name: 'Blastoise', set: 'base1', number: '2', score: 90 },
  // Venusaur line
  { name: 'Bulbasaur', set: 'base1', number: '44', score: 65 },
  { name: 'Ivysaur', set: 'base1', number: '30', score: 70 },
  { name: 'Venusaur', set: 'base1', number: '15', score: 85 },
  // Alakazam line
  { name: 'Abra', set: 'base1', number: '43', score: 60 },
  { name: 'Kadabra', set: 'base1', number: '32', score: 70 },
  { name: 'Alakazam', set: 'base1', number: '1', score: 85 },
  // Machamp line
  { name: 'Machop', set: 'base1', number: '52', score: 60 },
  { name: 'Machoke', set: 'base1', number: '34', score: 70 },
  { name: 'Machamp', set: 'base1', number: '8', score: 85 },
  // Gengar line
  { name: 'Gastly', set: 'base1', number: '50', score: 65 },
  { name: 'Haunter', set: 'base1', number: '29', score: 75 },
  { name: 'Gengar', set: 'fossil', number: '5', score: 90 },
  // Golem line
  { name: 'Geodude', set: 'base1', number: '47', score: 55 },
  { name: 'Graveler', set: 'base1', number: '28', score: 65 },
  { name: 'Golem', set: 'fossil', number: '36', score: 80 },
  // Nidoking line
  { name: 'Nidoran M', set: 'base1', number: '55', score: 55 },
  { name: 'Nidorino', set: 'base1', number: '37', score: 65 },
  { name: 'Nidoking', set: 'base1', number: '11', score: 85 },
  // Nidoqueen line
  { name: 'Nidoran F', set: 'base1', number: '57', score: 55 },
  { name: 'Nidorina', set: 'base1', number: '40', score: 65 },
  { name: 'Nidoqueen', set: 'jungle', number: '7', score: 85 },
  // Gyarados line
  { name: 'Magikarp', set: 'base1', number: '35', score: 40 },
  { name: 'Gyarados', set: 'base1', number: '6', score: 90 },
  // Dragonite line
  { name: 'Dratini', set: 'base1', number: '26', score: 65 },
  { name: 'Dragonair', set: 'base1', number: '18', score: 75 },
  { name: 'Dragonite', set: 'fossil', number: '4', score: 90 },

  // === STRONG BASIC POKEMON ===
  { name: 'Mewtwo', set: 'base1', number: '10', score: 90 },
  { name: 'Electabuzz', set: 'base1', number: '20', score: 80 },
  { name: 'Hitmonchan', set: 'base1', number: '7', score: 85 },
  { name: 'Scyther', set: 'jungle', number: '10', score: 85 },
  { name: 'Pikachu', set: 'base1', number: '58', score: 60 },
  { name: 'Raichu', set: 'base1', number: '14', score: 80 },
  { name: 'Jynx', set: 'base1', number: '31', score: 70 },
  { name: 'Magmar', set: 'base1', number: '36', score: 70 },
  { name: 'Lapras', set: 'fossil', number: '10', score: 85 },
  { name: 'Snorlax', set: 'jungle', number: '11', score: 85 },
  { name: 'Kangaskhan', set: 'jungle', number: '5', score: 80 },
  { name: 'Chansey', set: 'base1', number: '3', score: 85 },
  { name: 'Mr. Mime', set: 'jungle', number: '6', score: 80 },
  { name: 'Aerodactyl', set: 'fossil', number: '1', score: 85 },
  { name: 'Zapdos', set: 'base1', number: '16', score: 85 },
  { name: 'Moltres', set: 'fossil', number: '12', score: 85 },
  { name: 'Articuno', set: 'fossil', number: '2', score: 85 },
  { name: 'Mew', set: 'promo', number: '8', score: 90 },

  // === EEVEE EVOLUTIONS ===
  { name: 'Eevee', set: 'jungle', number: '51', score: 65 },
  { name: 'Flareon', set: 'jungle', number: '3', score: 80 },
  { name: 'Jolteon', set: 'jungle', number: '4', score: 80 },
  { name: 'Vaporeon', set: 'jungle', number: '12', score: 80 },

  // === MORE EVOLUTION LINES ===
  // Pidgeot line
  { name: 'Pidgey', set: 'base1', number: '57', score: 50 },
  { name: 'Pidgeotto', set: 'base1', number: '22', score: 65 },
  { name: 'Pidgeot', set: 'jungle', number: '8', score: 80 },
  // Vileplume line
  { name: 'Oddish', set: 'jungle', number: '58', score: 55 },
  { name: 'Gloom', set: 'jungle', number: '37', score: 65 },
  { name: 'Vileplume', set: 'jungle', number: '15', score: 80 },
  // Arcanine line
  { name: 'Growlithe', set: 'base1', number: '28', score: 60 },
  { name: 'Arcanine', set: 'base1', number: '23', score: 80 },
  // Ninetales line
  { name: 'Vulpix', set: 'base1', number: '68', score: 55 },
  { name: 'Ninetales', set: 'base1', number: '12', score: 80 },
  // Wigglytuff line
  { name: 'Jigglypuff', set: 'jungle', number: '54', score: 55 },
  { name: 'Wigglytuff', set: 'jungle', number: '16', score: 80 },
  // Clefable line
  { name: 'Clefairy', set: 'base1', number: '5', score: 70 },
  { name: 'Clefable', set: 'jungle', number: '1', score: 80 },
  // Poliwrath line
  { name: 'Poliwag', set: 'base1', number: '59', score: 50 },
  { name: 'Poliwhirl', set: 'base1', number: '38', score: 65 },
  { name: 'Poliwrath', set: 'base1', number: '13', score: 85 },
  // Victreebel line
  { name: 'Bellsprout', set: 'jungle', number: '49', score: 55 },
  { name: 'Weepinbell', set: 'jungle', number: '48', score: 65 },
  { name: 'Victreebel', set: 'jungle', number: '14', score: 80 },
  // Electrode line
  { name: 'Voltorb', set: 'base1', number: '67', score: 55 },
  { name: 'Electrode', set: 'base1', number: '21', score: 75 },

  // === KEY TRAINERS ===
  { name: 'Professor Oak', set: 'base1', number: '88', score: 95 },
  { name: 'Bill', set: 'base1', number: '91', score: 85 },
  { name: 'Computer Search', set: 'base1', number: '71', score: 95 },
  { name: 'Item Finder', set: 'base1', number: '74', score: 90 },
  { name: 'Pokemon Trader', set: 'base1', number: '77', score: 80 },
  { name: 'Pokemon Breeder', set: 'base1', number: '76', score: 85 },
  { name: 'Pokemon Center', set: 'base1', number: '85', score: 75 },
  { name: 'Switch', set: 'base1', number: '95', score: 80 },
  { name: 'Gust of Wind', set: 'base1', number: '93', score: 85 },
  { name: 'Energy Removal', set: 'base1', number: '92', score: 80 },
  { name: 'Super Energy Removal', set: 'base1', number: '79', score: 85 },
  { name: 'PlusPower', set: 'base1', number: '84', score: 75 },
  { name: 'Defender', set: 'base1', number: '80', score: 70 },
  { name: 'Potion', set: 'base1', number: '94', score: 65 },
  { name: 'Super Potion', set: 'base1', number: '90', score: 70 },
  { name: 'Full Heal', set: 'base1', number: '82', score: 60 },
  { name: 'Revive', set: 'base1', number: '89', score: 70 },
  { name: 'Scoop Up', set: 'base1', number: '78', score: 80 },
  { name: 'Lass', set: 'base1', number: '75', score: 75 },
  { name: 'Impostor Professor Oak', set: 'base1', number: '73', score: 70 },

  // === SPECIAL ENERGY ===
  { name: 'Double Colorless Energy', set: 'base1', number: '96', score: 90 },
  { name: 'Double Colorless Energy', set: 'base1', number: '96', score: 90 },
  { name: 'Double Colorless Energy', set: 'base1', number: '96', score: 90 },
  { name: 'Double Colorless Energy', set: 'base1', number: '96', score: 90 },

  // === MORE POKEMON FOR BALANCE ===
  // Butterfree line
  { name: 'Caterpie', set: 'base1', number: '45', score: 45 },
  { name: 'Metapod', set: 'base1', number: '54', score: 55 },
  { name: 'Butterfree', set: 'jungle', number: '33', score: 75 },
  // Beedrill line
  { name: 'Weedle', set: 'base1', number: '69', score: 45 },
  { name: 'Kakuna', set: 'base1', number: '33', score: 55 },
  { name: 'Beedrill', set: 'base1', number: '17', score: 75 },
  // Alakazam line (fossil)
  { name: 'Slowpoke', set: 'fossil', number: '55', score: 55 },
  { name: 'Slowbro', set: 'fossil', number: '43', score: 75 },
  // Hypno line
  { name: 'Drowzee', set: 'base1', number: '49', score: 55 },
  { name: 'Hypno', set: 'fossil', number: '8', score: 80 },
  // Muk line
  { name: 'Grimer', set: 'fossil', number: '48', score: 50 },
  { name: 'Muk', set: 'fossil', number: '13', score: 80 },
  // Hitmonlee
  { name: 'Hitmonlee', set: 'fossil', number: '7', score: 80 },
  // Ditto
  { name: 'Ditto', set: 'fossil', number: '3', score: 75 },
  // Farfetch\'d
  { name: 'Farfetch\'d', set: 'base1', number: '27', score: 60 },
  // Pinsir
  { name: 'Pinsir', set: 'jungle', number: '9', score: 75 },
  // Tauros
  { name: 'Tauros', set: 'jungle', number: '47', score: 70 },
  // Lickitung
  { name: 'Lickitung', set: 'jungle', number: '38', score: 60 },
  // Persian line
  { name: 'Meowth', set: 'jungle', number: '56', score: 55 },
  { name: 'Persian', set: 'jungle', number: '42', score: 70 },

  // === MORE TRAINERS ===
  { name: 'Maintenance', set: 'base1', number: '83', score: 55 },
  { name: 'Mysterious Fossil', set: 'fossil', number: '62', score: 60 },
  { name: 'Recycle', set: 'fossil', number: '61', score: 60 },
  { name: 'Mr. Fuji', set: 'fossil', number: '58', score: 65 },
  { name: 'Gambler', set: 'fossil', number: '60', score: 55 },
  { name: 'Energy Search', set: 'fossil', number: '59', score: 60 },
  { name: 'Poke Ball', set: 'jungle', number: '64', score: 60 },

  // Extra copies of key trainers for draft balance
  { name: 'Bill', set: 'base1', number: '91', score: 85 },
  { name: 'Bill', set: 'base1', number: '91', score: 85 },
  { name: 'Switch', set: 'base1', number: '95', score: 80 },
  { name: 'Switch', set: 'base1', number: '95', score: 80 },
  { name: 'Gust of Wind', set: 'base1', number: '93', score: 85 },
  { name: 'Professor Oak', set: 'base1', number: '88', score: 95 },
  { name: 'Energy Removal', set: 'base1', number: '92', score: 80 },
  { name: 'PlusPower', set: 'base1', number: '84', score: 75 },
  { name: 'Potion', set: 'base1', number: '94', score: 65 },
];

// Basic Energy is now available post-draft from basicResources pool
// No need to include in the cube

async function buildPokemonCube() {
  console.log('\n🎴 Building Pokemon Cube: Professor\'s Collection');
  console.log('================================================');

  const cards = [];
  const failed = [];

  // Fetch Pokemon and Trainer cards
  for (let i = 0; i < CUBE_COMPOSITION.length; i++) {
    const { name, set, number, score } = CUBE_COMPOSITION[i];
    const cardId = `${set}-${number}`;
    process.stdout.write(`\r  Fetching: ${i + 1}/${CUBE_COMPOSITION.length} - ${name.padEnd(30)}`);

    try {
      // Try direct ID first
      let card = await fetchCardById(cardId);

      // If direct ID fails, try search by name and set
      if (!card) {
        await sleep(DELAY_MS);
        card = await searchCard(name, set);
      }

      if (card) {
        const transformed = transformCard(card, score);
        if (transformed) {
          cards.push(transformed);
        } else {
          failed.push(name);
        }
      } else {
        failed.push(name);
      }
    } catch (error) {
      console.warn(`\n  Error fetching ${name}: ${error.message}`);
      failed.push(name);
    }

    await sleep(DELAY_MS);
  }

  console.log('\n');

  // Basic energy is now available post-draft from basicResources pool

  if (failed.length > 0) {
    console.log(`  ⚠️ ${failed.length} cards failed to fetch:`);
    failed.slice(0, 10).forEach(name => console.log(`     - ${name}`));
    if (failed.length > 10) {
      console.log(`     ... and ${failed.length - 10} more`);
    }
  }

  // Build cardMap with numeric IDs
  const cardMap = {};
  cards.forEach((card, index) => {
    const numericId = index + 1;
    cardMap[numericId] = {
      ...card,
      id: numericId,
    };
  });

  const cubeData = {
    id: 'pokemon-starter',
    name: 'Professor\'s Collection',
    gameId: 'pokemon',
    version: '2.0',
    cardCount: cards.length,
    generatedAt: new Date().toISOString(),
    cardMap,
  };

  const jsonPath = path.join(CUBES_DIR, 'pokemon-starter.json');
  fs.writeFileSync(jsonPath, JSON.stringify(cubeData, null, 2));

  const fileSizeKB = (fs.statSync(jsonPath).size / 1024).toFixed(1);
  console.log(`  ✅ Saved ${cards.length} cards to pokemon-starter.json (${fileSizeKB} KB)`);

  // Print distribution (note: API returns "Pokémon" with accent)
  const typeCounts = { Pokemon: 0, Trainer: 0, Energy: 0 };
  cards.forEach(card => {
    if (card.type.includes('Pokémon') || card.type.includes('Pokemon')) typeCounts.Pokemon++;
    else if (card.type.includes('Trainer')) typeCounts.Trainer++;
    else if (card.type.includes('Energy')) typeCounts.Energy++;
  });

  console.log('\n  Card Distribution:');
  console.log(`    Pokemon: ${typeCounts.Pokemon}`);
  console.log(`    Trainers: ${typeCounts.Trainer}`);
  console.log(`    Energy: ${typeCounts.Energy}`);
  console.log(`    Total: ${cards.length}`);
}

async function main() {
  console.log('🎮 Pokemon TCG Cube Builder');
  console.log('===========================');

  await buildPokemonCube();

  console.log('\n✨ Done!');
}

main().catch(console.error);
