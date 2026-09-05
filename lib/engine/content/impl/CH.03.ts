import type { RelicImpl } from '../types';

/**
 * THE CRYPTOGRAPHER (innate) — "May spend a guess to reveal one letter
 * outright, at any time, on any word."
 *
 * No use cap: the guess it costs is the cap, and the character starts 4 guesses
 * down for the privilege. The engine charges the guess from the declared
 * `activation.cost`, and refuses the use when it would empty the pool — dying
 * to an optional action is what the emergency ladder exists to prevent.
 *
 * "Reveal one letter outright" is a pre-set tile, not a present/absent stamp:
 * the Auditor sells membership, the Cryptographer sells a position.
 */
export default {
  hooks: {
    onUse: (ctx, p) => {
      if (!ctx.state.word) return [];
      const asked = Number(p.payload['index']);
      const index = Number.isInteger(asked) ? asked : undefined;
      return [index === undefined ? { kind: 'PRESET_TILE' } : { kind: 'PRESET_TILE', index }];
    },
  },
} satisfies RelicImpl;
