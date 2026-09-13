import type { RelicImpl } from '../types';

/**
 * POLYGLOT (boss) — "Six- and seven-letter words pay double gold, and the shop
 * that follows them stocks one rarity tier higher." Mirror and boss words too
 * at MK.II.
 *
 * The gold half doubles the node reward, which the reducer has already granted
 * by the time `onWordSolved` runs — so the relic emits the SECOND copy rather
 * than a multiplier. Same shape as `RL.15` Bloodhound's cancelling delta, and
 * for the same reason: rewards stay in one place.
 *
 * The shop half is why §6.1 gained `onShopOpen`. `TIER_UP` is a shop-roll
 * instruction rather than a state change, so it is carried as a counter the
 * roll reads — `shop:tierUp` — and cleared when the shop closes.
 *
 * A boss relic with no drawback, so §6.7 rule 2 upgrades it on REACH.
 */
const LONG = 6;

function qualifies(upgraded: boolean, length: number, kind: string, mirror: boolean): boolean {
  if (length >= LONG) return true;
  return upgraded && (mirror || kind === 'BOSS');
}

export default {
  hooks: {
    onWordSolved: (ctx, p) => {
      const mirror = (ctx.state.word?.solutions.length ?? 1) > 1;
      if (!qualifies(ctx.self.upgraded, p.length, p.kind, mirror)) return [];
      const base =
        p.kind === 'BOSS'
          ? ctx.cfg.rewards.boss
          : p.kind === 'ELITE'
            ? ctx.cfg.rewards.elite
            : ctx.cfg.rewards.word;
      return [{ kind: 'GOLD', delta: base, reason: 'RL.22' }];
    },
    onShopOpen: (ctx, p) => {
      const mirror = false; // the word is over; length and kind are the record of it
      if (!qualifies(ctx.self.upgraded, p.afterLength, p.afterKind, mirror)) return [];
      return [{ kind: 'SET_COUNTER', key: 'shop:tierUp', value: 1 }];
    },
  },
} satisfies RelicImpl;
