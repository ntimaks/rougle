import type { RelicImpl } from '../types';

/**
 * THE GUILLOTINE — "Solve in two or fewer: gain 40g. Solve in five or more:
 * lose 20g." The keyboard clause is dropped per R-004.
 */
export default {
  hooks: {
    onWordSolved: (_ctx, p) => {
      if (p.guessesUsed <= 2) return [{ kind: 'GOLD', delta: 40, reason: 'RL.14' }];
      if (p.guessesUsed >= 5) return [{ kind: 'GOLD', delta: -20, reason: 'RL.14' }];
      return [];
    },
  },
} satisfies RelicImpl;
