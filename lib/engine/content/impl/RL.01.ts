import type { RelicImpl } from '../types';

/** LEXICON — "Your first guess of each word also reports how many vowels the answer holds." */
export default {
  hooks: {
    onWordStart: () => [{ kind: 'REVEAL_META', field: 'vowelCount' }],
  },
} satisfies RelicImpl;
