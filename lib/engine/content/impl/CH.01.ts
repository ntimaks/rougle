import type { RelicImpl } from '../types';

/**
 * THE LINGUIST (innate) — "Sees the solution vowel count on every word, before
 * the first guess."
 *
 * Character innates are hidden registry entries: granted at run start, never
 * offered, never occupying a relic slot in the drawer.
 */
export default {
  hooks: {
    onWordStart: () => [{ kind: 'REVEAL_META', field: 'vowelCount' }],
  },
} satisfies RelicImpl;
