import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Vitest runs the engine and the sim in Node with Next stopped (S-03).
 * No Next transform, no JSX, no jsdom: if a test here needs a browser, the rule
 * it is testing is in the wrong place (AGENTS.md §3).
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'sim/**/*.test.ts', 'scripts/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', 'out/**'],
    testTimeout: 120_000,
  },
});
