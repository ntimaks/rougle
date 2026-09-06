import type { RelicImpl } from '../types';

/**
 * THE ANVIL — "Forge nodes give you two operations instead of one. Act pool
 * reduced by 1."
 *
 * The two operations are read as data by `forgeOperations`, not fired here: a
 * node opening with a different count is a property of the node, and asking the
 * relic at open time is simpler than having it push state ahead of itself.
 *
 * What DOES need a hook is the drawback, and it belongs on onActStart rather
 * than the declared onNodeEnter — the pool is cut once per act, not once per
 * node walked into. MK.II lifts it entirely.
 */
export default {
  hooks: {
    onActStart: (ctx) =>
      ctx.self.upgraded ? [] : [{ kind: 'POOL_MAX', delta: -1, reason: 'RL.09' }],
  },
} satisfies RelicImpl;
