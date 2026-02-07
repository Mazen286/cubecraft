/**
 * Collection Service - tracks which packs the user owns
 * Stores data in localStorage (works for anonymous users)
 */

const STORAGE_KEY = 'arkham_collection_owned_packs';

function loadFromStorage(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set(arr);
    return new Set();
  } catch {
    return new Set();
  }
}

function saveToStorage(codes: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...codes]));
  } catch {
    // Silently fail if storage is full
  }
}

export const collectionService = {
  getOwnedPacks(): Set<string> {
    return loadFromStorage();
  },

  setOwnedPacks(codes: string[]): void {
    saveToStorage(new Set(codes));
  },

  togglePack(code: string): void {
    const owned = loadFromStorage();
    if (owned.has(code)) {
      owned.delete(code);
    } else {
      owned.add(code);
    }
    saveToStorage(owned);
  },

  ownAll(allPackCodes: string[]): void {
    saveToStorage(new Set(allPackCodes));
  },

  ownNone(): void {
    saveToStorage(new Set());
  },
};
