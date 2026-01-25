#!/usr/bin/env node

/**
 * Build script to pre-fetch all card data for a cube from YGOProDeck API
 * Saves only essential fields to minimize file size
 *
 * Usage: node scripts/build-cube.cjs
 */

const fs = require('fs');
const path = require('path');

const YGOPRODECK_API = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
const CUBES_DIR = path.join(__dirname, '../public/cubes');
const BATCH_SIZE = 50;
const DELAY_MS = 100;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchCardBatch(cardIds) {
  const idsParam = cardIds.join(',');
  const url = `${YGOPRODECK_API}?id=${idsParam}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || [];
}

function parseCSV(content) {
  const cleanContent = content.replace(/^\uFEFF/, '');
  const lines = cleanContent.split(/\r?\n/).filter(line => line.trim());
  const firstLine = lines[0]?.trim().toLowerCase();
  const hasHeader = firstLine && (firstLine.startsWith('id,') || firstLine === 'id');
  const startIndex = hasHeader ? 1 : 0;

  // Detect format: "ID,Score" (old) or "ID,Name,Score" (new)
  const headerParts = hasHeader ? lines[0].split(',').map(p => p.trim().toLowerCase()) : [];
  const hasName = headerParts.includes('name');

  const cards = [];
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) {
      // Handle quoted CSV fields (for names with commas)
      const parts = parseCSVLine(line);
      const id = parseInt(parts[0], 10);

      let score;
      if (hasName) {
        // Format: ID, Name, Score
        score = parts[2] ? parseInt(parts[2], 10) : 50;
      } else {
        // Format: ID, Score
        score = parts[1] ? parseInt(parts[1], 10) : 50;
      }

      if (!isNaN(id) && id > 0) {
        cards.push({ id, score: isNaN(score) ? 50 : score });
      }
    }
  }
  return cards;
}

// Parse a CSV line handling quoted fields
function parseCSVLine(line) {
  const parts = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return parts;
}

async function buildCube(cubeName) {
  console.log(`\n📦 Building cube: ${cubeName}`);

  const csvPath = path.join(CUBES_DIR, `${cubeName}.csv`);
  const jsonPath = path.join(CUBES_DIR, `${cubeName}.json`);

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found: ${csvPath}`);
    return false;
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const csvCards = parseCSV(csvContent);
  const cardIds = csvCards.map(c => c.id);

  // Build a map of ID -> score from CSV
  const scoreMap = {};
  csvCards.forEach(c => { scoreMap[c.id] = c.score; });

  console.log(`   Found ${cardIds.length} card IDs in CSV`);

  const allCards = [];
  const failedIds = [];

  for (let i = 0; i < cardIds.length; i += BATCH_SIZE) {
    const batch = cardIds.slice(i, i + BATCH_SIZE);
    const progress = Math.min(i + BATCH_SIZE, cardIds.length);
    process.stdout.write(`\r   Fetching cards: ${progress}/${cardIds.length}`);

    try {
      const cards = await fetchCardBatch(batch);
      allCards.push(...cards);

      const returnedIds = new Set(cards.map(c => c.id));
      batch.forEach(id => {
        if (!returnedIds.has(id)) {
          failedIds.push(id);
        }
      });
    } catch (error) {
      console.error(`\n   ⚠️ Batch failed: ${error.message}`);
      failedIds.push(...batch);
    }

    if (i + BATCH_SIZE < cardIds.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log('');

  if (failedIds.length > 0) {
    console.log(`   ⚠️ ${failedIds.length} cards failed to fetch`);
  }

  // Build cardMap directly (no separate cards array to avoid duplication)
  // Save essential fields - image URLs derived from ID at runtime
  const cardMap = {};
  allCards.forEach(card => {
    cardMap[card.id] = {
      id: card.id,
      name: card.name,
      type: card.type,
      desc: card.desc,
      atk: card.atk,
      def: card.def,
      level: card.level,
      attribute: card.attribute,
      race: card.race, // Monster type (Spellcaster, Dragon, etc.)
      linkval: card.linkval, // Link rating for Link monsters
      archetype: card.archetype,
      score: scoreMap[card.id] ?? 50, // Include score from CSV
    };
  });

  const cubeData = {
    id: cubeName,
    name: cubeName === 'the-library' ? 'The Library' : cubeName,
    cardCount: allCards.length,
    generatedAt: new Date().toISOString(),
    cardMap,
  };

  // Write minified JSON (no pretty print)
  fs.writeFileSync(jsonPath, JSON.stringify(cubeData));

  const fileSizeKB = (fs.statSync(jsonPath).size / 1024).toFixed(1);
  console.log(`   ✅ Saved ${allCards.length} cards to ${cubeName}.json (${fileSizeKB} KB)`);

  // Update CSV with card names (ID, Name, Score format)
  updateCSVWithNames(csvPath, csvCards, cardMap);

  return true;
}

// Update the CSV file to include card names
function updateCSVWithNames(csvPath, csvCards, cardMap) {
  const lines = ['ID,Name,Score'];

  for (const { id, score } of csvCards) {
    const card = cardMap[id];
    const name = card?.name || 'Unknown Card';
    // Escape name if it contains commas or quotes
    const escapedName = name.includes(',') || name.includes('"')
      ? `"${name.replace(/"/g, '""')}"`
      : name;
    lines.push(`${id},${escapedName},${score}`);
  }

  fs.writeFileSync(csvPath, lines.join('\n') + '\n');
  console.log(`   ✅ Updated ${csvPath.split('/').pop()} with card names`);
}

async function main() {
  console.log('🎴 Yu-Gi-Oh! Cube Builder');
  console.log('========================');

  const files = fs.readdirSync(CUBES_DIR).filter(f => f.endsWith('.csv'));

  if (files.length === 0) {
    console.log('No CSV files found in public/cubes/');
    return;
  }

  console.log(`Found ${files.length} cube(s) to build`);

  for (const file of files) {
    const cubeName = file.replace('.csv', '');
    await buildCube(cubeName);
  }

  console.log('\n✨ Done!');
}

main().catch(console.error);
