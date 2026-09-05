import type { RelicImpl } from '../types';

/**
 * PALIMPSEST — "At word start, learn one letter this solution shares with the
 * previous solution. If they share none, learn that instead."
 *
 * Both branches are information, so both are a reveal; `sharedLetter` carries
 * null for the no-overlap case and the UI renders the "shares none" copy.
 */
export default {
  hooks: {
    onWordStart: () => [{ kind: 'REVEAL_META', field: 'sharedLetter' }],
  },
} satisfies RelicImpl;
