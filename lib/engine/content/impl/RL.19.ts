import type { RelicImpl } from '../types';

/**
 * THE MOTH — "Every fourth word it eats two letters off your keyboard and pays
 * you 1 bankroll. It never eats a letter present in the solution." Every third
 * at MK.II.
 *
 * §6.5 scaling relic, counter WORDS SURVIVED. The counter is the SCHEDULE, not
 * a multiplier: the relic pays on `counter % period === 0` and the payment
 * never grows. A counter that multiplied would be a run-long compounding
 * bankroll grant, which is the shape §6.5 warns about.
 *
 * It used to lock one letter and pay at EVERY word start, plus extra on the
 * fourth — 2.50 bankroll a word, more than the entire §2.3 bleed, on an
 * UNCOMMON (R-044). On the gorge only it is 0.25, and 0.30 upgraded.
 *
 * The letters are omitted so the engine draws them from the shared
 * `eligibleLettersForRemoval(solution)` helper (R-003) — the relic must not see
 * the solution.
 */
export default {
  initialState: { words: 0 },
  hooks: {
    onWordStart: (ctx) => {
      const words = Number(ctx.self.state.words ?? 0) + 1;
      const tick = {
        kind: 'SET_RELIC_STATE' as const,
        instanceId: ctx.self.instanceId,
        patch: { words },
      };
      const period = ctx.self.upgraded ? 3 : 4;
      if (words % period !== 0) return [tick];
      return [
        { kind: 'LOCK_LETTER', source: 'RL.19' },
        { kind: 'LOCK_LETTER', source: 'RL.19' },
        { kind: 'BANKROLL', delta: 1, reason: 'RL.19' },
        tick,
      ];
    },
  },
} satisfies RelicImpl;
