import type { RelicImpl } from '../types';

/**
 * THE GUILLOTINE — "Solve in two or fewer and it pays 40g, plus 20g for every
 * time it has already paid. Solve in five or more and it takes 30g." 30g a head
 * at MK.II; the penalty is unchanged.
 *
 * §6.5 scaling relic, counter HEADS TAKEN, success-scaling. The counter ticks
 * only on a paying solve, so it is a record of what the relic has done rather
 * than of how long it has been held.
 */
export default {
  initialState: { heads: 0 },
  hooks: {
    onWordSolved: (ctx, p) => {
      if (p.guessesUsed >= 5) return [{ kind: 'GOLD', delta: -30, reason: 'RL.14' }];
      if (p.guessesUsed > 2) return [];
      const heads = Number(ctx.self.state.heads ?? 0);
      const perHead = ctx.self.upgraded ? 30 : 20;
      return [
        { kind: 'GOLD', delta: 40 + perHead * heads, reason: 'RL.14' },
        { kind: 'SET_RELIC_STATE', instanceId: ctx.self.instanceId, patch: { heads: heads + 1 } },
      ];
    },
  },
} satisfies RelicImpl;
