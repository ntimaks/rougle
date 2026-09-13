import type { RelicImpl } from '../types';

/**
 * THE ANVIL — "Forge nodes give you two operations instead of one. Your
 * bankroll starts 2 lower."
 *
 * The two operations are read as data by `forgeOperations`, not fired here: a
 * node opening with a different count is a property of the node, and asking the
 * relic at open time is simpler than having it push state ahead of itself.
 *
 * The drawback moved from `onActStart` to `onRunStart` with the resource. Under
 * a per-act pool it cut the cap once an act, three times a run; under §2.1
 * there is one bankroll and one start, so it charges once.
 *
 * MK.II gives the 2 back "the moment you first use a Forge" — which is a thing
 * that happens at a node, so the refund fires on `onNodeEnter` at a FORGE
 * rather than on the upgrade. Upgrading at the forge you are standing in
 * therefore pays out on the next one, which is what the rule says.
 */
export default {
  initialState: { paidBack: false },
  hooks: {
    onRunStart: () => [{ kind: 'BANKROLL', delta: -2, reason: 'RL.09' }],
    onNodeEnter: (ctx, p) => {
      if (!ctx.self.upgraded || p.kind !== 'FORGE' || ctx.self.state.paidBack === true) return [];
      return [
        { kind: 'BANKROLL', delta: 2, reason: 'RL.09 MK.II' },
        { kind: 'SET_RELIC_STATE', instanceId: ctx.self.instanceId, patch: { paidBack: true } },
      ];
    },
  },
} satisfies RelicImpl;
