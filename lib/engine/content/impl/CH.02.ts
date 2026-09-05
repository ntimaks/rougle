import type { RelicImpl } from '../types';

/**
 * THE GAMBLER (innate) — "Solving in three or fewer refunds two guesses."
 *
 * Under Rule B this does not stack with RL.11 Flywheel: a Gambler holding
 * Flywheel who solves in three gets 2, not 3.
 */
export default {
  hooks: {
    onWordSolved: (_ctx, p) =>
      p.guessesUsed <= 3 ? [{ kind: 'REFUND', amount: 2, source: 'CH.02' }] : [],
  },
} satisfies RelicImpl;
