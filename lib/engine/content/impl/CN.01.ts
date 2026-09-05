import type { RelicImpl } from '../types';

/** THE SPYGLASS — "Reveals the vowel count and repeat flag of the current word." */
export default {
  hooks: {
    onUse: (ctx) => [
      { kind: 'REVEAL_META', field: 'vowelCount' },
      { kind: 'REVEAL_META', field: 'hasRepeat' },
      { kind: 'CONSUME', instanceId: ctx.self.instanceId },
    ],
  },
} satisfies RelicImpl;
