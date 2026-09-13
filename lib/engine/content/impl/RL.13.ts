import type { RelicImpl } from '../types';

/**
 * OPENING GAMBIT — "If your first guess of a word held four or more unique
 * letters AND you solve in two or fewer, the payout is calculated as though you
 * used one fewer guess." Three letters and three guesses at MK.II.
 *
 * A `PAYOUT_DISCOUNT`, not a refund and not a grant: the guesses were spent and
 * the bankroll already ticked down for them. Only the formula's `guesses_used`
 * moves, so the relic is worth exactly one payout point and cannot interact
 * with Clamp B.
 *
 * The solve gate is load-bearing. A strong opener has four unique letters
 * essentially always, so without it this is an unconditional +1 — measured at
 * 0.98 bankroll a word against an UNCOMMON allowance of 0.30 (R-048).
 */
export default {
  hooks: {
    onPayout: (ctx, p) => {
      const letters = ctx.self.upgraded ? 3 : 4;
      const guesses = ctx.self.upgraded ? 3 : 2;
      if (p.openerUniqueLetters < letters || p.guessesUsed > guesses) return [];
      return [{ kind: 'PAYOUT_DISCOUNT', guesses: 1, source: 'RL.13' }];
    },
  },
} satisfies RelicImpl;
