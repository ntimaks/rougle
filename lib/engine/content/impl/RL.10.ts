import type { RelicImpl } from '../types';

/** THE METRONOME — "Solve in exactly three and gain 10g." */
export default {
  hooks: {
    onWordSolved: (_ctx, p) =>
      p.guessesUsed === 3 ? [{ kind: 'GOLD', delta: 10, reason: 'RL.10' }] : [],
  },
} satisfies RelicImpl;
