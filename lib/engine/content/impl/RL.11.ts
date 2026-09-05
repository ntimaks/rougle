import type { RelicImpl } from '../types';

/** FLYWHEEL — "Solve in three or fewer and one guess spins straight back into the pool." */
export default {
  hooks: {
    onWordSolved: (_ctx, p) =>
      p.guessesUsed <= 3 ? [{ kind: 'REFUND', amount: 1, source: 'RL.11' }] : [],
  },
} satisfies RelicImpl;
