import { recordUse } from '../../core/activation';
import type { RelicImpl } from '../types';

/**
 * ALL IN — "Before a word, wager any number of guesses. Solve within that count
 * and gain the same number back. Fail and lose all of them."
 *
 * The wager is only meaningful up to the pool you actually hold, and a wager of
 * zero is a no-op, so it is clamped rather than refused — refusing a legal-
 * looking input mid-word is worse than honouring the part of it that means
 * something.
 *
 * The win pays a REFUND (it is guesses coming back and belongs under the §2.4
 * floor); the loss is a POOL debit (it is a penalty, not a refund).
 *
 * relics.json flags this as degenerate with anything that removes uncertainty
 * about your own solve count — RL.04 and RL.07. The harness tracks that pair.
 */
export default {
  hooks: {
    onUse: (ctx, p) => {
      const word = ctx.state.word;
      if (!word) return [];
      const asked = Math.floor(Number(p.payload['wager'] ?? 0));
      const wager = Math.max(0, Math.min(asked, ctx.state.pool));
      if (wager === 0) return [];
      return [
        {
          kind: 'SET_RELIC_STATE',
          instanceId: ctx.self.instanceId,
          patch: { ...recordUse(ctx.self, word.nodeId), wagerNodeId: word.nodeId, wager },
        },
      ];
    },

    onWordSolved: (ctx, p) => {
      const wager = Number(ctx.self.state['wager'] ?? 0);
      if (wager <= 0 || ctx.self.state['wagerNodeId'] !== p.nodeId) return [];
      const clear = { kind: 'SET_RELIC_STATE' as const, instanceId: ctx.self.instanceId, patch: { wager: 0, wagerNodeId: null } };
      return p.guessesUsed <= wager
        ? [{ kind: 'REFUND', amount: wager, source: 'RL.21' }, clear]
        : [{ kind: 'POOL', delta: -wager, reason: 'RL.21' }, clear];
    },

    onWordFailed: (ctx, p) => {
      const wager = Number(ctx.self.state['wager'] ?? 0);
      if (wager <= 0 || ctx.self.state['wagerNodeId'] !== p.nodeId) return [];
      return [
        { kind: 'POOL', delta: -wager, reason: 'RL.21' },
        { kind: 'SET_RELIC_STATE', instanceId: ctx.self.instanceId, patch: { wager: 0, wagerNodeId: null } },
      ];
    },
  },
} satisfies RelicImpl;
