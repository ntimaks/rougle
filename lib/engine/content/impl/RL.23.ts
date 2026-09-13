import type { RelicImpl } from '../types';

/**
 * THE TIN CUP — "Every guess you spend rattles loose 2g. Each time you fail to
 * solve in three, the rate rises by 1g. It never falls." 2g a step at MK.II.
 *
 * §6.5 scaling relic, counter RATE, and one of the two FAILURE-scaling relics —
 * a comeback engine, and part of the structural defence against §11.2's death
 * spiral. It pays most exactly when the run is going worst.
 *
 * The gold and the bankroll decrement are emitted in the same event batch,
 * which the UI drains atomically, so the two counters move on one frame rather
 * than competing for attention (relics.json engine_note).
 */
const START = 2;

export default {
  initialState: { rate: START },
  hooks: {
    onGuessSubmit: (ctx) => [
      { kind: 'GOLD', delta: Number(ctx.self.state.rate ?? START), reason: 'RL.23' },
    ],
    onWordSolved: (ctx, p) => {
      if (p.guessesUsed < 4) return [];
      const rate = Number(ctx.self.state.rate ?? START) + (ctx.self.upgraded ? 2 : 1);
      return [{ kind: 'SET_RELIC_STATE', instanceId: ctx.self.instanceId, patch: { rate } }];
    },
  },
} satisfies RelicImpl;
