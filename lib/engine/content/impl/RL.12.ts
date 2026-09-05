import type { RelicImpl } from '../types';

/**
 * HOT STREAK — "Three consecutive solves in three or fewer, and the next word
 * opens with one green revealed. The counter resets on any solve of four or
 * more."
 *
 * The counter is NOT consumed by the reveal. A solve of four or more is the
 * only reset the rule names, so a player who keeps solving in three keeps the
 * green. Reading it the other way would add a second reset the rule does not
 * state.
 */
export default {
  initialState: { streak: 0 },
  hooks: {
    onWordStart: (ctx) =>
      Number(ctx.self.state.streak ?? 0) >= 3 ? [{ kind: 'PRESET_TILE' }] : [],
    onWordSolved: (ctx, p) => [
      {
        kind: 'SET_RELIC_STATE',
        instanceId: ctx.self.instanceId,
        patch: { streak: p.guessesUsed <= 3 ? Number(ctx.self.state.streak ?? 0) + 1 : 0 },
      },
    ],
  },
} satisfies RelicImpl;
