import { recordUse } from '../../core/activation';
import type { RelicImpl } from '../types';

/**
 * ALL IN — "Before a word, wager any number of guesses. Solve within that count
 * and gain the same number back. Fail and lose all of them." A lost wager costs
 * half, rounded down, at MK.II.
 *
 * The wager is only meaningful up to the bankroll you actually hold, and a
 * wager of zero is a no-op, so it is clamped rather than refused — refusing a
 * legal-looking input mid-word is worse than honouring the part of it that
 * means something.
 *
 * Both sides are `BANKROLL` deltas. The win is not a `PAYOUT_BONUS`: Clamp B
 * would make it compete with Flywheel for the largest-bonus slot, and a wager
 * you won is not a payout bonus, it is your own stake coming back. Clamp A
 * still binds the word's net gain to +5, which is what the registry's engine
 * note says and is the whole risk of a large wager.
 *
 * The word's `wagered` field is the state, not the relic's — the reducer has to
 * know a word is staked in order to resolve the loss when the word FAILS, and
 * §2.3 makes a failed word end the run, so there is no `onWordFailed` to hang
 * it on any more.
 */
export default {
  hooks: {
    onUse: (ctx, p) => {
      const word = ctx.state.word;
      if (!word) return [];
      const asked = Math.floor(Number(p.payload['wager'] ?? 0));
      const wager = Math.max(0, Math.min(asked, ctx.state.bankroll));
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
      const clear = {
        kind: 'SET_RELIC_STATE' as const,
        instanceId: ctx.self.instanceId,
        patch: { wager: 0, wagerNodeId: null },
      };
      const lost = ctx.self.upgraded ? Math.floor(wager / 2) : wager;
      return p.guessesUsed <= wager
        ? [{ kind: 'BANKROLL', delta: wager, reason: 'RL.21' }, clear]
        : [{ kind: 'BANKROLL', delta: -lost, reason: 'RL.21' }, clear];
    },
  },
} satisfies RelicImpl;
