import { hammingDistance } from '../../core/letters';
import { recordUse } from '../../core/activation';
import type { RelicImpl } from '../types';

/**
 * BLINDFOLD — "Choose to take no feedback on a guess. If that guess was within
 * one letter of the solution, gain 4 bankroll. Otherwise nothing." Within two
 * at MK.II.
 *
 * Two halves. The activation ARMS the next guess: the chain's suppression step
 * reads `blindNodeId`/`blindTurn` and withholds that row. The payoff resolves
 * on `onGuessSubmit`, where the armed turn is the one being submitted.
 *
 * "Within one letter" is Hamming distance <= 1 (R-016). The relic reads the
 * solution through the shared helper rather than inlining the comparison, so
 * the ruling has one home.
 *
 * A `BANKROLL` grant rather than a `PAYOUT_BONUS`: it pays on a guess, not on a
 * solve, and it pays whether or not the word is ever solved. Clamp A still
 * catches it, because Clamp A is stated on the word's net.
 */
export default {
  hooks: {
    onUse: (ctx) => {
      const word = ctx.state.word;
      if (!word) return [];
      return [
        {
          kind: 'SET_RELIC_STATE',
          instanceId: ctx.self.instanceId,
          patch: {
            ...recordUse(ctx.self, word.nodeId),
            blindNodeId: word.nodeId,
            blindTurn: word.history.length,
          },
        },
      ];
    },

    onGuessSubmit: (ctx, p) => {
      const word = ctx.state.word;
      if (!word) return [];
      const armed =
        ctx.self.state['blindNodeId'] === word.nodeId && ctx.self.state['blindTurn'] === p.turn;
      if (!armed) return [];
      const near = hammingDistance(p.guess, word.solutions) <= (ctx.self.upgraded ? 2 : 1);
      return near ? [{ kind: 'BANKROLL', delta: 4, reason: 'RL.20' }] : [];
    },
  },
} satisfies RelicImpl;
