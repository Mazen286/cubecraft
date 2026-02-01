/**
 * Script to convert a .dck file to enriched JSON for cube loading
 * Usage: npx ts-node scripts/convert-dck-to-json.ts <input.dck> <output.json>
 */

import * as fs from 'fs';
import * as path from 'path';

interface Card {
  id: string | number;
  name: string;
  type: string;
  description: string;
  score?: number;
  imageUrl?: string;
  attributes: Record<string, unknown>;
}

interface ScryfallCard {
  id: string;
  name: string;
  type_line: string;
  oracle_text?: string;
  mana_cost?: string;
  cmc?: number;
  colors?: string[];
  color_identity?: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  rarity?: string;
  set: string;
  collector_number: string;
  image_uris?: { normal?: string; small?: string };
  card_faces?: Array<{ image_uris?: { normal?: string } }>;
}

/**
 * Parse Forge .dck format
 */
function parseForgeFormat(content: string): { name: string; cardNames: string[] } {
  const lines = content.split('\n').map(l => l.trim());
  const cardNames: string[] = [];
  let currentSection = 'main';
  let cubeName = 'Imported Cube';

  for (const line of lines) {
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    // Section headers
    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].toLowerCase();
      continue;
    }

    // Metadata
    if (currentSection === 'metadata') {
      const nameMatch = line.match(/^name=(.+)$/i);
      if (nameMatch) {
        cubeName = nameMatch[1].trim();
      }
      continue;
    }

    // Skip non-main sections for cube
    if (currentSection !== 'main') continue;

    // Parse "count cardname|SET" format
    const cardMatch = line.match(/^(\d+)\s+(.+?)(?:\|([A-Z0-9]+))?$/);
    if (cardMatch) {
      const count = parseInt(cardMatch[1], 10);
      const name = cardMatch[2].trim();
      for (let i = 0; i < count; i++) {
        cardNames.push(name);
      }
    }
  }

  return { name: cubeName, cardNames };
}

/**
 * Fetch cards from Scryfall by name (using collection endpoint)
 */
async function fetchCardsFromScryfall(cardNames: string[]): Promise<Map<string, ScryfallCard>> {
  const cardMap = new Map<string, ScryfallCard>();
  const uniqueNames = [...new Set(cardNames)];

  // Scryfall collection endpoint accepts up to 75 cards at a time
  const batchSize = 75;

  for (let i = 0; i < uniqueNames.length; i += batchSize) {
    const batch = uniqueNames.slice(i, i + batchSize);
    console.log(`Fetching batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(uniqueNames.length / batchSize)} (${batch.length} cards)...`);

    const identifiers = batch.map(name => ({ name }));

    try {
      const response = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers }),
      });

      if (!response.ok) {
        console.error(`Scryfall API error: ${response.status}`);
        continue;
      }

      const data = await response.json();

      for (const card of data.data || []) {
        cardMap.set(card.name.toLowerCase(), card);
      }

      // Log not found cards
      if (data.not_found?.length > 0) {
        for (const nf of data.not_found) {
          console.warn(`Card not found: ${nf.name}`);
        }
      }

      // Rate limiting - Scryfall asks for 50-100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error fetching batch: ${error}`);
    }
  }

  return cardMap;
}

/**
 * Convert Scryfall card to our format
 */
function convertCard(scryfallCard: ScryfallCard, index: number): Card {
  // Get image URL (handle double-faced cards)
  let imageUrl = scryfallCard.image_uris?.normal;
  if (!imageUrl && scryfallCard.card_faces?.[0]?.image_uris?.normal) {
    imageUrl = scryfallCard.card_faces[0].image_uris.normal;
  }

  return {
    id: `${scryfallCard.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${index}`,
    name: scryfallCard.name,
    type: scryfallCard.type_line,
    description: scryfallCard.oracle_text || '',
    imageUrl,
    attributes: {
      manaCost: scryfallCard.mana_cost,
      cmc: scryfallCard.cmc,
      colors: scryfallCard.colors,
      colorIdentity: scryfallCard.color_identity,
      power: scryfallCard.power,
      toughness: scryfallCard.toughness,
      loyalty: scryfallCard.loyalty,
      rarity: scryfallCard.rarity,
      setCode: scryfallCard.set,
      collectorNumber: scryfallCard.collector_number,
      scryfallId: scryfallCard.id,
    },
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: npx ts-node scripts/convert-dck-to-json.ts <input.dck> <output.json>');
    process.exit(1);
  }

  const inputPath = args[0];
  const outputPath = args[1];

  // Read and parse .dck file
  console.log(`Reading ${inputPath}...`);
  const content = fs.readFileSync(inputPath, 'utf-8');
  const { name, cardNames } = parseForgeFormat(content);

  console.log(`Parsed cube "${name}" with ${cardNames.length} cards (${new Set(cardNames).size} unique)`);

  // Fetch from Scryfall
  console.log('Fetching card data from Scryfall...');
  const scryfallCards = await fetchCardsFromScryfall(cardNames);

  // Build card map
  const cardMap: Record<string, Card> = {};
  let notFoundCount = 0;

  cardNames.forEach((cardName, index) => {
    const scryfallCard = scryfallCards.get(cardName.toLowerCase());
    if (scryfallCard) {
      const card = convertCard(scryfallCard, index);
      cardMap[String(card.id)] = card;
    } else {
      notFoundCount++;
      // Create placeholder for not found cards
      const id = `unknown-${index}`;
      cardMap[id] = {
        id,
        name: cardName,
        type: 'Unknown',
        description: 'Card not found in Scryfall',
        attributes: {},
      };
    }
  });

  // Build output JSON
  const output = {
    name,
    description: `${name} - ${cardNames.length} cards`,
    gameId: 'mtg',
    cardMap,
  };

  // Write output
  console.log(`Writing ${outputPath}...`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`Done! ${Object.keys(cardMap).length} cards written.`);
  if (notFoundCount > 0) {
    console.warn(`Warning: ${notFoundCount} cards were not found in Scryfall.`);
  }
}

main().catch(console.error);
