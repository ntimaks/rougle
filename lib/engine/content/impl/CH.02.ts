import type { RelicImpl } from '../types';

/**
 * THE GAMBLER (innate) — "Solve in three or fewer and the payout rises by 1."
 *
 * The one thing in the game allowed a `<= 3` payout trigger. R-048 makes that
 * trigger worth 0.43 a word whatever the bonus, which is the BOSS allowance —
 * and a character innate is held for the entire run and costs a slot in nothing
 * but starting bankroll (9 against the Linguist's 14), so it is judged there.
 *
 * Under Clamp B (§2.5) it does not stack with `RL.11` Flywheel: a Gambler
 * holding Flywheel who solves in two gets +2, not +3.
 */
export default {
  hooks: {
    onPayout: (_ctx, p) =>
      p.guessesUsed <= 3 ? [{ kind: 'PAYOUT_BONUS', amount: 1, source: 'CH.02' }] : [],
  },
} satisfies RelicImpl;
