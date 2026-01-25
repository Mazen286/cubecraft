import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format card stats for display
export function formatStat(value: number | undefined | null): string {
  if (value === undefined || value === null) return '-';
  if (value === -1) return '?'; // For cards with ? ATK/DEF
  return value.toString();
}

// Check if card is an Extra Deck card
export function isExtraDeckCard(type: string): boolean {
  const extraDeckTypes = [
    'Fusion Monster',
    'Synchro Monster',
    'XYZ Monster',
    'Link Monster',
    'Pendulum Effect Fusion Monster',
    'Synchro Pendulum Effect Monster',
    'XYZ Pendulum Effect Monster',
  ];
  return extraDeckTypes.some((t) => type.includes(t));
}

// Check if card is a Monster card
export function isMonsterCard(type: string): boolean {
  return type.toLowerCase().includes('monster');
}

// Check if card is a Spell card
export function isSpellCard(type: string): boolean {
  return type.toLowerCase().includes('spell');
}

// Check if card is a Trap card
export function isTrapCard(type: string): boolean {
  return type.toLowerCase().includes('trap');
}

// Shuffle array (Fisher-Yates)
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Split cards into packs
export function createPacks<T>(cards: T[], packSize: number): T[][] {
  const packs: T[][] = [];
  for (let i = 0; i < cards.length; i += packSize) {
    packs.push(cards.slice(i, i + packSize));
  }
  return packs;
}

// Debounce function
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Format time for display (mm:ss)
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Tier colors for badges
const TIER_COLORS: Record<string, string> = {
  S: 'bg-amber-500 text-black',
  A: 'bg-red-500 text-white',
  B: 'bg-orange-500 text-white',
  C: 'bg-yellow-500 text-black',
  E: 'bg-green-500 text-white',
  F: 'bg-gray-500 text-white',
};

// Get tier letter from score (0-100)
export function getTierFromScore(score: number | undefined): string {
  if (score === undefined) return 'F';
  if (score >= 95) return 'S';
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'E';
  return 'F';
}

// Get tier info (letter + color) from score - single source of truth
export function getTierInfo(score: number | undefined): { tier: string; color: string } | null {
  if (score === undefined) return null;
  const tier = getTierFromScore(score);
  return { tier, color: TIER_COLORS[tier] || TIER_COLORS.F };
}
