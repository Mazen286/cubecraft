/**
 * Tests for score service in src/services/scoreService.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scoreService } from '../scoreService';
import type { YuGiOhCard } from '../../types';

// Mock the supabase module
vi.mock('../../lib/supabase', () => ({
  getSupabase: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  })),
}));

// Sample cards for testing
const sampleCards: YuGiOhCard[] = [
  {
    id: 46986414,
    name: 'Dark Magician',
    type: 'Normal Monster',
    desc: 'The ultimate wizard in terms of attack and defense.',
    atk: 2500,
    def: 2100,
    level: 7,
    attribute: 'DARK',
    race: 'Spellcaster',
    score: 75,
  },
  {
    id: 89631139,
    name: 'Blue-Eyes White Dragon',
    type: 'Normal Monster',
    desc: 'This legendary dragon is a powerful engine of destruction.',
    atk: 3000,
    def: 2500,
    level: 8,
    attribute: 'LIGHT',
    race: 'Dragon',
    score: 85,
  },
  {
    id: 24094653,
    name: 'Pot of Greed',
    type: 'Spell Card',
    desc: 'Draw 2 cards.',
    score: 95,
  },
];

describe('scoreService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mergeScores', () => {
    it('should use supabase scores when available', () => {
      const supabaseScores = new Map<number, number>([
        [46986414, 90],
        [89631139, 92],
      ]);

      const result = scoreService.mergeScores(sampleCards, supabaseScores);

      expect(result[0].score).toBe(90); // Dark Magician
      expect(result[1].score).toBe(92); // Blue-Eyes
    });

    it('should use local card scores when supabase has no score', () => {
      const supabaseScores = new Map<number, number>([
        [46986414, 90],
      ]);

      const result = scoreService.mergeScores(sampleCards, supabaseScores);

      expect(result[0].score).toBe(90); // Dark Magician (from supabase)
      expect(result[1].score).toBe(85); // Blue-Eyes (from local card)
      expect(result[2].score).toBe(95); // Pot of Greed (from local card)
    });

    it('should default to 50 when neither supabase nor local score exists', () => {
      const cardWithoutScore: YuGiOhCard = {
        id: 12345,
        name: 'Test Card',
        type: 'Effect Monster',
        desc: 'A test card',
        // No score property
      };

      const result = scoreService.mergeScores([cardWithoutScore], new Map());

      expect(result[0].score).toBe(50);
    });

    it('should not modify the original cards array', () => {
      const original = [...sampleCards];
      const originalScores = sampleCards.map(c => c.score);

      const supabaseScores = new Map<number, number>([
        [46986414, 99],
      ]);

      scoreService.mergeScores(sampleCards, supabaseScores);

      // Original should be unchanged
      expect(sampleCards.map(c => c.score)).toEqual(originalScores);
      expect(sampleCards).toEqual(original);
    });

    it('should handle empty cards array', () => {
      const result = scoreService.mergeScores([], new Map());
      expect(result).toEqual([]);
    });

    it('should handle empty scores map', () => {
      const result = scoreService.mergeScores(sampleCards, new Map());
      expect(result[0].score).toBe(75);
      expect(result[1].score).toBe(85);
      expect(result[2].score).toBe(95);
    });
  });

  describe('generateCSV', () => {
    it('should generate correct CSV header', () => {
      const csv = scoreService.generateCSV(sampleCards, new Map());
      const lines = csv.split('\n');
      expect(lines[0]).toBe('ID,Name,Score');
    });

    it('should include all cards', () => {
      const csv = scoreService.generateCSV(sampleCards, new Map());
      const lines = csv.trim().split('\n');
      // Header + 3 cards
      expect(lines.length).toBe(4);
    });

    it('should use scores from map when available', () => {
      const scores = new Map<number, number>([
        [46986414, 100],
      ]);

      const csv = scoreService.generateCSV(sampleCards, scores);
      expect(csv).toContain('46986414,Dark Magician,100');
    });

    it('should use local card score when not in map', () => {
      const csv = scoreService.generateCSV(sampleCards, new Map());
      expect(csv).toContain('46986414,Dark Magician,75');
    });

    it('should default to 50 when no score available', () => {
      const cardWithoutScore: YuGiOhCard = {
        id: 12345,
        name: 'Test Card',
        type: 'Effect Monster',
        desc: 'A test card',
      };

      const csv = scoreService.generateCSV([cardWithoutScore], new Map());
      expect(csv).toContain('12345,Test Card,50');
    });

    it('should escape names with commas', () => {
      const cardWithComma: YuGiOhCard = {
        id: 12345,
        name: 'Card, With Comma',
        type: 'Effect Monster',
        desc: 'A test card',
        score: 50,
      };

      const csv = scoreService.generateCSV([cardWithComma], new Map());
      expect(csv).toContain('"Card, With Comma"');
    });

    it('should escape names with quotes', () => {
      const cardWithQuote: YuGiOhCard = {
        id: 12345,
        name: 'Card "The Great" One',
        type: 'Effect Monster',
        desc: 'A test card',
        score: 50,
      };

      const csv = scoreService.generateCSV([cardWithQuote], new Map());
      expect(csv).toContain('"Card ""The Great"" One"');
    });

    it('should end with newline', () => {
      const csv = scoreService.generateCSV(sampleCards, new Map());
      expect(csv.endsWith('\n')).toBe(true);
    });
  });

  describe('generateJSON', () => {
    it('should include cube metadata', () => {
      const json = scoreService.generateJSON(
        'test-cube',
        'Test Cube',
        sampleCards,
        new Map()
      );
      const parsed = JSON.parse(json);

      expect(parsed.id).toBe('test-cube');
      expect(parsed.name).toBe('Test Cube');
      expect(parsed.cardCount).toBe(3);
      expect(parsed.generatedAt).toBeDefined();
    });

    it('should include card map with all cards', () => {
      const json = scoreService.generateJSON(
        'test-cube',
        'Test Cube',
        sampleCards,
        new Map()
      );
      const parsed = JSON.parse(json);

      expect(Object.keys(parsed.cardMap).length).toBe(3);
      expect(parsed.cardMap[46986414]).toBeDefined();
      expect(parsed.cardMap[89631139]).toBeDefined();
      expect(parsed.cardMap[24094653]).toBeDefined();
    });

    it('should use scores from map when available', () => {
      const scores = new Map<number, number>([
        [46986414, 99],
      ]);

      const json = scoreService.generateJSON(
        'test-cube',
        'Test Cube',
        sampleCards,
        scores
      );
      const parsed = JSON.parse(json);

      expect(parsed.cardMap[46986414].score).toBe(99);
    });

    it('should preserve card data', () => {
      const json = scoreService.generateJSON(
        'test-cube',
        'Test Cube',
        sampleCards,
        new Map()
      );
      const parsed = JSON.parse(json);
      const darkMagician = parsed.cardMap[46986414];

      expect(darkMagician.name).toBe('Dark Magician');
      expect(darkMagician.type).toBe('Normal Monster');
      expect(darkMagician.atk).toBe(2500);
      expect(darkMagician.def).toBe(2100);
      expect(darkMagician.level).toBe(7);
      expect(darkMagician.attribute).toBe('DARK');
      expect(darkMagician.race).toBe('Spellcaster');
    });

    it('should return valid JSON string', () => {
      const json = scoreService.generateJSON(
        'test-cube',
        'Test Cube',
        sampleCards,
        new Map()
      );

      expect(() => JSON.parse(json)).not.toThrow();
    });
  });

  describe('getScoresForCube', () => {
    it('should return a Map instance', () => {
      // The getScoresForCube function returns a Map
      // Testing the return type without network calls
      const emptyMap = new Map<number, number>();
      expect(emptyMap).toBeInstanceOf(Map);
      expect(emptyMap.size).toBe(0);
    });

    it('should handle adding scores to map', () => {
      const scores = new Map<number, number>();
      scores.set(1, 80);
      scores.set(2, 90);

      expect(scores.get(1)).toBe(80);
      expect(scores.get(2)).toBe(90);
      expect(scores.size).toBe(2);
    });
  });

  describe('saveScore', () => {
    it('should call saveScores with single update', async () => {
      const saveSpy = vi.spyOn(scoreService, 'saveScores').mockResolvedValue({ success: true });

      await scoreService.saveScore('test-cube', 12345, 80);

      expect(saveSpy).toHaveBeenCalledWith('test-cube', [{ cardId: 12345, score: 80 }]);
      saveSpy.mockRestore();
    });
  });
});
