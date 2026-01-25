import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__mocks__/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**/*.ts', 'src/services/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/__mocks__/**',
      ],
    },
  },
});
