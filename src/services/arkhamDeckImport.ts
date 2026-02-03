/**
 * ArkhamDB Deck Import Service
 * Parses ArkhamDB text export and OCTGN (.o8d) formats
 */

import { arkhamCardService } from './arkhamCardService';

export interface ImportedDeck {
  investigatorCode: string | null;
  slots: Record<string, number>;
  name?: string;
  errors: string[];
  warnings: string[];
}

// Common section headers in ArkhamDB exports
const SECTION_HEADERS = new Set([
  'assets', 'events', 'skills', 'treachery', 'treacheries',
  'hand', 'hand x2', 'arcane', 'arcane x2', 'accessory', 'body', 'ally', 'tarot',
  'permanent', 'weakness', 'weaknesses', 'basic weakness', 'basic weaknesses',
  'investigator', 'deck', 'sideboard', 'side deck',
]);

// Lines that should be skipped entirely
const SKIP_PATTERNS = [
  /^packs:/i,           // "Packs: From Core Set to..."
  /^total:/i,           // "Total: 30 cards"
  /^deck size:/i,       // "Deck Size: 30"
  /^experience:/i,      // "Experience: 0"
  /^xp:/i,              // "XP: 0"
  /^\d+ cards?$/i,      // "30 cards"
  /^-+$/,               // "----" dividers
  /^=+$/,               // "====" dividers
];

/**
 * Parse ArkhamDB text export format
 * Format examples:
 * - "2x Shrivelling (Core Set)"
 * - "1x Agnes Baker (Core Set)"
 * - "Shrivelling (5) x2"
 * - "2 Shrivelling"
 * - "01060" (just card code)
 */
export function parseArkhamDBText(text: string): ImportedDeck {
  const result: ImportedDeck = {
    investigatorCode: null,
    slots: {},
    errors: [],
    warnings: [],
  };

  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  let isFirstLine = true;

  for (const line of lines) {
    // Skip comments
    if (line.startsWith('#') || line.startsWith('//')) {
      continue;
    }

    // Skip lines ending with colon (section headers)
    if (line.endsWith(':')) {
      continue;
    }

    // Skip known section headers (case-insensitive)
    if (SECTION_HEADERS.has(line.toLowerCase())) {
      continue;
    }

    // Skip lines matching skip patterns
    if (SKIP_PATTERNS.some(pattern => pattern.test(line))) {
      continue;
    }

    // First line might be deck title with investigator name - check for investigator
    if (isFirstLine) {
      isFirstLine = false;
      // Check if this line contains an investigator name (often in format "Investigator Name - Deck Title")
      const investigatorFromTitle = tryExtractInvestigatorFromTitle(line);
      if (investigatorFromTitle) {
        result.investigatorCode = investigatorFromTitle.code;
        result.name = line; // Keep the full line as deck name
        continue;
      }
    }

    // Check if line is just a card code (5 digits)
    const codeMatch = line.match(/^(\d{5})$/);
    if (codeMatch) {
      const card = arkhamCardService.getCard(codeMatch[1]);
      if (card) {
        if (card.type_code === 'investigator') {
          result.investigatorCode = card.code;
        } else {
          result.slots[card.code] = (result.slots[card.code] || 0) + 1;
        }
        continue;
      } else {
        result.warnings.push(`Card not found: "${codeMatch[1]}"`);
        continue;
      }
    }

    // Try to parse the line
    const parsed = parseTextLine(line);

    if (!parsed) {
      // Don't warn for lines that look like metadata
      if (!line.includes(':') && line.length > 2) {
        result.warnings.push(`Could not parse line: "${line}"`);
      }
      continue;
    }

    const { name, quantity, xp, code } = parsed;

    // If we got a code, use it directly
    if (code) {
      const card = arkhamCardService.getCard(code);
      if (card) {
        if (card.type_code === 'investigator') {
          result.investigatorCode = card.code;
        } else {
          result.slots[card.code] = (result.slots[card.code] || 0) + quantity;
        }
        continue;
      }
    }

    // Find the card by name
    const card = arkhamCardService.findCardByName(name, xp);

    if (!card) {
      result.warnings.push(`Card not found: "${name}"${xp !== undefined ? ` (${xp})` : ''}`);
      continue;
    }

    // Check if it's an investigator
    if (card.type_code === 'investigator') {
      result.investigatorCode = card.code;
    } else {
      // Add to slots
      result.slots[card.code] = (result.slots[card.code] || 0) + quantity;
    }
  }

  return result;
}

/**
 * Try to extract investigator from a deck title line
 * e.g., "Jacqueline Fine - My Cool Deck" or "Agnes Baker"
 */
function tryExtractInvestigatorFromTitle(line: string): { code: string } | null {
  // Try splitting by common separators
  const separators = [' - ', ' – ', ' | ', ': '];

  for (const sep of separators) {
    if (line.includes(sep)) {
      const parts = line.split(sep);
      const possibleName = parts[0].trim();
      const card = arkhamCardService.findCardByName(possibleName);
      if (card?.type_code === 'investigator') {
        return { code: card.code };
      }
    }
  }

  // Try the whole line as investigator name
  const card = arkhamCardService.findCardByName(line);
  if (card?.type_code === 'investigator') {
    return { code: card.code };
  }

  return null;
}

/**
 * Extract XP from card name that uses level dots (•, ●, or *)
 * Returns [cleanName, xpLevel] or [originalName, undefined]
 */
function extractXpFromDots(name: string): [string, number | undefined] {
  // Match bullet points: • (U+2022), ● (U+25CF), or * asterisks
  // Pattern: card name followed by space and 1-5 dots/bullets
  const dotPatterns = [
    /^(.+?)\s+([•●*]{1,5})$/,      // "Shrivelling •••••"
    /^(.+?)\s+\(([•●*]{1,5})\)$/,  // "Shrivelling (•••••)"
  ];

  for (const pattern of dotPatterns) {
    const match = name.match(pattern);
    if (match) {
      const cleanName = match[1].trim();
      const dots = match[2];
      const xp = dots.length;
      return [cleanName, xp];
    }
  }

  return [name, undefined];
}

/**
 * Parse a single line of text format
 */
function parseTextLine(line: string): { name: string; quantity: number; xp?: number; code?: string } | null {
  // Remove common prefixes/suffixes
  const cleaned = line.trim();

  // Pattern 0: "2x 01060" or "2 01060" - quantity + card code
  let match = cleaned.match(/^(\d+)x?\s+(\d{5})$/i);
  if (match) {
    return { name: '', quantity: parseInt(match[1], 10), code: match[2] };
  }

  // Pattern 1: "2x Card Name [4] (Set)" or "2x Card Name (5) (Set)" - with XP in brackets or parens
  // Also handles "2x Card Name ••••• (Set)" with XP dots
  match = cleaned.match(/^(\d+)x\s+(.+?)(?:\s+[\[(](\d+)[\])])?(?:\s+\([^)]+\))?$/i);
  if (match) {
    let cardName = match[2].trim();
    let xp = match[3] ? parseInt(match[3], 10) : undefined;

    // Check for XP in square brackets within the card name (e.g., "Sixth Sense [4]")
    const bracketMatch = cardName.match(/^(.+?)\s+\[(\d+)\]$/);
    if (bracketMatch && parseInt(bracketMatch[2], 10) <= 5) {
      cardName = bracketMatch[1].trim();
      xp = parseInt(bracketMatch[2], 10);
    }

    // Check for XP dots in the card name
    const [cleanName, dotXp] = extractXpFromDots(cardName);
    if (dotXp !== undefined) {
      cardName = cleanName;
      xp = dotXp;
    }

    return { name: cardName, quantity: parseInt(match[1], 10), xp };
  }

  // Pattern 2: "Card Name x2" or "Card Name (Set) x2"
  match = cleaned.match(/^(.+?)\s+x(\d+)$/i);
  if (match) {
    // Extract XP from name if present, e.g., "Shrivelling (5) x2" or "Shrivelling [4] x2" or "Shrivelling ••••• x2"
    let nameWithXp = match[1].trim();
    const quantity = parseInt(match[2], 10);

    // Check for XP dots first
    const [dotCleanName, dotXp] = extractXpFromDots(nameWithXp);
    if (dotXp !== undefined) {
      return { name: dotCleanName, quantity, xp: dotXp };
    }

    // Check for numeric XP in square brackets [4]
    const bracketMatch = nameWithXp.match(/^(.+?)\s+\[(\d+)\](?:\s+\([^)]+\))?$/);
    if (bracketMatch && parseInt(bracketMatch[2], 10) <= 5) {
      return { name: bracketMatch[1].trim(), quantity, xp: parseInt(bracketMatch[2], 10) };
    }

    // Check for numeric XP in parentheses (5)
    const xpMatch = nameWithXp.match(/^(.+?)\s+\((\d+)\)$/);
    if (xpMatch && parseInt(xpMatch[2], 10) <= 5) {
      return { name: xpMatch[1].trim(), quantity, xp: parseInt(xpMatch[2], 10) };
    }

    // Remove set name in parentheses
    const name = nameWithXp.replace(/\s*\([^)]*\)\s*$/, '').trim();
    return { name, quantity };
  }

  // Pattern 3: "Card Name (5)" or "Card Name [4]" - with XP level only, or "Card Name •••••"
  // First check for XP dots
  const [dotCleanName, dotXpLevel] = extractXpFromDots(cleaned);
  if (dotXpLevel !== undefined) {
    return { name: dotCleanName, quantity: 1, xp: dotXpLevel };
  }

  // Check for XP in square brackets [4]
  match = cleaned.match(/^(.+?)\s+\[(\d+)\](?:\s+\([^)]+\))?$/);
  if (match && parseInt(match[2], 10) <= 5) {
    return { name: match[1].trim(), quantity: 1, xp: parseInt(match[2], 10) };
  }

  // Check for XP in parentheses (5)
  match = cleaned.match(/^(.+?)\s+\((\d+)\)$/);
  if (match && parseInt(match[2], 10) <= 5) {
    // Only treat as XP if the number is 0-5 (valid XP range)
    return { name: match[1].trim(), quantity: 1, xp: parseInt(match[2], 10) };
  }

  // Pattern 4: "2 Card Name" or "2 Card Name (5)" or "2 Card Name [4]" - number at start (but not 5 digits)
  match = cleaned.match(/^(\d{1,2})\s+(.+?)(?:\s+[\[(](\d+)[\])])?(?:\s+\([^)]+\))?$/);
  if (match) {
    let cardName = match[2].trim();
    let xp = match[3] ? parseInt(match[3], 10) : undefined;

    // Check for XP in square brackets within the card name
    const bracketMatch = cardName.match(/^(.+?)\s+\[(\d+)\]$/);
    if (bracketMatch && parseInt(bracketMatch[2], 10) <= 5) {
      cardName = bracketMatch[1].trim();
      xp = parseInt(bracketMatch[2], 10);
    }

    // Check for XP dots in the card name
    const [cleanName, dotXp] = extractXpFromDots(cardName);
    if (dotXp !== undefined) {
      cardName = cleanName;
      xp = dotXp;
    }

    return { name: cardName, quantity: parseInt(match[1], 10), xp };
  }

  // Pattern 5: Just card name (with optional set info)
  match = cleaned.match(/^(.+?)(?:\s+\([^)]+\))?$/);
  if (match && match[1].trim().length > 0) {
    return { name: match[1].trim(), quantity: 1 };
  }

  return null;
}

/**
 * Parse OCTGN deck format (.o8d XML)
 * Example:
 * <deck game="a6d114c7-2e2a-4896-ad8c-0571c6f119c4">
 *   <section name="Investigator">
 *     <card qty="1" id="01004">Agnes Baker</card>
 *   </section>
 *   <section name="Slots">
 *     <card qty="2" id="01060">Shrivelling</card>
 *   </section>
 * </deck>
 */
export function parseOCTGN(xmlText: string): ImportedDeck {
  const result: ImportedDeck = {
    investigatorCode: null,
    slots: {},
    errors: [],
    warnings: [],
  };

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      result.errors.push('Invalid XML format');
      return result;
    }

    // Get deck name if available
    const deckElement = doc.querySelector('deck');
    if (deckElement?.getAttribute('name')) {
      result.name = deckElement.getAttribute('name') || undefined;
    }

    // Process all card elements
    const cards = doc.querySelectorAll('card');

    cards.forEach(cardElement => {
      const id = cardElement.getAttribute('id');
      const qty = parseInt(cardElement.getAttribute('qty') || '1', 10);
      const cardName = cardElement.textContent?.trim();

      if (!id) {
        if (cardName) {
          result.warnings.push(`Card without ID: "${cardName}"`);
        }
        return;
      }

      // OCTGN uses 5-digit codes, ArkhamDB uses them too
      // Try to find the card
      let card = arkhamCardService.getCard(id);

      // If not found, try with leading zeros
      if (!card && id.length < 5) {
        card = arkhamCardService.getCard(id.padStart(5, '0'));
      }

      if (!card && cardName) {
        // Try to find by name as fallback
        card = arkhamCardService.findCardByName(cardName);
      }

      if (!card) {
        result.warnings.push(`Card not found: ID "${id}"${cardName ? ` (${cardName})` : ''}`);
        return;
      }

      // Check if investigator
      if (card.type_code === 'investigator') {
        result.investigatorCode = card.code;
      } else {
        result.slots[card.code] = (result.slots[card.code] || 0) + qty;
      }
    });

  } catch (error) {
    result.errors.push(`Failed to parse OCTGN format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Auto-detect format and parse
 */
export function parseArkhamDeck(content: string): ImportedDeck {
  const trimmed = content.trim();

  // Check if it's XML (OCTGN format)
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<deck')) {
    return parseOCTGN(content);
  }

  // Otherwise treat as text format
  return parseArkhamDBText(content);
}

/**
 * Parse from file
 */
export async function parseArkhamDeckFile(file: File): Promise<ImportedDeck> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) {
        resolve({
          investigatorCode: null,
          slots: {},
          errors: ['File is empty'],
          warnings: [],
        });
        return;
      }

      resolve(parseArkhamDeck(content));
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}
