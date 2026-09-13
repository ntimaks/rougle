import type { RelicImpl } from '../types';

/**
 * THE LANTERN — "After two failed guesses on a word, it lights the first
 * letter. Every third time it lights, it lights one letter more, permanently."
 * After one failed guess at MK.II.
 *
 * §6.5 scaling relic, counter TIMES LIT, and the second FAILURE-scaling relic:
 * it only lights on a word that has already gone badly, and lights harder the
 * more often that has happened.
 *
 * `letters_lit = 1 + floor(counter / 3)` uses the counter BEFORE this lighting,
 * so the fourth lighting is the first to give two. Not a pre-guess reveal: it
 * resolves during a word.
 */
export default {
  initialState: { litNodeId: null, lit: 0 },
  hooks: {
    onGuessSubmit: (ctx, p) => {
      const nodeId = ctx.state.word?.nodeId ?? null;
      const after = ctx.self.upgraded ? 1 : 2;
      if (p.turn < after || ctx.self.state.litNodeId === nodeId) return [];
      const lit = Number(ctx.self.state.lit ?? 0);
      const count = 1 + Math.floor(lit / 3);
      return [
        ...Array.from({ length: count }, () => ({ kind: 'PRESET_TILE' }) as const),
        {
          kind: 'SET_RELIC_STATE',
          instanceId: ctx.self.instanceId,
          patch: { litNodeId: nodeId, lit: lit + 1 },
        },
      ];
    },
  },
} satisfies RelicImpl;
