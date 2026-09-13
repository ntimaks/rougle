import type { RelicImpl } from '../types';

/**
 * HOT STREAK — "Each consecutive solve in two or fewer adds 1 to the payout,
 * cumulatively, up to +3. Any slower solve resets it to zero."
 *
 * §6.5 scaling relic: STREAK is the counter and the card shows it. MK.II caps
 * at 5 and HALVES on a slow solve rather than clearing — which is the §6.7 rule
 * that an upgrade must accelerate the counter, not replace it with a flat bonus.
 *
 * The bonus is the streak BEFORE this solve, so the first fast solve pays
 * nothing and the second pays +1. Reading it the other way makes the relic an
 * unconditional +1 on every fast solve, which is `RL.11` with extra steps.
 *
 * Both hooks fire on the same solve. `onPayout` reads the counter and
 * `onWordSolved` moves it, and the reducer runs solved before payout — so the
 * order matters and is asserted in the test rather than assumed.
 */
const CAP = 3;
const CAP_MK2 = 5;

export default {
  initialState: { streak: 0 },
  hooks: {
    onPayout: (ctx, p) => {
      if (p.guessesUsed > 2) return [];
      const streak = Number(ctx.self.state.streak ?? 0);
      const bonus = Math.min(streak, ctx.self.upgraded ? CAP_MK2 : CAP);
      return bonus > 0 ? [{ kind: 'PAYOUT_BONUS', amount: bonus, source: 'RL.12' }] : [];
    },
    onWordSolved: (ctx, p) => {
      const streak = Number(ctx.self.state.streak ?? 0);
      const next =
        p.guessesUsed <= 2
          ? streak + 1
          : ctx.self.upgraded
            ? Math.floor(streak / 2)
            : 0;
      if (next === streak) return [];
      return [
        { kind: 'SET_RELIC_STATE', instanceId: ctx.self.instanceId, patch: { streak: next } },
      ];
    },
  },
} satisfies RelicImpl;
