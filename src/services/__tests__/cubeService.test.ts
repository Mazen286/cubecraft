/**
 * Tests for cube service in src/services/cubeService.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cubeService } from '../cubeService';

// Mock the supabase module
vi.mock('../../lib/supabase', () => ({
  getSupabase: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  })),
}));

// Mock fetch for loading cubes
const mockFetch = vi.fn();
(globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = mockFetch;

// Sample raw cube data (legacy format)
const legacyCubeData = {
  id: 'test-cube',
  name: 'Test Cube',
  cardCount: 3,
  generatedAt: '2024-01-01T00:00:00Z',
  cardMap: {
    '46986414': {
      id: 46986414,
      name: 'Dark Magician',
      type: 'Normal Monster',
      desc: 'The ultimate wizard.',
      atk: 2500,
      def: 2100,
      level: 7,
      attribute: 'DARK',
      race: 'Spellcaster',
      score: 75,
    },
    '89631139': {
      id: 89631139,
      name: 'Blue-Eyes White Dragon',
      type: 'Normal Monster',
      desc: 'This legendary dragon.',
      atk: 3000,
      def: 2500,
      level: 8,
      attribute: 'LIGHT',
      race: 'Dragon',
      score: 85,
    },
    '24094653': {
      id: 24094653,
      name: 'Pot of Greed',
      type: 'Spell Card',
      desc: 'Draw 2 cards.',
      score: 95,
    },
  },
};

// Sample raw cube data (new generic format)
const newFormatCubeData = {
  id: 'new-cube',
  name: 'New Format Cube',
  cardCount: 2,
  generatedAt: '2024-01-01T00:00:00Z',
  gameId: 'yugioh',
  version: '2.0',
  cardMap: {
    '46986414': {
      id: 46986414,
      name: 'Dark Magician',
      type: 'Normal Monster',
      description: 'The ultimate wizard.',
      score: 75,
      attributes: {
        atk: 2500,
        def: 2100,
        level: 7,
        attribute: 'DARK',
        race: 'Spellcaster',
      },
    },
    '89631139': {
      id: 89631139,
      name: 'Blue-Eyes White Dragon',
      type: 'Normal Monster',
      description: 'This legendary dragon.',
      score: 85,
      attributes: {
        atk: 3000,
        def: 2500,
        level: 8,
        attribute: 'LIGHT',
        race: 'Dragon',
      },
    },
  },
};

describe('cubeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cubeService.clearAllCaches();
  });

  afterEach(() => {
    cubeService.clearAllCaches();
  });

  describe('getAvailableCubes', () => {
    it('should return list of available cubes', () => {
      const cubes = cubeService.getAvailableCubes();
      expect(cubes.length).toBeGreaterThan(0);
    });

    it('should filter cubes by gameId', () => {
      const yugiohCubes = cubeService.getAvailableCubes('yugioh');
      const mtgCubes = cubeService.getAvailableCubes('mtg');

      yugiohCubes.forEach(cube => {
        expect(cube.gameId).toBe('yugioh');
      });

      mtgCubes.forEach(cube => {
        expect(cube.gameId).toBe('mtg');
      });
    });

    it('should return all cubes when no filter provided', () => {
      const allCubes = cubeService.getAvailableCubes();
      const yugiohCubes = cubeService.getAvailableCubes('yugioh');
      const mtgCubes = cubeService.getAvailableCubes('mtg');

      expect(allCubes.length).toBeGreaterThanOrEqual(yugiohCubes.length + mtgCubes.length);
    });
  });

  describe('loadCube', () => {
    it('should load cube data from fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(legacyCubeData),
      });

      const cube = await cubeService.loadCube('test-cube');

      expect(cube.id).toBe('test-cube');
      expect(cube.name).toBe('Test Cube');
      expect(cube.cards.length).toBe(3);
    });

    it('should return cached cube on subsequent loads', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(legacyCubeData),
      });

      await cubeService.loadCube('test-cube');
      await cubeService.loadCube('test-cube');

      // Fetch should only be called once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw error for failed fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(cubeService.loadCube('nonexistent')).rejects.toThrow();
    });

    it('should throw error for empty cube', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'empty',
          name: 'Empty Cube',
          cardMap: {},
        }),
      });

      await expect(cubeService.loadCube('empty')).rejects.toThrow('Cube file is empty or invalid');
    });

    it('should throw error for custom cube', async () => {
      await expect(cubeService.loadCube('custom')).rejects.toThrow('Custom cube not yet supported');
    });
  });

  describe('processCubeData (legacy format)', () => {
    it('should normalize legacy card format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(legacyCubeData),
      });

      const cube = await cubeService.loadCube('legacy-test');
      const darkMagician = cube.cardMap[46986414];

      expect(darkMagician.name).toBe('Dark Magician');
      expect(darkMagician.type).toBe('Normal Monster');
      expect(darkMagician.desc).toBe('The ultimate wizard.');
      expect(darkMagician.atk).toBe(2500);
      expect(darkMagician.def).toBe(2100);
      expect(darkMagician.level).toBe(7);
      expect(darkMagician.attribute).toBe('DARK');
      expect(darkMagician.race).toBe('Spellcaster');
      expect(darkMagician.score).toBe(75);
    });
  });

  describe('processCubeData (new generic format)', () => {
    it('should convert new format to YuGiOhCard', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(newFormatCubeData),
      });

      const cube = await cubeService.loadCube('new-format-test');
      const darkMagician = cube.cardMap[46986414];

      expect(darkMagician.name).toBe('Dark Magician');
      expect(darkMagician.type).toBe('Normal Monster');
      expect(darkMagician.desc).toBe('The ultimate wizard.');
      expect(darkMagician.atk).toBe(2500);
      expect(darkMagician.def).toBe(2100);
      expect(darkMagician.level).toBe(7);
      expect(darkMagician.attribute).toBe('DARK');
      expect(darkMagician.race).toBe('Spellcaster');
      expect(darkMagician.score).toBe(75);
    });

    it('should preserve original attributes for non-YuGiOh games', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(newFormatCubeData),
      });

      const cube = await cubeService.loadCube('attrs-test');
      const card = cube.cardMap[46986414];

      expect(card.attributes).toBeDefined();
      expect((card.attributes as Record<string, unknown>).atk).toBe(2500);
    });
  });

  describe('getCubeCardIds', () => {
    it('should return array of card IDs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(legacyCubeData),
      });

      await cubeService.loadCube('ids-test');
      const ids = cubeService.getCubeCardIds('ids-test');

      expect(ids).toContain(46986414);
      expect(ids).toContain(89631139);
      expect(ids).toContain(24094653);
      expect(ids.length).toBe(3);
    });

    it('should throw error if cube not loaded', () => {
      expect(() => cubeService.getCubeCardIds('not-loaded')).toThrow(
        'Cube "not-loaded" not loaded'
      );
    });
  });

  describe('getCubeCards', () => {
    it('should return array of cards', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(legacyCubeData),
      });

      await cubeService.loadCube('cards-test');
      const cards = cubeService.getCubeCards('cards-test');

      expect(cards.length).toBe(3);
      expect(cards.find(c => c.name === 'Dark Magician')).toBeDefined();
    });

    it('should throw error if cube not loaded', () => {
      expect(() => cubeService.getCubeCards('not-loaded')).toThrow(
        'Cube "not-loaded" not loaded'
      );
    });
  });

  describe('getCard', () => {
    it('should return specific card by ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(legacyCubeData),
      });

      await cubeService.loadCube('getcard-test');
      const card = cubeService.getCard('getcard-test', 46986414);

      expect(card).not.toBeNull();
      expect(card?.name).toBe('Dark Magician');
    });

    it('should return null for nonexistent card', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(legacyCubeData),
      });

      await cubeService.loadCube('getcard-test2');
      const card = cubeService.getCard('getcard-test2', 99999);

      expect(card).toBeNull();
    });

    it('should return null if cube not loaded', () => {
      const card = cubeService.getCard('not-loaded', 46986414);
      expect(card).toBeNull();
    });
  });

  describe('getCards', () => {
    it('should return multiple cards by IDs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(legacyCubeData),
      });

      await cubeService.loadCube('getcards-test');
      const cards = cubeService.getCards('getcards-test', [46986414, 89631139]);

      expect(cards.length).toBe(2);
    });

    it('should filter out nonexistent cards', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(legacyCubeData),
      });

      await cubeService.loadCube('getcards-filter-test');
      const cards = cubeService.getCards('getcards-filter-test', [46986414, 99999]);

      expect(cards.length).toBe(1);
      expect(cards[0].name).toBe('Dark Magician');
    });

    it('should return empty array if cube not loaded', () => {
      const cards = cubeService.getCards('not-loaded', [46986414]);
      expect(cards).toEqual([]);
    });
  });

  describe('getCardFromAnyCube', () => {
    it('should find card from any loaded cube', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(legacyCubeData),
      });

      await cubeService.loadCube('any-cube-test');
      const card = cubeService.getCardFromAnyCube(46986414);

      expect(card).not.toBeNull();
      expect(card?.name).toBe('Dark Magician');
    });

    it('should return null if card not in any cube', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(legacyCubeData),
      });

      await cubeService.loadCube('any-cube-test2');
      const card = cubeService.getCardFromAnyCube(99999);

      expect(card).toBeNull();
    });

    it('should return null if no cubes loaded', () => {
      const card = cubeService.getCardFromAnyCube(46986414);
      expect(card).toBeNull();
    });
  });

  describe('getCardsFromAnyCube', () => {
    it('should return cards from any loaded cube', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(legacyCubeData),
      });

      await cubeService.loadCube('multi-any-test');
      const cards = cubeService.getCardsFromAnyCube([46986414, 89631139]);

      expect(cards.length).toBe(2);
    });

    it('should return empty array if no cubes loaded', () => {
      const cards = cubeService.getCardsFromAnyCube([46986414]);
      expect(cards).toEqual([]);
    });
  });

  describe('isCubeLoaded', () => {
    it('should return true for loaded cube', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(legacyCubeData),
      });

      await cubeService.loadCube('loaded-test');

      expect(cubeService.isCubeLoaded('loaded-test')).toBe(true);
    });

    it('should return false for not loaded cube', () => {
      expect(cubeService.isCubeLoaded('not-loaded')).toBe(false);
    });
  });

  describe('validateCubeForDraft', () => {
    it('should return valid for cube with enough cards', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ...legacyCubeData,
          cardMap: Object.fromEntries(
            Array.from({ length: 100 }, (_, i) => [
              i,
              { id: i, name: `Card ${i}`, type: 'Effect Monster', desc: '' },
            ])
          ),
        }),
      });

      const result = await cubeService.validateCubeForDraft('validate-test', 2, 45);

      expect(result.valid).toBe(true);
    });

    it('should return invalid for cube with not enough cards', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(legacyCubeData),
      });

      const result = await cubeService.validateCubeForDraft('validate-small', 4, 45);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cube has 3 cards');
    });

    it('should return invalid for nonexistent cube', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      const result = await cubeService.validateCubeForDraft('nonexistent', 2, 45);

      expect(result.valid).toBe(false);
    });
  });

  describe('clearCubeCache', () => {
    it('should clear specific cube cache', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(legacyCubeData),
      });

      await cubeService.loadCube('clear-test');
      expect(cubeService.isCubeLoaded('clear-test')).toBe(true);

      cubeService.clearCubeCache('clear-test');
      expect(cubeService.isCubeLoaded('clear-test')).toBe(false);
    });
  });

  describe('clearAllCaches', () => {
    it('should clear all cube caches', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(legacyCubeData),
      });

      await cubeService.loadCube('clear-all-1');
      await cubeService.loadCube('clear-all-2');

      cubeService.clearAllCaches();

      expect(cubeService.isCubeLoaded('clear-all-1')).toBe(false);
      expect(cubeService.isCubeLoaded('clear-all-2')).toBe(false);
    });
  });

  describe('reloadCube', () => {
    it('should clear cache and reload', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(legacyCubeData),
      });

      await cubeService.loadCube('reload-test');
      await cubeService.reloadCube('reload-test');

      // Fetch should be called twice (initial + reload)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCubeGameId', () => {
    it('should return game ID for loaded cube', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ...legacyCubeData,
          gameId: 'yugioh',
        }),
      });

      await cubeService.loadCube('gameid-test');
      const gameId = cubeService.getCubeGameId('gameid-test');

      expect(gameId).toBe('yugioh');
    });

    it('should return null for not loaded cube', () => {
      const gameId = cubeService.getCubeGameId('not-loaded');
      expect(gameId).toBeNull();
    });

    it('should default to yugioh for legacy format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(legacyCubeData), // No gameId field
      });

      await cubeService.loadCube('legacy-gameid');
      const gameId = cubeService.getCubeGameId('legacy-gameid');

      expect(gameId).toBe('yugioh');
    });
  });

  describe('isDatabaseCube', () => {
    it('should return true for db: prefixed IDs', () => {
      expect(cubeService.isDatabaseCube('db:123')).toBe(true);
      expect(cubeService.isDatabaseCube('db:some-cube-id')).toBe(true);
    });

    it('should return false for regular IDs', () => {
      expect(cubeService.isDatabaseCube('the-library')).toBe(false);
      expect(cubeService.isDatabaseCube('mtg-starter')).toBe(false);
    });
  });
});
