import type { RelicImpl } from '../types';

/**
 * BLOODHOUND — "Elite nodes refund 2 guesses on clear, and award no gold."
 * Three at MK.II; they still pay nothing.
 *
 * The gold suppression is a cancelling delta rather than a branch in the reward
 * path. Same shape as RL.24 The Ledger's top-up, and for the same reason: the
 * reward stays in one place and the relic stays a pure hook, instead of the
 * reducer growing an `if (hasRelic(...))` per relic that touches payouts.
 */
export default {
  hooks: {
    onWordSolved: (ctx, p) => {
      const node = ctx.state.map.nodes[p.nodeId];
      if (node?.kind !== 'ELITE') return [];
      return [
        { kind: 'REFUND', amount: ctx.self.upgraded ? 3 : 2, source: 'RL.15' },
        { kind: 'GOLD', delta: -ctx.cfg.rewards.elite, reason: 'RL.15' },
      ];
    },
  },
} satisfies RelicImpl;
