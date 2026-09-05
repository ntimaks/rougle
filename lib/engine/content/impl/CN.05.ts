import type { RelicImpl } from '../types';

/** SKELETON KEY — "Turns one green on the next word you enter." */
export default {
  hooks: {
    onUse: (ctx) => [
      { kind: 'PRESET_TILE' },
      { kind: 'CONSUME', instanceId: ctx.self.instanceId },
    ],
  },
} satisfies RelicImpl;
