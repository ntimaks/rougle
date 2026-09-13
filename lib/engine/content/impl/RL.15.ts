import type { RelicImpl } from '../types';

/**
 * BLOODHOUND — "Clearing an elite pays 1 bankroll. Elites pay you no gold."
 * MK.II adds bosses; elites still pay nothing.
 *
 * One bankroll, not two. Six elites over a 20-word run is 0.30 a word, which is
 * the UNCOMMON allowance exactly; +2 would be 0.60, over the §6.5 ceiling of
 * 0.50 (R-048). MK.II reaches bosses instead of raising the number, which is
 * 0.45 — under the ceiling because an upgrade is judged against it.
 *
 * The gold suppression is a cancelling delta rather than a branch in the reward
 * path, so the reward stays in one place and the relic stays a pure hook
 * instead of the reducer growing an `if (hasRelic(...))`.
 */
export default {
  hooks: {
    onWordSolved: (ctx, p) => {
      const kind = p.kind;
      const isElite = kind === 'ELITE';
      const isBoss = kind === 'BOSS';
      if (!isElite && !(isBoss && ctx.self.upgraded)) return [];
      return [
        { kind: 'BANKROLL', delta: 1, reason: 'RL.15' },
        ...(isElite
          ? ([{ kind: 'GOLD', delta: -ctx.cfg.rewards.elite, reason: 'RL.15' }] as const)
          : []),
      ];
    },
  },
} satisfies RelicImpl;
