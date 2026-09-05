import type { RelicImpl } from '../types';

/**
 * THE LEDGER — "Leftover guesses convert at 15g each instead of 10g."
 *
 * Act end already converts at the base rate, so this tops up the difference
 * rather than replacing the conversion. Expressing it as a delta keeps the
 * conversion itself in one place and keeps the relic a pure hook.
 */
export default {
  hooks: {
    onActEnd: (ctx, p) => {
      const bonus = (ctx.cfg.ledgerGoldPerLeftoverGuess - ctx.cfg.goldPerLeftoverGuess) * p.leftover;
      return bonus > 0 ? [{ kind: 'GOLD', delta: bonus, reason: 'RL.24' }] : [];
    },
  },
} satisfies RelicImpl;
