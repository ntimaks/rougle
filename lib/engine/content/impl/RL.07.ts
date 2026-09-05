import { recordUse } from '../../core/activation';
import type { RelicImpl } from '../types';

/**
 * THE AUDITOR — "Once per word, at any time, name one untried letter and pay
 * 5g. He stamps it PRESENT or ABSENT. If you cannot pay, he does not answer."
 *
 * R-001 dropped the timing gate and set the cost and the once-per-word cap;
 * R-013 makes it an activation. The 5g is charged by the engine from the
 * declared `activation.cost`, and "if you cannot pay, he does not answer" is
 * the affordability check in `checkActivation` — the use is refused rather than
 * consumed, which is the same outcome and keeps the cap honest.
 */
export default {
  hooks: {
    onUse: (ctx, p) => {
      const letter = String(p.payload['letter'] ?? '').toUpperCase();
      const nodeId = ctx.state.word?.nodeId;
      if (!nodeId || !/^[A-Z]$/.test(letter)) return [];
      // Naming a letter already tried buys nothing, so it is not a legal use.
      const tried = new Set((ctx.state.word?.history ?? []).flatMap((h) => [...h.guess]));
      if (tried.has(letter)) return [];
      return [
        { kind: 'REVEAL_LETTER', letter },
        { kind: 'SET_RELIC_STATE', instanceId: ctx.self.instanceId, patch: recordUse(ctx.self, nodeId) },
      ];
    },
  },
} satisfies RelicImpl;
