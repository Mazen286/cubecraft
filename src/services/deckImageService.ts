// Deck Image Generator Service
// Creates shareable deck images with card art, tier badges, and section headers

import type { YuGiOhCard } from '../types';
import { getTierFromScore } from '../lib/utils';

const CARD_WIDTH = 80;
const CARD_HEIGHT = 117;
const CARDS_PER_ROW = 12;
const PADDING = 16;
const SECTION_HEADER_HEIGHT = 32;
const SECTION_GAP = 24;
const BACKGROUND_COLOR = '#0a0a0a';

// Tier badge colors
const TIER_COLORS: Record<string, string> = {
  S: '#ff4444',
  A: '#ff8c00',
  B: '#ffd700',
  C: '#44ff44',
  D: '#44ffff',
  E: '#4488ff',
  F: '#888888',
};

// Proxy URL to bypass CORS
function getProxiedImageUrl(originalUrl: string): string {
  // Handle local images (no proxy needed for same-origin)
  if (originalUrl.startsWith('/')) {
    return originalUrl;
  }
  // Use weserv.nl proxy for external images
  const url = originalUrl.replace(/^https?:\/\//, '');
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=${CARD_WIDTH * 2}&h=${CARD_HEIGHT * 2}&fit=cover`;
}

// Load image with CORS support
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

interface DeckSection {
  title: string;
  color: string;
  cards: YuGiOhCard[];
}

export interface GenerateDeckImageOptions {
  mainDeckCards: YuGiOhCard[];
  extraDeckCards: YuGiOhCard[];
  sideDeckCards: YuGiOhCard[];
  showTiers?: boolean;
  getCardImageUrl: (card: YuGiOhCard) => string;
}

export async function generateDeckImage(options: GenerateDeckImageOptions): Promise<Blob> {
  const { mainDeckCards, extraDeckCards, sideDeckCards, showTiers = true, getCardImageUrl } = options;

  // Build sections
  const sections: DeckSection[] = [];

  if (mainDeckCards.length > 0) {
    sections.push({ title: 'Main Deck', color: '#3b82f6', cards: mainDeckCards });
  }
  if (extraDeckCards.length > 0) {
    sections.push({ title: 'Extra Deck', color: '#a855f7', cards: extraDeckCards });
  }
  if (sideDeckCards.length > 0) {
    sections.push({ title: 'Side Deck', color: '#f97316', cards: sideDeckCards });
  }

  // Calculate canvas dimensions
  let totalHeight = PADDING;
  const sectionHeights: number[] = [];

  for (const section of sections) {
    const rows = Math.ceil(section.cards.length / CARDS_PER_ROW);
    const sectionHeight = SECTION_HEADER_HEIGHT + (rows * CARD_HEIGHT);
    sectionHeights.push(sectionHeight);
    totalHeight += sectionHeight + SECTION_GAP;
  }

  const canvasWidth = PADDING * 2 + CARDS_PER_ROW * CARD_WIDTH;
  const canvasHeight = totalHeight;

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d')!;

  // Fill background
  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Load all card images in parallel
  const allCards = [...mainDeckCards, ...extraDeckCards, ...sideDeckCards];
  const imagePromises = allCards.map(async (card) => {
    const imageUrl = getCardImageUrl(card);
    const proxiedUrl = getProxiedImageUrl(imageUrl);
    try {
      const img = await loadImage(proxiedUrl);
      return { cardId: card.id, img };
    } catch {
      // Return null for failed images
      return { cardId: card.id, img: null };
    }
  });

  const loadedImages = await Promise.all(imagePromises);
  const imageMap = new Map<string | number, HTMLImageElement | null>();
  for (const { cardId, img } of loadedImages) {
    imageMap.set(cardId, img);
  }

  // Draw sections
  let currentY = PADDING;

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    const section = sections[sectionIndex];

    // Draw section header
    ctx.fillStyle = section.color;
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${section.title}`, PADDING, currentY + 20);

    ctx.fillStyle = '#ffffff';
    ctx.font = '18px system-ui, -apple-system, sans-serif';
    const titleWidth = ctx.measureText(section.title).width;
    ctx.fillText(`  (${section.cards.length})`, PADDING + titleWidth, currentY + 20);

    currentY += SECTION_HEADER_HEIGHT;

    // Draw cards
    for (let i = 0; i < section.cards.length; i++) {
      const card = section.cards[i];
      const col = i % CARDS_PER_ROW;
      const row = Math.floor(i / CARDS_PER_ROW);
      const x = PADDING + col * CARD_WIDTH;
      const y = currentY + row * CARD_HEIGHT;

      const img = imageMap.get(card.id);

      if (img) {
        // Draw card image
        ctx.drawImage(img, x, y, CARD_WIDTH, CARD_HEIGHT);
      } else {
        // Draw placeholder
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(x, y, CARD_WIDTH, CARD_HEIGHT);
        ctx.fillStyle = '#666';
        ctx.font = '10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(card.name.substring(0, 12), x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2);
        ctx.textAlign = 'left';
      }

      // Draw tier badge if card has score
      if (showTiers && card.score !== undefined) {
        const tier = getTierFromScore(card.score);
        if (tier) {
          const badgeSize = 16;
          const badgeX = x + 2;
          const badgeY = y + 2;

          // Badge background
          ctx.fillStyle = TIER_COLORS[tier] || '#888';
          ctx.beginPath();
          ctx.arc(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2);
          ctx.fill();

          // Badge text
          ctx.fillStyle = '#000';
          ctx.font = 'bold 11px system-ui';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(tier, badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 1);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        }
      }

      // Draw card name label at top
      const nameLabel = card.name.length > 14 ? card.name.substring(0, 13) + '…' : card.name;

      // Semi-transparent background for name
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(x, y, CARD_WIDTH, 14);

      // Name text
      ctx.fillStyle = '#fff';
      ctx.font = '8px system-ui';
      ctx.fillText(nameLabel, x + 18, y + 10);
    }

    const rows = Math.ceil(section.cards.length / CARDS_PER_ROW);
    currentY += rows * CARD_HEIGHT + SECTION_GAP;
  }

  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create image blob'));
        }
      },
      'image/png',
      1.0
    );
  });
}
