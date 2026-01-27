// Cube Upload Service - handles parsing and validating user-uploaded cubes
// Supports CSV and JSON formats

import type { Card } from '../types/card';
import { getGameConfig } from '../config/games';
import { cardService } from './cardService';
import { mtgCardService } from './mtgCardService';

export interface ParsedCube {
  name: string;
  description: string;
  gameId: string;
  cards: Card[];
  errors: string[];
  warnings: string[];
}

export interface CsvParseOptions {
  gameId: string;
  hasHeader?: boolean;
  nameColumn?: number;
  typeColumn?: number;
  descriptionColumn?: number;
  scoreColumn?: number;
  idColumn?: number;
}

/**
 * Detect CSV column layout from header row
 */
function detectCsvLayout(headerValues: string[]): {
  idColumn?: number;
  nameColumn: number;
  typeColumn?: number;
  descriptionColumn?: number;
  scoreColumn?: number;
} {
  const lower = headerValues.map(h => h.toLowerCase().trim());

  const idColumn = lower.findIndex(h => h === 'id' || h === 'card_id' || h === 'cardid');
  const nameColumn = lower.findIndex(h => h === 'name' || h === 'card_name' || h === 'cardname');
  const typeColumn = lower.findIndex(h => h === 'type' || h === 'card_type');
  const descriptionColumn = lower.findIndex(h => h === 'description' || h === 'desc' || h === 'text');
  const scoreColumn = lower.findIndex(h => h === 'score' || h === 'rating' || h === 'tier');

  return {
    idColumn: idColumn >= 0 ? idColumn : undefined,
    nameColumn: nameColumn >= 0 ? nameColumn : (idColumn >= 0 ? -1 : 0), // -1 means no name column
    typeColumn: typeColumn >= 0 ? typeColumn : undefined,
    descriptionColumn: descriptionColumn >= 0 ? descriptionColumn : undefined,
    scoreColumn: scoreColumn >= 0 ? scoreColumn : undefined,
  };
}

/**
 * Parse a CSV file into cube cards
 * Supports multiple formats:
 * - ID only: id (for Yu-Gi-Oh, will be enriched via API)
 * - ID,Name: id,name
 * - ID,Name,Score: id,name,score
 * - Full: name,type,description,score
 */
export function parseCsvCube(
  csvContent: string,
  options: CsvParseOptions
): ParsedCube {
  const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);
  const errors: string[] = [];
  const warnings: string[] = [];
  const cards: Card[] = [];

  const { gameId, hasHeader = true } = options;

  if (lines.length === 0) {
    errors.push('Empty file');
    return { name: 'Uploaded Cube', description: '', gameId, cards, errors, warnings };
  }

  // Parse header to detect layout
  const headerValues = parseCSVLine(lines[0]);
  const layout = hasHeader ? detectCsvLayout(headerValues) : {
    nameColumn: 0,
    typeColumn: 1,
    descriptionColumn: 2,
    scoreColumn: 3,
  };

  // Check if first column looks like numeric IDs (Yu-Gi-Oh card IDs)
  const firstDataLine = lines[hasHeader ? 1 : 0];
  const firstValues = parseCSVLine(firstDataLine || '');
  const firstValueIsNumericId = firstValues[0] && /^\d{5,}$/.test(firstValues[0].trim());

  // For Yu-Gi-Oh, if first column is numeric ID and no explicit name column, treat as ID-only format
  const isYuGiOhIdFormat = gameId === 'yugioh' && firstValueIsNumericId &&
    (layout.nameColumn === -1 || layout.nameColumn === undefined ||
      (layout.idColumn === 0 && layout.nameColumn === 0));

  if (isYuGiOhIdFormat) {
    // ID-only or ID,Name,Score format for Yu-Gi-Oh
    const startLine = hasHeader ? 1 : 0;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const values = parseCSVLine(line);

      if (values.length === 0) continue;

      const idStr = values[0]?.trim();
      const id = parseInt(idStr, 10);

      if (isNaN(id) || id <= 0) {
        warnings.push(`Line ${lineNum}: Invalid card ID "${idStr}"`);
        continue;
      }

      // Optional name in column 1 (may be provided for reference)
      const name = values[1]?.trim() || `Card #${id}`;

      // Optional score - check common positions
      let score: number | undefined;
      const scoreCol = layout.scoreColumn ?? (values.length > 2 ? 2 : -1);
      if (scoreCol >= 0 && values[scoreCol]) {
        const parsed = parseInt(values[scoreCol].trim(), 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
          score = parsed;
        }
      }

      cards.push({
        id,
        name,
        type: 'Unknown', // Will be enriched via API
        description: '',
        score,
        attributes: {},
      });
    }
  } else {
    // Standard format: name,type,description,score or detected layout
    const startLine = hasHeader ? 1 : 0;
    const {
      nameColumn = 0,
      typeColumn,
      descriptionColumn,
      scoreColumn,
      idColumn,
    } = layout;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const values = parseCSVLine(line);

      if (values.length === 0) continue;

      const name = nameColumn >= 0 ? values[nameColumn]?.trim() : '';
      const type = typeColumn !== undefined ? values[typeColumn]?.trim() || 'Unknown' : 'Unknown';
      const description = descriptionColumn !== undefined ? values[descriptionColumn]?.trim() || '' : '';
      const idStr = idColumn !== undefined ? values[idColumn]?.trim() : undefined;

      if (!name) {
        warnings.push(`Line ${lineNum}: Skipped - missing card name`);
        continue;
      }

      const id = idStr ? parseInt(idStr, 10) : generateCardId(name);

      let score: number | undefined;
      if (scoreColumn !== undefined && values[scoreColumn]) {
        const parsed = parseInt(values[scoreColumn].trim(), 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
          score = parsed;
        } else {
          warnings.push(`Line ${lineNum}: Invalid score "${values[scoreColumn]}", using default`);
        }
      }

      cards.push({
        id,
        name,
        type,
        description,
        score,
        attributes: {},
      });
    }
  }

  if (cards.length === 0) {
    errors.push('No valid cards found in the file');
  }

  return {
    name: 'Uploaded Cube',
    description: 'Custom cube uploaded by user',
    gameId,
    cards,
    errors,
    warnings,
  };
}

/**
 * Parse a JSON file into cube cards
 * Supports multiple formats:
 * - Array of cards: [{ name, type, ... }]
 * - Cube object: { name, cards: [...] }
 * - Card map: { "id": { name, type, ... } }
 */
export function parseJsonCube(
  jsonContent: string,
  gameId: string
): ParsedCube {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cards: Card[] = [];
  let name = 'Uploaded Cube';
  let description = 'Custom cube uploaded by user';

  try {
    const data = JSON.parse(jsonContent);

    // Detect format
    if (Array.isArray(data)) {
      // Array of cards
      for (let i = 0; i < data.length; i++) {
        const card = parseCardObject(data[i], i, warnings);
        if (card) cards.push(card);
      }
    } else if (data.cards && Array.isArray(data.cards)) {
      // Cube object with cards array
      name = data.name || name;
      description = data.description || description;
      for (let i = 0; i < data.cards.length; i++) {
        const card = parseCardObject(data.cards[i], i, warnings);
        if (card) cards.push(card);
      }
    } else if (data.cardMap && typeof data.cardMap === 'object') {
      // Cube object with card map (our export format)
      name = data.name || name;
      description = data.description || description;
      for (const [id, cardData] of Object.entries(data.cardMap)) {
        const card = parseCardObject(cardData, parseInt(id, 10), warnings);
        if (card) cards.push(card);
      }
    } else if (typeof data === 'object' && !Array.isArray(data)) {
      // Assume it's a card map
      for (const [id, cardData] of Object.entries(data)) {
        const card = parseCardObject(cardData, parseInt(id, 10), warnings);
        if (card) cards.push(card);
      }
    } else {
      errors.push('Unrecognized JSON format');
    }
  } catch (e) {
    errors.push(`Invalid JSON: ${e instanceof Error ? e.message : 'Parse error'}`);
  }

  if (cards.length === 0 && errors.length === 0) {
    errors.push('No valid cards found in the file');
  }

  return {
    name,
    description,
    gameId,
    cards,
    errors,
    warnings,
  };
}

/**
 * Parse a card object from JSON
 */
function parseCardObject(
  data: unknown,
  index: number,
  warnings: string[]
): Card | null {
  if (!data || typeof data !== 'object') {
    warnings.push(`Card ${index}: Invalid format, skipped`);
    return null;
  }

  const obj = data as Record<string, unknown>;

  // Get name (required)
  const name = String(obj.name || obj.Name || '').trim();
  if (!name) {
    warnings.push(`Card ${index}: Missing name, skipped`);
    return null;
  }

  // Get type
  const type = String(obj.type || obj.Type || obj.cardType || 'Unknown').trim();

  // Get description
  const description = String(obj.description || obj.desc || obj.text || obj.Description || '').trim();

  // Get ID
  let id: string | number;
  if (obj.id !== undefined) {
    id = typeof obj.id === 'number' ? obj.id : String(obj.id);
  } else {
    id = generateCardId(name);
  }

  // Get score
  let score: number | undefined;
  if (obj.score !== undefined) {
    const parsed = typeof obj.score === 'number' ? obj.score : parseInt(String(obj.score), 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      score = parsed;
    }
  }

  // Get image URL
  const imageUrl = obj.imageUrl || obj.image_url || obj.image;

  // Get attributes (everything else)
  const attributes: Record<string, unknown> = {};
  const knownKeys = ['id', 'name', 'type', 'description', 'desc', 'text', 'score', 'imageUrl', 'image_url', 'image', 'Name', 'Type', 'Description', 'cardType'];

  for (const [key, value] of Object.entries(obj)) {
    if (!knownKeys.includes(key)) {
      attributes[key] = value;
    }
  }

  return {
    id,
    name,
    type,
    description,
    score,
    imageUrl: typeof imageUrl === 'string' ? imageUrl : undefined,
    attributes,
  };
}

/**
 * Parse a CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

/**
 * Generate a numeric ID from a card name (hash)
 */
function generateCardId(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Validate a parsed cube
 */
export function validateCube(
  cube: ParsedCube,
  minCards: number = 40
): { valid: boolean; errors: string[] } {
  const errors: string[] = [...cube.errors];

  if (cube.cards.length < minCards) {
    errors.push(`Cube needs at least ${minCards} cards (found ${cube.cards.length})`);
  }

  // Validate game config exists
  try {
    getGameConfig(cube.gameId);
  } catch {
    errors.push(`Unknown game: ${cube.gameId}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Convert parsed cube to card map format for storage
 */
export function cubeToCardMap(cards: Card[]): Record<string, unknown> {
  const cardMap: Record<string, unknown> = {};

  for (const card of cards) {
    const id = String(card.id);
    cardMap[id] = {
      id: card.id,
      name: card.name,
      type: card.type,
      description: card.description,
      score: card.score,
      imageUrl: card.imageUrl,
      attributes: card.attributes,
    };
  }

  return cardMap;
}

/**
 * Read and parse a file (CSV or JSON)
 */
export async function parseUploadedFile(
  file: File,
  gameId: string
): Promise<ParsedCube> {
  const content = await file.text();
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'json') {
    return parseJsonCube(content, gameId);
  } else if (extension === 'csv') {
    return parseCsvCube(content, { gameId });
  } else {
    // Try to detect format
    const trimmed = content.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return parseJsonCube(content, gameId);
    } else {
      return parseCsvCube(content, { gameId });
    }
  }
}

/**
 * Enrich Yu-Gi-Oh cards with data from YGOProDeck API
 * Call this after parsing a Yu-Gi-Oh cube to fetch full card metadata
 */
export async function enrichYuGiOhCube(
  cube: ParsedCube,
  onProgress?: (current: number, total: number) => void
): Promise<ParsedCube> {
  if (cube.gameId !== 'yugioh') {
    return cube;
  }

  // Extract card IDs that need enrichment
  const cardIds = cube.cards
    .map(card => typeof card.id === 'number' ? card.id : parseInt(String(card.id), 10))
    .filter(id => !isNaN(id) && id > 0);

  if (cardIds.length === 0) {
    cube.errors.push('No valid Yu-Gi-Oh card IDs found');
    return cube;
  }

  // Fetch card data from API in batches
  const enrichedCards: Card[] = [];
  const batchSize = 50;
  const userScores = new Map<number, number>();

  // Preserve user-provided scores
  for (const card of cube.cards) {
    const id = typeof card.id === 'number' ? card.id : parseInt(String(card.id), 10);
    if (card.score !== undefined) {
      userScores.set(id, card.score);
    }
  }

  for (let i = 0; i < cardIds.length; i += batchSize) {
    const batch = cardIds.slice(i, i + batchSize);
    onProgress?.(i, cardIds.length);

    try {
      const apiCards = await cardService.getCards(batch);

      for (const apiCard of apiCards) {
        enrichedCards.push({
          id: apiCard.id,
          name: apiCard.name,
          type: apiCard.type,
          description: apiCard.desc || '',
          score: userScores.get(apiCard.id),
          // Use YGOProDeck image URL for cards without local images
          imageUrl: `https://images.ygoprodeck.com/images/cards/${apiCard.id}.jpg`,
          attributes: {
            atk: apiCard.atk,
            def: apiCard.def,
            level: apiCard.level,
            attribute: apiCard.attribute,
            race: apiCard.race,
            archetype: apiCard.archetype,
            linkval: apiCard.linkval,
          },
        });
      }

      // Track cards not found in API
      const foundIds = new Set(apiCards.map(c => c.id));
      for (const id of batch) {
        if (!foundIds.has(id)) {
          cube.warnings.push(`Card ID ${id} not found in YGOProDeck database`);
        }
      }
    } catch (error) {
      cube.warnings.push(`Failed to fetch batch starting at ${i}: ${error}`);
    }
  }

  onProgress?.(cardIds.length, cardIds.length);

  return {
    ...cube,
    cards: enrichedCards,
  };
}

/**
 * Enrich MTG cards with data from Scryfall API
 * Call this after parsing an MTG cube to fetch full card metadata
 */
export async function enrichMTGCube(
  cube: ParsedCube,
  onProgress?: (current: number, total: number) => void
): Promise<ParsedCube> {
  if (cube.gameId !== 'mtg') {
    return cube;
  }

  // Extract card names that need enrichment
  const cardNames = cube.cards
    .map(card => card.name)
    .filter(name => name && name !== 'Unknown');

  if (cardNames.length === 0) {
    cube.errors.push('No valid MTG card names found');
    return cube;
  }

  // Preserve user-provided scores by name
  const userScores = new Map<string, number>();
  for (const card of cube.cards) {
    if (card.score !== undefined) {
      userScores.set(card.name.toLowerCase(), card.score);
    }
  }

  onProgress?.(0, cardNames.length);

  try {
    const { cards: apiCards, notFound } = await mtgCardService.getCardsByNames(cardNames);

    // Apply user scores to fetched cards
    const enrichedCards: Card[] = apiCards.map(card => ({
      ...card,
      score: userScores.get(card.name.toLowerCase()),
    }));

    // Report cards not found
    for (const name of notFound) {
      cube.warnings.push(`Card "${name}" not found in Scryfall database`);
    }

    onProgress?.(cardNames.length, cardNames.length);

    return {
      ...cube,
      cards: enrichedCards,
    };
  } catch (error) {
    cube.errors.push(`Failed to fetch MTG card data: ${error}`);
    return cube;
  }
}

/**
 * Check if a cube needs enrichment (missing essential data)
 */
export function cubeNeedsEnrichment(cube: ParsedCube): boolean {
  // Yu-Gi-Oh enrichment
  if (cube.gameId === 'yugioh') {
    // Check if cards are missing essential data (type is 'Unknown' or description is empty)
    const needsEnrichment = cube.cards.some(card =>
      card.type === 'Unknown' ||
      !card.description ||
      (typeof card.id === 'number' && card.id > 1000000) // Large numeric ID suggests YGOProDeck ID
    );
    return needsEnrichment;
  }

  // MTG enrichment
  if (cube.gameId === 'mtg') {
    // Check if cards are missing essential data
    const needsEnrichment = cube.cards.some(card =>
      card.type === 'Unknown' ||
      !card.imageUrl
    );
    return needsEnrichment;
  }

  return false;
}

/**
 * Enrich a cube based on its game type
 */
export async function enrichCube(
  cube: ParsedCube,
  onProgress?: (current: number, total: number) => void
): Promise<ParsedCube> {
  if (cube.gameId === 'yugioh') {
    return enrichYuGiOhCube(cube, onProgress);
  }
  if (cube.gameId === 'mtg') {
    return enrichMTGCube(cube, onProgress);
  }
  return cube;
}
