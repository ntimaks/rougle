import type { RelicImpl } from '../types';

/**
 * FLYWHEEL — "Solve in two or fewer and the payout rises by 2." Three at MK.II.
 *
 * The trigger is `<= 2`, not the `<= 3` a common payout relic wants, and that
 * is R-048 rather than a design preference: a `<= 3` trigger fires on 43.3% of
 * words, so the SMALLEST integer bonus on it is worth 0.43 a word — the boss
 * allowance — however small the bonus. The next tighter trigger fires on 7.7%.
 * There is nothing in between, so a COMMON payout relic gates on two.
 *
 * A `PAYOUT_BONUS`, never a `BANKROLL` grant: Clamp B (§2.5) says the largest
 * bonus applies and they do not sum, and a grant would bypass it.
 */
export default {
  hooks: {
    onPayout: (ctx, p) =>
      p.guessesUsed <= 2
        ? [{ kind: 'PAYOUT_BONUS', amount: ctx.self.upgraded ? 3 : 2, source: 'RL.11' }]
        : [],
  },
} satisfies RelicImpl;
