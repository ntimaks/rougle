import type { RelicImpl } from '../types';

/**
 * OPENING GAMBIT — "Your first guess of a word is refunded if it contains four
 * or more unique letters not yet used this word."
 *
 * On the first guess nothing has been used, so the condition reduces to four
 * or more distinct letters. A refund, never a skipped decrement (Rule C).
 */
export default {
  hooks: {
    onGuessSubmit: (_ctx, p) =>
      p.turn === 0 && p.newUniqueLetters >= 4
        ? [{ kind: 'REFUND', amount: 1, source: 'RL.13' }]
        : [],
  },
} satisfies RelicImpl;
