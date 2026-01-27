#!/usr/bin/env node

/**
 * Build script to fetch MTG card data from Scryfall API
 * Creates a balanced cube with cards from across Magic's history
 *
 * Usage: node scripts/build-mtg-cube.cjs
 */

const fs = require('fs');
const path = require('path');

const SCRYFALL_API = 'https://api.scryfall.com';
const CUBES_DIR = path.join(__dirname, '../public/cubes');
const DELAY_MS = 100; // Scryfall rate limit

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchCard(name) {
  const url = `${SCRYFALL_API}/cards/named?exact=${encodeURIComponent(name)}`;

  const response = await fetch(url);
  if (!response.ok) {
    console.warn(`  ⚠️ Card not found: ${name}`);
    return null;
  }

  return response.json();
}

async function fetchCardById(scryfallId) {
  const url = `${SCRYFALL_API}/cards/${scryfallId}`;

  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  return response.json();
}

function transformCard(card, score = 70) {
  if (!card) return null;

  // Handle dual-faced cards (Adventure, Transform, MDFC, Split)
  const hasFaces = card.card_faces && card.card_faces.length > 0;
  const primaryFace = hasFaces ? card.card_faces[0] : card;
  const secondaryFace = hasFaces ? card.card_faces[1] : null;

  // Get power/toughness for creatures (use primary face for dual-faced cards)
  let power, toughness;
  const ptSource = primaryFace.power !== undefined ? primaryFace : card;
  if (ptSource.power) power = isNaN(parseInt(ptSource.power)) ? ptSource.power : parseInt(ptSource.power);
  if (ptSource.toughness) toughness = isNaN(parseInt(ptSource.toughness)) ? ptSource.toughness : parseInt(ptSource.toughness);

  // Get image URL from Scryfall
  // For dual-faced cards without top-level image_uris, use the first face's image
  const scryfallId = card.id;
  let imageUrl = card.image_uris?.normal || card.image_uris?.large || '';
  if (!imageUrl && hasFaces && primaryFace.image_uris) {
    imageUrl = primaryFace.image_uris.normal || primaryFace.image_uris.large || '';
  }

  // Build oracle text for dual-faced cards
  let oracleText = card.oracle_text || '';
  if (!oracleText && hasFaces) {
    // Combine oracle text from both faces
    const texts = card.card_faces
      .filter(face => face.oracle_text)
      .map(face => `${face.name}\n${face.oracle_text}`);
    oracleText = texts.join('\n\n---\n\n');
  }

  // Get mana cost - for dual-faced cards, combine both costs
  let manaCost = card.mana_cost || '';
  if (!manaCost && hasFaces) {
    const costs = card.card_faces
      .map(face => face.mana_cost)
      .filter(Boolean);
    manaCost = costs.join(' // ');
  }

  // Get colors - for dual-faced cards, combine from both faces
  let colors = card.colors;
  if ((!colors || colors.length === 0) && hasFaces) {
    const allColors = new Set();
    card.card_faces.forEach(face => {
      (face.colors || []).forEach(c => allColors.add(c));
    });
    colors = Array.from(allColors);
  }

  return {
    id: card.oracle_id ? card.oracle_id.substring(0, 8) : card.id.substring(0, 8),
    name: card.name,
    type: card.type_line,
    description: oracleText,
    imageUrl, // Store the image URL directly
    attributes: {
      manaCost,
      cmc: card.cmc || 0,
      colors: colors || [],
      colorIdentity: card.color_identity || [],
      power,
      toughness,
      loyalty: card.loyalty ? parseInt(card.loyalty) : undefined,
      rarity: card.rarity,
      setCode: card.set,
      collectorNumber: card.collector_number,
      scryfallId,
    },
    score,
  };
}

// Cube list - balanced across colors and card types
// Format: [cardName, score]
const CUBE_LIST = [
  // === WHITE (60 cards) ===
  // Creatures (35)
  ['Mother of Runes', 95],
  ['Thraben Inspector', 75],
  ['Adanto Vanguard', 70],
  ['Thalia, Guardian of Thraben', 90],
  ['Stoneforge Mystic', 95],
  ['Selfless Spirit', 80],
  ['Wall of Omens', 75],
  ['Blade Splicer', 75],
  ['Flickerwisp', 75],
  ['Monastery Mentor', 90],
  ['Mirran Crusader', 80],
  ['Brimaz, King of Oreskos', 85],
  ['Palace Jailer', 80],
  ['Restoration Angel', 85],
  ['Hero of Bladehold', 85],
  ['Archangel Avacyn', 85],
  ['Baneslayer Angel', 80],
  ['Sun Titan', 80],
  ['Angel of Invention', 80],
  ['Elesh Norn, Grand Cenobite', 85],
  ['Seasoned Hallowblade', 70],
  ['Luminarch Aspirant', 80],
  ['Elite Spellbinder', 80],
  ['Skyclave Apparition', 85],
  ['Charming Prince', 75],
  ['Recruiter of the Guard', 80],
  ['Leonin Relic-Warder', 70],
  ['Imposing Sovereign', 70],
  ['Kor Firewalker', 65],
  ['Leonin Arbiter', 75],
  ['Porcelain Legionnaire', 70],
  ['Silverblade Paladin', 75],
  ['Reveillark', 80],
  ['Cloudgoat Ranger', 75],
  ['Angel of Sanctions', 75],

  // Spells (25)
  ['Swords to Plowshares', 95],
  ['Path to Exile', 90],
  ['Condemn', 70],
  ['Mana Tithe', 65],
  ['Unexpectedly Absent', 75],
  ['Council\'s Judgment', 85],
  ['Wrath of God', 85],
  ['Day of Judgment', 80],
  ['Terminus', 80],
  ['Entreat the Angels', 75],
  ['Spectral Procession', 75],
  ['Lingering Souls', 85],
  ['Honor of the Pure', 70],
  ['History of Benalia', 80],
  ['Oblivion Ring', 75],
  ['Banishing Light', 70],
  ['Cast Out', 70],
  ['Parallax Wave', 80],
  ['Armageddon', 80],
  ['Ravages of War', 80],
  ['Land Tax', 85],
  ['Enlightened Tutor', 85],
  ['Balance', 90],
  ['Moat', 85],
  ['Elspeth, Knight-Errant', 85],

  // === BLUE (60 cards) ===
  // Creatures (25)
  ['Delver of Secrets', 85],
  ['Pteramander', 75],
  ['Snapcaster Mage', 95],
  ['Phantasmal Image', 80],
  ['Looter il-Kor', 70],
  ['Sea Gate Stormcaller', 75],
  ['Brazen Borrower', 85],
  ['Vendilion Clique', 90],
  ['True-Name Nemesis', 85],
  ['Champion of Wits', 75],
  ['Whirler Rogue', 75],
  ['Sower of Temptation', 80],
  ['Venser, Shaper Savant', 85],
  ['Glen Elendra Archmage', 80],
  ['Mulldrifter', 80],
  ['Meloku the Clouded Mirror', 75],
  ['Consecrated Sphinx', 85],
  ['Frost Titan', 75],
  ['Inkwell Leviathan', 70],
  ['Thassa, God of the Sea', 80],
  ['Warkite Marauder', 70],
  ['Fae of Wishes', 75],
  ['Emry, Lurker of the Loch', 75],
  ['Urza, Lord High Artificer', 90],
  ['Murktide Regent', 90],

  // Spells (35)
  ['Brainstorm', 95],
  ['Ponder', 90],
  ['Preordain', 85],
  ['Serum Visions', 75],
  ['Opt', 70],
  ['Spell Pierce', 75],
  ['Spell Snare', 75],
  ['Mental Misstep', 80],
  ['Counterspell', 90],
  ['Mana Drain', 95],
  ['Remand', 80],
  ['Mana Leak', 80],
  ['Memory Lapse', 80],
  ['Miscalculation', 70],
  ['Force of Will', 95],
  ['Force of Negation', 90],
  ['Cryptic Command', 85],
  ['Mystic Confluence', 80],
  ['Fact or Fiction', 85],
  ['Gifts Ungiven', 85],
  ['Treasure Cruise', 85],
  ['Dig Through Time', 85],
  ['Time Walk', 100],
  ['Ancestral Recall', 100],
  ['Time Spiral', 90],
  ['Show and Tell', 80],
  ['Tinker', 95],
  ['Treachery', 85],
  ['Opposition', 80],
  ['Control Magic', 75],
  ['Jace, the Mind Sculptor', 95],
  ['Jace, Vryn\'s Prodigy', 90],
  ['Narset, Parter of Veils', 85],
  ['Shark Typhoon', 85],
  ['Compulsive Research', 70],

  // === BLACK (60 cards) ===
  // Creatures (30)
  ['Gravecrawler', 80],
  ['Carrion Feeder', 75],
  ['Bloodghast', 85],
  ['Kitesail Freebooter', 75],
  ['Scrapheap Scrounger', 75],
  ['Dark Confidant', 95],
  ['Oona\'s Prowler', 70],
  ['Pack Rat', 80],
  ['Rotting Regisaur', 80],
  ['Nighthawk Scavenger', 75],
  ['Ophiomancer', 80],
  ['Geralf\'s Messenger', 75],
  ['Nether Spirit', 75],
  ['Recurring Nightmare', 90],
  ['Braids, Cabal Minion', 85],
  ['Graveyard Marshal', 70],
  ['Bone Shredder', 70],
  ['Shriekmaw', 80],
  ['Ravenous Chupacabra', 75],
  ['Skinrender', 70],
  ['Rankle, Master of Pranks', 80],
  ['Kalitas, Traitor of Ghet', 85],
  ['Grave Titan', 85],
  ['Massacre Wurm', 80],
  ['Sheoldred, Whispering One', 80],
  ['Griselbrand', 90],
  ['Entomber Exarch', 70],
  ['Woe Strider', 75],
  ['Yawgmoth, Thran Physician', 90],
  ['Grief', 85],

  // Spells (30)
  ['Dark Ritual', 85],
  ['Entomb', 85],
  ['Fatal Push', 85],
  ['Thoughtseize', 95],
  ['Inquisition of Kozilek', 85],
  ['Duress', 70],
  ['Cabal Therapy', 85],
  ['Hymn to Tourach', 85],
  ['Collective Brutality', 80],
  ['Go for the Throat', 75],
  ['Doom Blade', 75],
  ['Cast Down', 75],
  ['Dismember', 80],
  ['Snuff Out', 75],
  ['Hero\'s Downfall', 75],
  ['Murderous Rider', 80],
  ['Toxic Deluge', 90],
  ['Damnation', 85],
  ['Living Death', 85],
  ['Reanimate', 90],
  ['Animate Dead', 85],
  ['Necromancy', 80],
  ['Exhume', 80],
  ['Buried Alive', 75],
  ['Night\'s Whisper', 75],
  ['Sign in Blood', 70],
  ['Read the Bones', 70],
  ['Bitterblossom', 85],
  ['Liliana of the Veil', 95],
  ['Liliana, the Last Hope', 85],

  // === RED (60 cards) ===
  // Creatures (30)
  ['Monastery Swiftspear', 85],
  ['Goblin Guide', 85],
  ['Soul-Scar Mage', 75],
  ['Bomat Courier', 80],
  ['Ragavan, Nimble Pilferer', 95],
  ['Dragon\'s Rage Channeler', 85],
  ['Young Pyromancer', 85],
  ['Earthshaker Khenra', 75],
  ['Ash Zealot', 70],
  ['Eidolon of the Great Revel', 85],
  ['Goblin Rabblemaster', 85],
  ['Legion Warboss', 80],
  ['Rampaging Ferocidon', 75],
  ['Hanweir Garrison', 75],
  ['Pia and Kiran Nalaar', 80],
  ['Hazoret the Fervent', 85],
  ['Hellrider', 80],
  ['Hero of Oxid Ridge', 75],
  ['Thundermaw Hellkite', 85],
  ['Glorybringer', 85],
  ['Inferno Titan', 80],
  ['Zealous Conscripts', 80],
  ['Bedlam Reveler', 75],
  ['Goblin Dark-Dwellers', 75],
  ['Kiki-Jiki, Mirror Breaker', 85],
  ['Avalanche Riders', 75],
  ['Flametongue Kavu', 75],
  ['Imperial Recruiter', 80],
  ['Rekindling Phoenix', 80],
  ['Siege-Gang Commander', 75],

  // Spells (30)
  ['Lightning Bolt', 95],
  ['Chain Lightning', 85],
  ['Burst Lightning', 70],
  ['Fiery Impulse', 65],
  ['Unholy Heat', 80],
  ['Lava Spike', 75],
  ['Rift Bolt', 75],
  ['Searing Blaze', 80],
  ['Abrade', 75],
  ['Incinerate', 70],
  ['Lightning Strike', 70],
  ['Searing Spear', 65],
  ['Char', 75],
  ['Exquisite Firecraft', 70],
  ['Fireblast', 80],
  ['Sulfuric Vortex', 80],
  ['Shrine of Burning Rage', 75],
  ['Wheel of Fortune', 90],
  ['Light Up the Stage', 80],
  ['Faithless Looting', 85],
  ['Cathartic Reunion', 70],
  ['Thrill of Possibility', 65],
  ['Through the Breach', 85],
  ['Sneak Attack', 90],
  ['Splinter Twin', 85],
  ['Mizzix\'s Mastery', 75],
  ['Fiery Confluence', 80],
  ['Chandra, Torch of Defiance', 90],
  ['Koth of the Hammer', 80],
  ['Bonecrusher Giant', 85],

  // === GREEN (60 cards) ===
  // Creatures (40)
  ['Birds of Paradise', 90],
  ['Llanowar Elves', 80],
  ['Elvish Mystic', 80],
  ['Noble Hierarch', 95],
  ['Joraga Treespeaker', 75],
  ['Arbor Elf', 75],
  ['Ignoble Hierarch', 80],
  ['Hexdrinker', 80],
  ['Scavenging Ooze', 85],
  ['Fauna Shaman', 80],
  ['Sylvan Caryatid', 75],
  ['Wall of Roots', 75],
  ['Wall of Blossoms', 75],
  ['Tarmogoyf', 90],
  ['Lotus Cobra', 85],
  ['Devoted Druid', 75],
  ['Rofellos, Llanowar Emissary', 90],
  ['Eternal Witness', 85],
  ['Reclamation Sage', 75],
  ['Courser of Kruphix', 80],
  ['Tireless Tracker', 85],
  ['Nissa, Vastwood Seer', 80],
  ['Oracle of Mul Daya', 85],
  ['Questing Beast', 85],
  ['Thrun, the Last Troll', 80],
  ['Polukranos, World Eater', 75],
  ['Master of the Wild Hunt', 75],
  ['Vengevine', 80],
  ['Acidic Slime', 70],
  ['Thragtusk', 80],
  ['Verdurous Gearhulk', 80],
  ['Voracious Hydra', 75],
  ['Elder Gargaroth', 80],
  ['Primeval Titan', 85],
  ['Carnage Tyrant', 80],
  ['Hornet Queen', 80],
  ['Craterhoof Behemoth', 85],
  ['Woodfall Primus', 75],
  ['Terastodon', 75],
  ['Avenger of Zendikar', 80],

  // Spells (20)
  ['Green Sun\'s Zenith', 90],
  ['Natural Order', 90],
  ['Chord of Calling', 80],
  ['Survival of the Fittest', 95],
  ['Channel', 85],
  ['Oath of Druids', 85],
  ['Regrowth', 80],
  ['Sylvan Library', 90],
  ['Fastbond', 85],
  ['Collected Company', 85],
  ['Plow Under', 75],
  ['Genesis Wave', 75],
  ['Garruk Wildspeaker', 80],
  ['Nissa, Who Shakes the World', 85],
  ['Vivien, Monsters\' Advocate', 80],
  ['Beast Within', 80],
  ['Nature\'s Claim', 70],
  ['Krosan Grip', 70],
  ['Once Upon a Time', 80],
  ['Life from the Loam', 85],

  // === MULTICOLOR (36 cards) ===
  // Azorius (6)
  ['Teferi, Time Raveler', 90],
  ['Teferi, Hero of Dominaria', 90],
  ['Supreme Verdict', 85],
  ['Sphinx\'s Revelation', 80],
  ['Fractured Identity', 80],
  ['Geist of Saint Traft', 85],

  // Dimir (6)
  ['Baleful Strix', 85],
  ['Fallen Shinobi', 80],
  ['Thief of Sanity', 80],
  ['Hostage Taker', 80],
  ['Ashiok, Nightmare Weaver', 80],
  ['The Scarab God', 85],

  // Rakdos (6)
  ['Kolaghan\'s Command', 85],
  ['Daretti, Ingenious Iconoclast', 80],
  ['Olivia Voldaren', 75],
  ['Kroxa, Titan of Death\'s Hunger', 85],
  ['Falkenrath Aristocrat', 80],
  ['Angrath, the Flame-Chained', 75],

  // Gruul (6)
  ['Wrenn and Six', 90],
  ['Bloodbraid Elf', 85],
  ['Huntmaster of the Fells', 80],
  ['Domri, Anarch of Bolas', 75],
  ['Atarka\'s Command', 80],
  ['Gruul Spellbreaker', 75],

  // Selesnya (6)
  ['Knight of the Reliquary', 85],
  ['Voice of Resurgence', 80],
  ['Trostani Discordant', 75],
  ['Qasali Pridemage', 75],
  ['Selesnya Charm', 70],
  ['Kitchen Finks', 80],

  // Orzhov (6)
  ['Vindicate', 85],
  ['Kaya, Orzhov Usurper', 75],
  ['Tidehollow Sculler', 80],
  ['Lingering Souls', 85],
  ['Sorin, Lord of Innistrad', 80],
  ['Cruel Celebrant', 70],

  // === COLORLESS/ARTIFACTS (31 cards) ===
  // Power Nine (completing the set)
  ['Black Lotus', 100],
  ['Mox Pearl', 95],
  ['Mox Sapphire', 95],
  ['Mox Jet', 95],
  ['Mox Ruby', 95],
  ['Mox Emerald', 95],
  ['Timetwister', 95],
  // Other artifact staples
  ['Sol Ring', 95],
  ['Mana Crypt', 95],
  ['Mana Vault', 90],
  ['Grim Monolith', 85],
  ['Chrome Mox', 85],
  ['Mox Diamond', 90],
  ['Lion\'s Eye Diamond', 90],
  ['Lotus Petal', 80],
  ['Sensei\'s Divining Top', 90],
  ['Umezawa\'s Jitte', 90],
  ['Batterskull', 85],
  ['Smuggler\'s Copter', 85],
  ['Wurmcoil Engine', 85],
  ['Myr Battlesphere', 75],
  ['Sundering Titan', 75],
  ['Blightsteel Colossus', 80],
  ['Emrakul, the Aeons Torn', 85],
  ['Ulamog, the Ceaseless Hunger', 80],
  ['Karn, Scion of Urza', 85],
  ['Ugin, the Spirit Dragon', 85],
  ['Skullclamp', 90],
  ['Lightning Greaves', 75],
  ['Sword of Fire and Ice', 85],
  ['Walking Ballista', 85],

  // === LANDS (50 cards) ===
  // Original Dual Lands (10)
  ['Underground Sea', 95],
  ['Volcanic Island', 95],
  ['Tundra', 95],
  ['Tropical Island', 95],
  ['Savannah', 90],
  ['Scrubland', 90],
  ['Badlands', 90],
  ['Taiga', 90],
  ['Plateau', 90],
  ['Bayou', 90],

  // Fetch Lands (10)
  ['Polluted Delta', 90],
  ['Flooded Strand', 90],
  ['Bloodstained Mire', 90],
  ['Wooded Foothills', 90],
  ['Windswept Heath', 90],
  ['Scalding Tarn', 90],
  ['Misty Rainforest', 90],
  ['Verdant Catacombs', 90],
  ['Arid Mesa', 90],
  ['Marsh Flats', 90],

  // Shock Lands (10)
  ['Watery Grave', 85],
  ['Steam Vents', 85],
  ['Hallowed Fountain', 85],
  ['Breeding Pool', 85],
  ['Temple Garden', 85],
  ['Godless Shrine', 85],
  ['Blood Crypt', 85],
  ['Stomping Ground', 85],
  ['Sacred Foundry', 85],
  ['Overgrown Tomb', 85],

  // Utility Lands (20)
  ['Library of Alexandria', 95],
  ['Strip Mine', 90],
  ['Wasteland', 90],
  ['Rishadan Port', 85],
  ['Ancient Tomb', 90],
  ['City of Traitors', 85],
  ['Gaea\'s Cradle', 95],
  ['Tolarian Academy', 95],
  ['Maze of Ith', 85],
  ['Dark Depths', 80],
  ['Thespian\'s Stage', 80],
  ['Karakas', 85],
  ['Cavern of Souls', 85],
  ['Mutavault', 80],
  ['Creeping Tar Pit', 75],
  ['Celestial Colonnade', 80],
  ['Raging Ravine', 75],
  ['Urborg, Tomb of Yawgmoth', 80],
  ['Nykthos, Shrine to Nyx', 80],
  ['Field of the Dead', 80],
];

async function buildMTGCube() {
  console.log('\n🃏 Building MTG Cube: Planeswalker\'s Vault');
  console.log('==========================================');

  const cards = [];
  const failed = [];

  for (let i = 0; i < CUBE_LIST.length; i++) {
    const [name, score] = CUBE_LIST[i];
    process.stdout.write(`\r  Fetching: ${i + 1}/${CUBE_LIST.length} - ${name.padEnd(40)}`);

    try {
      const card = await fetchCard(name);
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

  if (failed.length > 0) {
    console.log(`  ⚠️ ${failed.length} cards failed to fetch:`);
    failed.forEach(name => console.log(`     - ${name}`));
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
    id: 'mtg-starter',
    name: 'Planeswalker\'s Vault',
    gameId: 'mtg',
    version: '2.0',
    cardCount: cards.length,
    generatedAt: new Date().toISOString(),
    cardMap,
  };

  const jsonPath = path.join(CUBES_DIR, 'mtg-starter.json');
  fs.writeFileSync(jsonPath, JSON.stringify(cubeData, null, 2));

  const fileSizeKB = (fs.statSync(jsonPath).size / 1024).toFixed(1);
  console.log(`  ✅ Saved ${cards.length} cards to mtg-starter.json (${fileSizeKB} KB)`);

  // Print color distribution
  const colorCounts = { W: 0, U: 0, B: 0, R: 0, G: 0, Multi: 0, Colorless: 0 };
  cards.forEach(card => {
    const colors = card.attributes.colors;
    if (!colors || colors.length === 0) {
      colorCounts.Colorless++;
    } else if (colors.length > 1) {
      colorCounts.Multi++;
    } else {
      colorCounts[colors[0]]++;
    }
  });

  console.log('\n  Color Distribution:');
  console.log(`    White: ${colorCounts.W}`);
  console.log(`    Blue: ${colorCounts.U}`);
  console.log(`    Black: ${colorCounts.B}`);
  console.log(`    Red: ${colorCounts.R}`);
  console.log(`    Green: ${colorCounts.G}`);
  console.log(`    Multicolor: ${colorCounts.Multi}`);
  console.log(`    Colorless: ${colorCounts.Colorless}`);
}

async function main() {
  console.log('🎴 MTG Cube Builder');
  console.log('===================');

  await buildMTGCube();

  console.log('\n✨ Done!');
}

main().catch(console.error);
