import type { RelicImpl } from '../types';

/**
 * THE PILGRIM — "Passing a shop node without buying anything grants 30g on
 * leaving." MK.II pays 50g and extends to forges.
 *
 * Needs onNodeLeave, which did not exist: whether you bought anything is only
 * knowable on the way out. Adding the hook rather than reaching into the shop
 * from the reducer is the AGENTS.md rule — a relic that cannot name a hook
 * means the hook list is incomplete.
 */
export default {
  hooks: {
    onNodeLeave: (ctx, p) => {
      if (p.usedIt) return [];
      const covered = ctx.self.upgraded ? ['SHOP', 'FORGE'] : ['SHOP'];
      if (!covered.includes(p.kind)) return [];
      return [{ kind: 'GOLD', delta: ctx.self.upgraded ? 50 : 30, reason: 'RL.16' }];
    },
  },
} satisfies RelicImpl;
