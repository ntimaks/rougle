import type { RelicImpl } from '../types';

/**
 * THE DECANTER — "Pours 4 bankroll. Cannot exceed the cap of 24."
 *
 * The cap is `bank.grant`'s job, and anything over it converts to gold at 10g
 * (§2.1) rather than being lost — so a Decanter drunk at 23 is not wasted, it
 * is 1 bankroll and 30g, and both movements are narrated.
 */
export default {
  hooks: {
    onUse: (ctx) => [
      { kind: 'BANKROLL', delta: 4, reason: 'CN.03' },
      { kind: 'CONSUME', instanceId: ctx.self.instanceId },
    ],
  },
} satisfies RelicImpl;
