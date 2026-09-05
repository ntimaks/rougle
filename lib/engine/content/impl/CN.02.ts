import type { RelicImpl } from '../types';

/** THE POULTICE — "Clears every modifier from the current word." */
export default {
  hooks: {
    onUse: (ctx) => [
      { kind: 'CLEAR_MODIFIERS' },
      { kind: 'CONSUME', instanceId: ctx.self.instanceId },
    ],
  },
} satisfies RelicImpl;
