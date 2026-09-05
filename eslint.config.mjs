import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

/**
 * The engine boundary (technical brief §1.3, AGENTS.md non-negotiable 1).
 *
 * `lib/engine/` must run under `npx tsx` with Next stopped. These rules make a
 * violation a lint error rather than a balance bug discovered three weeks later.
 * The CI harness job is the check that actually matters; this is the fast one.
 */
const ENGINE_BANNED_PATHS = ['react', 'react-dom', 'zustand', 'framer-motion'];
const ENGINE_BANNED_PATTERNS = ['next/*', '@/app/*', '@/components/*', '@/lib/store/*', '@/lib/persistence/*'];
const ENGINE_BANNED_GLOBALS = [
  { name: 'window', message: 'lib/engine is pure. No DOM.' },
  { name: 'document', message: 'lib/engine is pure. No DOM.' },
  { name: 'localStorage', message: 'Only lib/persistence/local.ts may name localStorage.' },
  { name: 'sessionStorage', message: 'lib/engine is pure. No browser storage.' },
  { name: 'crypto', message: 'All randomness is address-based: draw(seed, domain, index).' },
  { name: 'navigator', message: 'lib/engine is pure. No DOM.' },
];

const config = [
  { ignores: ['node_modules/**', '.next/**', 'out/**', 'design/**', 'data/**', 'next-env.d.ts'] },

  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },

  {
    // lib/engine and sim are framework-agnostic by contract, so React's rules do
    // not apply — and its naming heuristics actively misfire there (a function
    // called `useItem` is not a hook).
    files: ['lib/engine/**/*.ts', 'sim/**/*.ts', 'scripts/**/*.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      '@next/next/no-assign-module-variable': 'off',
    },
  },

  {
    files: ['lib/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: ENGINE_BANNED_PATHS, patterns: ENGINE_BANNED_PATTERNS }],
      'no-restricted-globals': ['error', ...ENGINE_BANNED_GLOBALS],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use draw(seed, domain, index) — technical brief §2.5.' },
        { object: 'Date', property: 'now', message: 'lib/engine is pure. Time comes in as an action payload.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'lib/engine is pure. Time comes in as an action payload.',
        },
      ],
    },
  },

  {
    // The design bundle is imported verbatim and is not ours to lint.
    files: ['sim/**/*.ts', 'scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
];

export default config;
