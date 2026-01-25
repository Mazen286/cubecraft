/**
 * Mock game context for testing
 * Provides a test-friendly Yu-Gi-Oh game configuration
 */

import type { GameConfig } from '../config/gameConfig';
import type { Card } from '../types/card';

/**
 * Mock Yu-Gi-Oh game configuration for testing
 */
export const mockYugiohConfig: GameConfig = {
  id: 'yugioh',
  name: 'Yu-Gi-Oh!',
  shortName: 'YGO',
  storageKeyPrefix: 'yugioh-draft',
  defaultPlayerName: 'Duelist',
  botNames: [
    'Kaiba Bot',
    'Yugi Bot',
    'Joey Bot',
    'Mai Bot',
    'Tea Bot',
    'Tristan Bot',
  ],
  theme: {
    primaryColor: '#1a1a2e',
    accentColor: '#4a90d9',
  },
  cardDisplay: {},
  deckZones: [
    {
      id: 'main',
      name: 'Main Deck',
      cardBelongsTo: (card: Card) => {
        const type = card.type.toLowerCase();
        return !type.includes('fusion') && !type.includes('synchro') &&
               !type.includes('xyz') && !type.includes('link');
      },
    },
    {
      id: 'extra',
      name: 'Extra Deck',
      cardBelongsTo: (card: Card) => {
        const type = card.type.toLowerCase();
        return type.includes('fusion') || type.includes('synchro') ||
               type.includes('xyz') || type.includes('link');
      },
    },
  ],
  cardTypes: [
    'Normal Monster',
    'Effect Monster',
    'Fusion Monster',
    'Synchro Monster',
    'XYZ Monster',
    'Link Monster',
    'Spell Card',
    'Trap Card',
  ],
  getCardImageUrl: (card: Card, size: 'sm' | 'md' | 'lg') => {
    const folder = size === 'sm' ? 'cards_small' : 'cards';
    return `/images/${folder}/${card.id}.jpg`;
  },
  exportFormats: [
    {
      id: 'ydk',
      name: 'YDK (YGOPRO)',
      extension: 'ydk',
      generate: () => '#created by test\n#main\n#extra\n!side\n',
    },
  ],
  cardClassifiers: {
    isExtraDeck: (card: Card) => {
      const type = card.type.toLowerCase();
      return type.includes('fusion') || type.includes('synchro') ||
             type.includes('xyz') || type.includes('link');
    },
    isCreature: (card: Card) => card.type.toLowerCase().includes('monster'),
    isSpell: (card: Card) => card.type.toLowerCase().includes('spell'),
    isTrap: (card: Card) => card.type.toLowerCase().includes('trap'),
  },
};

/**
 * Get mock game configuration
 * Defaults to Yu-Gi-Oh config
 */
export function getMockGameConfig(gameId: string = 'yugioh'): GameConfig {
  // For now, only yugioh is supported in tests
  if (gameId !== 'yugioh') {
    throw new Error(`Unknown game: ${gameId}`);
  }
  return mockYugiohConfig;
}

/**
 * Mock getActiveGameConfig function
 * Always returns the Yu-Gi-Oh config in tests
 */
export function mockGetActiveGameConfig(): GameConfig {
  return mockYugiohConfig;
}
