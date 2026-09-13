import type { RelicImpl } from '../types';

/**
 * OUROBOROS (boss) — "The first time your bankroll would hit zero, it returns
 * to 8 instead. Once per run, then it is spent." 12 at MK.II.
 *
 * v1.3's Ouroboros restarted the act from a serialized snapshot, which is why
 * it sat in `PENDING_IMPLEMENTATION` behind an acquisition-order ruling: a
 * restart has to decide what happens to relics taken during the act. v2.0's
 * rule is a number, and there is no act to restart, so the ruling is moot.
 *
 * `onBankrollChange` fires after the change lands, so the relic sees 0 rather
 * than predicting it. It resolves AFTER the §2.4 emergency offer (registry
 * engine_note), so a player who can pay gold pays gold first and keeps this —
 * the reducer enforces that ordering, because only the reducer knows whether
 * the offer was taken.
 */
export default {
  initialState: { spent: false },
  hooks: {
    onBankrollChange: (ctx, p) => {
      if (p.bankroll > 0 || ctx.self.state.spent === true) return [];
      return [
        { kind: 'BANKROLL', delta: ctx.self.upgraded ? 12 : 8, reason: 'RL.30' },
        { kind: 'SET_RELIC_STATE', instanceId: ctx.self.instanceId, patch: { spent: true } },
      ];
    },
  },
} satisfies RelicImpl;
