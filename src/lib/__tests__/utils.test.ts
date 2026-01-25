/**
 * Tests for utility functions in src/lib/utils.ts
 */

import { describe, it, expect } from 'vitest';
import {
  formatStat,
  isExtraDeckCard,
  isMonsterCard,
  isSpellCard,
  isTrapCard,
  shuffleArray,
  createPacks,
  formatTime,
  getTierFromScore,
  getTierInfo,
} from '../utils';

describe('formatStat', () => {
  it('should return "-" for undefined value', () => {
    expect(formatStat(undefined)).toBe('-');
  });

  it('should return "-" for null value', () => {
    expect(formatStat(null)).toBe('-');
  });

  it('should return "?" for -1 value (cards with ? ATK/DEF)', () => {
    expect(formatStat(-1)).toBe('?');
  });

  it('should return the number as string for normal values', () => {
    expect(formatStat(0)).toBe('0');
    expect(formatStat(1500)).toBe('1500');
    expect(formatStat(3000)).toBe('3000');
  });
});

describe('isExtraDeckCard', () => {
  it('should return true for Fusion Monster', () => {
    expect(isExtraDeckCard('Fusion Monster')).toBe(true);
  });

  it('should return true for Synchro Monster', () => {
    expect(isExtraDeckCard('Synchro Monster')).toBe(true);
  });

  it('should return true for XYZ Monster', () => {
    expect(isExtraDeckCard('XYZ Monster')).toBe(true);
  });

  it('should return true for Link Monster', () => {
    expect(isExtraDeckCard('Link Monster')).toBe(true);
  });

  it('should return true for Pendulum Effect Fusion Monster', () => {
    expect(isExtraDeckCard('Pendulum Effect Fusion Monster')).toBe(true);
  });

  it('should return true for Synchro Pendulum Effect Monster', () => {
    expect(isExtraDeckCard('Synchro Pendulum Effect Monster')).toBe(true);
  });

  it('should return true for XYZ Pendulum Effect Monster', () => {
    expect(isExtraDeckCard('XYZ Pendulum Effect Monster')).toBe(true);
  });

  it('should return false for Effect Monster', () => {
    expect(isExtraDeckCard('Effect Monster')).toBe(false);
  });

  it('should return false for Normal Monster', () => {
    expect(isExtraDeckCard('Normal Monster')).toBe(false);
  });

  it('should return false for Spell Card', () => {
    expect(isExtraDeckCard('Spell Card')).toBe(false);
  });

  it('should return false for Trap Card', () => {
    expect(isExtraDeckCard('Trap Card')).toBe(false);
  });

  it('should return false for Ritual Monster', () => {
    expect(isExtraDeckCard('Ritual Monster')).toBe(false);
  });
});

describe('isMonsterCard', () => {
  it('should return true for Effect Monster', () => {
    expect(isMonsterCard('Effect Monster')).toBe(true);
  });

  it('should return true for Normal Monster', () => {
    expect(isMonsterCard('Normal Monster')).toBe(true);
  });

  it('should return true for Fusion Monster', () => {
    expect(isMonsterCard('Fusion Monster')).toBe(true);
  });

  it('should return true for mixed case', () => {
    expect(isMonsterCard('EFFECT MONSTER')).toBe(true);
    expect(isMonsterCard('effect monster')).toBe(true);
  });

  it('should return false for Spell Card', () => {
    expect(isMonsterCard('Spell Card')).toBe(false);
  });

  it('should return false for Trap Card', () => {
    expect(isMonsterCard('Trap Card')).toBe(false);
  });
});

describe('isSpellCard', () => {
  it('should return true for Spell Card', () => {
    expect(isSpellCard('Spell Card')).toBe(true);
  });

  it('should return true for Quick-Play Spell', () => {
    expect(isSpellCard('Quick-Play Spell')).toBe(true);
  });

  it('should return true for mixed case', () => {
    expect(isSpellCard('SPELL CARD')).toBe(true);
    expect(isSpellCard('spell card')).toBe(true);
  });

  it('should return false for Monster', () => {
    expect(isSpellCard('Effect Monster')).toBe(false);
  });

  it('should return false for Trap Card', () => {
    expect(isSpellCard('Trap Card')).toBe(false);
  });
});

describe('isTrapCard', () => {
  it('should return true for Trap Card', () => {
    expect(isTrapCard('Trap Card')).toBe(true);
  });

  it('should return true for Counter Trap', () => {
    expect(isTrapCard('Counter Trap')).toBe(true);
  });

  it('should return true for mixed case', () => {
    expect(isTrapCard('TRAP CARD')).toBe(true);
    expect(isTrapCard('trap card')).toBe(true);
  });

  it('should return false for Monster', () => {
    expect(isTrapCard('Effect Monster')).toBe(false);
  });

  it('should return false for Spell Card', () => {
    expect(isTrapCard('Spell Card')).toBe(false);
  });
});

describe('shuffleArray', () => {
  it('should return an array with the same length', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffleArray(input);
    expect(result.length).toBe(input.length);
  });

  it('should contain all the same elements', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffleArray(input);
    expect(result.sort()).toEqual(input.sort());
  });

  it('should not modify the original array', () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    shuffleArray(input);
    expect(input).toEqual(copy);
  });

  it('should handle empty array', () => {
    const result = shuffleArray([]);
    expect(result).toEqual([]);
  });

  it('should handle single element array', () => {
    const result = shuffleArray([1]);
    expect(result).toEqual([1]);
  });

  it('should work with different types', () => {
    const strings = ['a', 'b', 'c'];
    const result = shuffleArray(strings);
    expect(result.length).toBe(3);
    expect(result.sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('createPacks', () => {
  it('should create correct number of packs', () => {
    const cards = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const packs = createPacks(cards, 5);
    expect(packs.length).toBe(2);
  });

  it('should have correct pack size', () => {
    const cards = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const packs = createPacks(cards, 5);
    expect(packs[0].length).toBe(5);
    expect(packs[1].length).toBe(5);
  });

  it('should handle partial last pack', () => {
    const cards = [1, 2, 3, 4, 5, 6, 7];
    const packs = createPacks(cards, 5);
    expect(packs.length).toBe(2);
    expect(packs[0].length).toBe(5);
    expect(packs[1].length).toBe(2);
  });

  it('should preserve card order within packs', () => {
    const cards = [1, 2, 3, 4, 5, 6];
    const packs = createPacks(cards, 3);
    expect(packs[0]).toEqual([1, 2, 3]);
    expect(packs[1]).toEqual([4, 5, 6]);
  });

  it('should handle empty array', () => {
    const packs = createPacks([], 5);
    expect(packs).toEqual([]);
  });

  it('should handle pack size larger than cards', () => {
    const cards = [1, 2, 3];
    const packs = createPacks(cards, 10);
    expect(packs.length).toBe(1);
    expect(packs[0]).toEqual([1, 2, 3]);
  });
});

describe('formatTime', () => {
  it('should format 0 seconds correctly', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('should format seconds less than 60 with leading zero', () => {
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(9)).toBe('0:09');
    expect(formatTime(30)).toBe('0:30');
    expect(formatTime(59)).toBe('0:59');
  });

  it('should format exactly 60 seconds', () => {
    expect(formatTime(60)).toBe('1:00');
  });

  it('should format minutes and seconds correctly', () => {
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(90)).toBe('1:30');
    expect(formatTime(125)).toBe('2:05');
  });

  it('should handle large values', () => {
    expect(formatTime(600)).toBe('10:00');
    expect(formatTime(3661)).toBe('61:01');
  });
});

describe('getTierFromScore', () => {
  it('should return S for scores >= 95', () => {
    expect(getTierFromScore(95)).toBe('S');
    expect(getTierFromScore(100)).toBe('S');
    expect(getTierFromScore(99)).toBe('S');
  });

  it('should return A for scores >= 90 and < 95', () => {
    expect(getTierFromScore(90)).toBe('A');
    expect(getTierFromScore(94)).toBe('A');
  });

  it('should return B for scores >= 75 and < 90', () => {
    expect(getTierFromScore(75)).toBe('B');
    expect(getTierFromScore(89)).toBe('B');
  });

  it('should return C for scores >= 60 and < 75', () => {
    expect(getTierFromScore(60)).toBe('C');
    expect(getTierFromScore(74)).toBe('C');
  });

  it('should return E for scores >= 50 and < 60', () => {
    expect(getTierFromScore(50)).toBe('E');
    expect(getTierFromScore(59)).toBe('E');
  });

  it('should return F for scores < 50', () => {
    expect(getTierFromScore(49)).toBe('F');
    expect(getTierFromScore(0)).toBe('F');
    expect(getTierFromScore(30)).toBe('F');
  });

  it('should return F for undefined', () => {
    expect(getTierFromScore(undefined)).toBe('F');
  });
});

describe('getTierInfo', () => {
  it('should return null for undefined score', () => {
    expect(getTierInfo(undefined)).toBeNull();
  });

  it('should return tier and color for valid scores', () => {
    const result = getTierInfo(95);
    expect(result).not.toBeNull();
    expect(result?.tier).toBe('S');
    expect(result?.color).toContain('amber');
  });

  it('should return correct color for each tier', () => {
    expect(getTierInfo(95)?.color).toContain('amber'); // S
    expect(getTierInfo(90)?.color).toContain('red');   // A
    expect(getTierInfo(75)?.color).toContain('orange'); // B
    expect(getTierInfo(60)?.color).toContain('yellow'); // C
    expect(getTierInfo(50)?.color).toContain('green'); // E
    expect(getTierInfo(30)?.color).toContain('gray');  // F
  });
});
