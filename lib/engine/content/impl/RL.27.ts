import type { RelicImpl } from '../types';

/**
 * THE VAULT — "Up to 10 leftover guesses carry into the next act instead of
 * converting to gold." Sixteen at MK.II.
 *
 * Unimplementable until R-024: `poolMax` was a hard ceiling, so a carry had
 * nowhere to land and the relic did nothing (§13 I-15, open since Phase 1).
 *
 * Two halves, because a carry crosses an act boundary. At onActEnd it books the
 * amount and cancels the gold those guesses would have earned — "instead of
 * converting to gold" is the whole trade. At onActStart it pours them in, which
 * runs AFTER `refillPool`, so the pool lands above its cap exactly as R-024
 * allows and the relic's own "does not raise the act cap" stays true.
 */
const CARRY = 'carry';

export default {
  initialState: { [CARRY]: 0 },
  hooks: {
    onActEnd: (ctx, p) => {
      const cap = ctx.self.upgraded ? 16 : ctx.cfg.vaultCarryCap;
      const carried = Math.min(cap, Math.max(0, p.leftover));
      if (carried === 0) return [];
      return [
        { kind: 'GOLD', delta: -carried * ctx.cfg.goldPerLeftoverGuess, reason: 'RL.27' },
        { kind: 'SET_RELIC_STATE', instanceId: ctx.self.instanceId, patch: { [CARRY]: carried } },
      ];
    },
    onActStart: (ctx) => {
      const carried = Number(ctx.self.state[CARRY] ?? 0);
      if (carried <= 0) return [];
      return [
        { kind: 'POOL', delta: carried, reason: 'RL.27' },
        { kind: 'SET_RELIC_STATE', instanceId: ctx.self.instanceId, patch: { [CARRY]: 0 } },
      ];
    },
  },
} satisfies RelicImpl;
