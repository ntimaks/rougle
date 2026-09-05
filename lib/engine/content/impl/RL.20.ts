import { hammingDistance } from '../../core/letters';
import { recordUse } from '../../core/activation';
import type { RelicImpl } from '../types';

/**
 * BLINDFOLD — "Choose to take no feedback on a guess. If that guess was within
 * one letter of the solution, gain 3 guesses. Otherwise nothing."
 *
 * Two halves. The activation ARMS the next guess: the chain's suppression step
 * reads `blindNodeId`/`blindTurn` and withholds that row. The payoff resolves
 * on `onGuessSubmit`, where the armed turn is the one being submitted.
 *
 * "Within one letter" is Hamming distance <= 1 (R-016). The relic reads the
 * solution through the shared helper rather than inlining the comparison, so
 * the ruling has one home.
 *
 * The reward is a POOL gain, not a REFUND: it is a prize for a risk taken, not
 * compensation for a guess, so the §2.4 floor does not apply to it.
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
      const near = hammingDistance(p.guess, word.solutions) <= 1;
      return near ? [{ kind: 'POOL', delta: 3, reason: 'RL.20' }] : [];
    },
  },
} satisfies RelicImpl;
