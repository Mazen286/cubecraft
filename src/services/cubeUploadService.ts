// Cube Upload Service - handles parsing and validating user-uploaded cubes
// Supports CSV and JSON formats

import type { Card } from '../types/card';
import { getGameConfig } from '../config/games';

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
 * Parse a CSV file into cube cards
 * Expected format: name,type,description,score (or with header row)
 */
export function parseCsvCube(
  csvContent: string,
  options: CsvParseOptions
): ParsedCube {
  const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);
  const errors: string[] = [];
  const warnings: string[] = [];
  const cards: Card[] = [];

  const {
    gameId,
    hasHeader = true,
    nameColumn = 0,
    typeColumn = 1,
    descriptionColumn = 2,
    scoreColumn = 3,
    idColumn,
  } = options;

  const startLine = hasHeader ? 1 : 0;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Parse CSV line (handle quoted values)
    const values = parseCSVLine(line);

    if (values.length < 2) {
      warnings.push(`Line ${lineNum}: Skipped - not enough columns`);
      continue;
    }

    const name = values[nameColumn]?.trim();
    const type = values[typeColumn]?.trim() || 'Unknown';
    const description = values[descriptionColumn]?.trim() || '';
    const scoreStr = values[scoreColumn]?.trim();
    const idStr = idColumn !== undefined ? values[idColumn]?.trim() : undefined;

    if (!name) {
      warnings.push(`Line ${lineNum}: Skipped - missing card name`);
      continue;
    }

    // Generate ID if not provided
    const id = idStr ? parseInt(idStr, 10) : generateCardId(name);

    // Parse score
    let score: number | undefined;
    if (scoreStr) {
      const parsed = parseInt(scoreStr, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        score = parsed;
      } else {
        warnings.push(`Line ${lineNum}: Invalid score "${scoreStr}", using default`);
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

  // Check for duplicate names
  const names = new Set<string>();
  const duplicates: string[] = [];
  for (const card of cube.cards) {
    if (names.has(card.name.toLowerCase())) {
      duplicates.push(card.name);
    }
    names.add(card.name.toLowerCase());
  }

  if (duplicates.length > 0) {
    errors.push(`Duplicate card names found: ${duplicates.slice(0, 5).join(', ')}${duplicates.length > 5 ? ` and ${duplicates.length - 5} more` : ''}`);
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
