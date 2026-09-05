import type { RelicImpl } from '../types';

/**
 * THE DECANTER — "Pours 3 guesses into the act pool. Does not raise the cap."
 *
 * A POOL effect, not a REFUND: it is not compensation for a guess and must not
 * go through the §2.4 floor. The cap is enforced by the pool reducer.
 */
export default {
  hooks: {
    onUse: (ctx) => [
      { kind: 'POOL', delta: 3, reason: 'CN.03' },
      { kind: 'CONSUME', instanceId: ctx.self.instanceId },
    ],
  },
} satisfies RelicImpl;
