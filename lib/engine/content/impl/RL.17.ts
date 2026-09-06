import type { RelicImpl } from '../types';

/**
 * THE HOLDOUT — "Solve a word without buying a reveal and gain 25g."
 *
 * The counterweight to the §2.5 ladder, and the reason the ladder is a decision
 * rather than a tax: with the Holdout held, declining to buy is itself worth
 * something, so both sides of the choice pay. R-020.
 *
 * `revealsPurchased` is still on the word when onWordSolved fires, which is why
 * this needs no state of its own — the word already knows whether it was bought
 * through.
 */
const BONUS = 25;

export default {
  hooks: {
    onWordSolved: (ctx) =>
      ctx.state.word && ctx.state.word.revealsPurchased === 0
        ? [{ kind: 'GOLD', delta: BONUS, reason: 'RL.17' }]
        : [],
  },
} satisfies RelicImpl;
