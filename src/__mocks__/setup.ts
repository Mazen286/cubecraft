/**
 * Vitest setup file
 * Configures global test utilities and mocks
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { mockLocalStorage, clearMockLocalStorage } from './localStorage.mock';

// Mock localStorage globally
Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Mock crypto.randomUUID
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2, 9),
  },
  writable: true,
});

// Mock import.meta.env
vi.stubGlobal('import', {
  meta: {
    env: {
      DEV: false,
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
});

// Clear localStorage between tests
beforeEach(() => {
  clearMockLocalStorage();
});
