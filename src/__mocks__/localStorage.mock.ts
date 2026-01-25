/**
 * Mock localStorage implementation for testing
 * Uses an in-memory Map for storage
 */

const store = new Map<string, string>();

export const mockLocalStorage = {
  getItem: (key: string): string | null => {
    return store.get(key) ?? null;
  },
  setItem: (key: string, value: string): void => {
    store.set(key, value);
  },
  removeItem: (key: string): void => {
    store.delete(key);
  },
  clear: (): void => {
    store.clear();
  },
  get length(): number {
    return store.size;
  },
  key: (index: number): string | null => {
    const keys = Array.from(store.keys());
    return keys[index] ?? null;
  },
};

/**
 * Clear the mock localStorage store
 * Call this in beforeEach to reset state between tests
 */
export function clearMockLocalStorage(): void {
  store.clear();
}

/**
 * Get all items in the mock localStorage (for debugging)
 */
export function getMockLocalStorageItems(): Record<string, string> {
  return Object.fromEntries(store);
}
