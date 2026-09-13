import type { RelicImpl } from '../types';

/**
 * ROSETTA SLAB (boss) — "Every word opens with one green already carved. In
 * exchange every payout is 1 lower." The penalty is lifted at MK.II.
 *
 * v1.3's Rosetta cut the act pool by 3, which is why it sat in
 * `PENDING_IMPLEMENTATION` behind §13 I-07 (a mid-act cap cut can kill you at
 * low pool, and the debt has nowhere to go). §2.1 has no cap to cut, so the
 * cost is a payout penalty and the open item is moot.
 *
 * The penalty is a NEGATIVE `PAYOUT_BONUS`. Clamp B takes the largest bonus and
 * ignores the rest, so a negative can never win the clamp and can never cancel
 * a relic's bonus — `bank.payoutFor` subtracts it from the gross separately.
 * Emitting it as a `BANKROLL` charge instead would take a point even from a
 * word that paid nothing, which the rule does not say.
 *
 * Measured at -1.00 bankroll a word from the penalty alone. The free green is
 * an INFO effect that lowers guesses per word and is not yet valued, so the
 * true figure is higher and unknown (§6.5).
 */
export default {
  /**
   * §5.4 step 4 — injection. The green is written as a `PRESET_TILE` by the
   * hook below and RENDERED by the chain's injection step, which is what the
   * registry's `transform_order: 4` is a statement about. Declared here so the
   * two cannot drift: the validator compares them.
   */
  chainStep: 4,
  hooks: {
    onWordStart: () => [{ kind: 'PRESET_TILE' }],
    onPayout: (ctx) =>
      ctx.self.upgraded ? [] : [{ kind: 'PAYOUT_BONUS', amount: -1, source: 'RL.31' }],
  },
} satisfies RelicImpl;
