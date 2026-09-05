import { recordUse } from '../../core/activation';
import type { RelicImpl } from '../types';

/**
 * SHAVED COIN — "Once per word, re-roll which positions report truthfully. You
 * do not get to see the roll."
 *
 * Chain step 1 owns the mask; this fires the re-roll. The player gets no
 * feedback that anything changed, which is the point.
 *
 * R-015: offered from Act III only. Nothing reports untruthfully unless the
 * Liar Letter modifier is active, and that is Act III, so before then the relic
 * is inert. Withholding it from the offer pool was preferred to inventing a
 * second clause for it.
 */
export default {
  hooks: {
    onUse: (ctx) => {
      const nodeId = ctx.state.word?.nodeId;
      if (!nodeId) return [];
      return [
        { kind: 'REROLL_TRUTH_MASK' },
        { kind: 'SET_RELIC_STATE', instanceId: ctx.self.instanceId, patch: recordUse(ctx.self, nodeId) },
      ];
    },
  },
  chainStep: 1,
} satisfies RelicImpl;
