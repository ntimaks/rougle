import type { RelicImpl } from '../types';

/** THE WISHBONE — "Each guess has a 50% chance of being refunded." */
export default {
  hooks: {
    onGuessSubmit: (ctx, p) =>
      ctx.rng(p.turn) < 0.5 ? [{ kind: 'REFUND', amount: 1, source: 'RL.18' }] : [],
  },
} satisfies RelicImpl;
