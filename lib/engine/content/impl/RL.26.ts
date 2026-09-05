import type { RelicImpl } from '../types';

/**
 * THE LANTERN — "After two failed guesses on a word, the first letter is lit
 * for free."
 *
 * Fires on the third submitted guess, once per word. Not a pre-guess reveal:
 * it resolves during a word, so MECHANICS.md §6.3 does not cap it.
 */
export default {
  initialState: { litNodeId: null },
  hooks: {
    onGuessSubmit: (ctx, p) => {
      const nodeId = ctx.state.word?.nodeId ?? null;
      if (p.turn < 2 || ctx.self.state.litNodeId === nodeId) return [];
      return [
        { kind: 'PRESET_TILE', index: 0 },
        { kind: 'SET_RELIC_STATE', instanceId: ctx.self.instanceId, patch: { litNodeId: nodeId } },
      ];
    },
  },
} satisfies RelicImpl;
