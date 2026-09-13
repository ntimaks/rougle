import { EVENTS, eventsForAct, type EventDef } from '../content/events';
import { REGISTRY, offerableConsumables, offerableInAct, offerableRelics } from '../content/registry';
import type { RelicDef } from '../content/types';
import { CONFIG, type GameConfig } from './config';
import { DOMAIN, draw, drawInt, drawShuffle, drawWeighted } from './rng';
import type { GameState, NodeId, ShopStockItem } from './state';

/**
 * SHOP, FORGE and EVENT node entry — MECHANICS.md §6.4, §6.7, §6.8.
 *
 * Split out of reducer.ts for the same reason pool.ts is: these are three
 * self-contained economies and the reducer is already the longest file in the
 * engine. Every function here is pure and returns data; `reduce` applies it.
 */

/**
 * Shop price. MECHANICS.md §4.2, and `cfg.prices` is where the numbers live.
 *
 * Two RAREs at different prices on the prototype shelf is what established that
 * a price is a rarity base plus a swing rather than a lookup, and that shape is
 * unchanged. The bases are not: they were carrying the job of making a RARE
 * feel rare, and a price cannot do that job — a player with gold buys the rare
 * every time it appears, and the only thing an expensive shelf produced was a
 * player who could not buy anything at all. Scarcity is `cfg.rarityWeights`
 * now, so the prices are free to be affordable, and are.
 *
 * The swing is ±15% rather than ±20% so the tiers do not overlap. At ±20% a
 * lucky COMMON cost more than an unlucky UNCOMMON, which reads as a mispriced
 * shelf rather than as variance.
 */
export function shopPrice(
  code: string,
  seed: string,
  nodeId: NodeId,
  slot: number,
  cfg: Readonly<GameConfig> = CONFIG,
): number {
  const def = REGISTRY[code];
  const base = cfg.prices[def?.rarity ?? 'COMMON'] ?? cfg.prices.COMMON;
  // Addressed off the slot so a re-render never re-rolls the price.
  const swing = (draw(seed, DOMAIN.shop(nodeId), 900 + slot) * 2 - 1) * cfg.priceVariance;
  return Math.max(5, Math.round((base * (1 + swing)) / 5) * 5);
}

/**
 * §6.4 archetype weighting: bias toward what the player already holds, with a
 * floor so pivoting stays possible.
 */
function archetypeWeight(
  s: GameState,
  archetype: string | undefined,
  cfg: Readonly<GameConfig>,
): number {
  const held = s.relics.filter((r) => REGISTRY[r.code]).map((r) => REGISTRY[r.code]!);
  if (!archetype || held.length === 0) return 1;
  const inArchetype = held.filter((h) => h.archetype === archetype).length;
  return cfg.shopArchetypeFloor + (1 - cfg.shopArchetypeFloor) * (inArchetype / held.length);
}

/**
 * §6.6 — the weight of each relic in a draw: its rarity's share of the act,
 * divided by how many of that rarity are still available, times §6.4's
 * archetype bias.
 *
 * The division is the whole trick. `rarityWeights` states a share of the DRAW,
 * and there are 8 COMMON relics against 12 UNCOMMON, so handing every relic its
 * tier's weight would give UNCOMMON half again as much of the shelf as the
 * number says. Dividing by the live tier count makes the stated share the share
 * that actually lands, and keeps it landing as relics leave the pool — the last
 * unheld RARE is exactly as likely to appear as the first of seven was.
 */
export function rarityDrawWeights(
  s: GameState,
  pool: readonly RelicDef[],
  cfg: Readonly<GameConfig>,
): number[] {
  const tier = cfg.rarityWeights[s.actIndex] ?? cfg.rarityWeights[0]!;
  const live: Record<string, number> = {};
  for (const d of pool) live[d.rarity] = (live[d.rarity] ?? 0) + 1;
  return pool.map(
    (d) => ((tier[d.rarity] ?? 0) / (live[d.rarity] ?? 1)) * archetypeWeight(s, d.archetype, cfg),
  );
}

/**
 * Draw `count` distinct relics from `pool`, rarity- and archetype-weighted.
 *
 * Shared by the shop shelf and the reward offer rather than written twice: the
 * two used to carry their own copy of the archetype formula, and two copies of
 * a weighting rule drift invisibly. A relic whose rarity has weight 0 in this
 * act is dropped before the draw rather than given a zero weight, because
 * `drawWeighted` refuses a pool that sums to nothing and a BOSS-only remainder
 * is exactly that.
 */
export function drawRelicSlots(
  s: GameState,
  pool: readonly RelicDef[],
  domain: string,
  baseIndex: number,
  count: number,
  cfg: Readonly<GameConfig>,
): string[] {
  const tier = cfg.rarityWeights[s.actIndex] ?? cfg.rarityWeights[0]!;
  let remaining = pool.filter((d) => (tier[d.rarity] ?? 0) > 0);
  const picked: string[] = [];
  for (let slot = 0; slot < count && remaining.length > 0; slot++) {
    const chosen = drawWeighted(
      s.seed,
      domain,
      baseIndex + slot,
      remaining,
      rarityDrawWeights(s, remaining, cfg),
    );
    picked.push(chosen.code);
    remaining = remaining.filter((d) => d.code !== chosen.code);
  }
  return picked;
}

/**
 * Relics that may appear on a shelf or in a reward offer in this act.
 *
 * BOSS relics are excluded. They were in this pool, unweighted and — because
 * `PRICE_BASE` had no BOSS row — priced as COMMON, so The Mask was a 55g shop
 * staple with the highest pick rate in the game. §3.3 pays boss relics for
 * beating a boss; `bossRelicPool` is where they live now.
 */
export function offerPool(s: GameState): RelicDef[] {
  return offerableRelics().filter(
    (d) =>
      d.rarity !== 'BOSS' &&
      !s.relics.some((r) => r.code === d.code) &&
      offerableInAct(d, s.actIndex),
  );
}

/** §3.3 — the boss relics still unheld. Empty once they are all taken. */
export function bossRelicPool(s: GameState): RelicDef[] {
  return offerableRelics().filter(
    (d) => d.rarity === 'BOSS' && !s.relics.some((r) => r.code === d.code),
  );
}

/**
 * The shelf: `shopRelicSlots` relics plus `shopConsumableSlots` consumables.
 *
 * The consumable slot is reserved rather than won. Consumables used to sit in
 * the same weighted draw as the relics, which meant a shelf could hold three of
 * them or none, and neither shelf is one a player can plan around. §4.1 asks
 * for a fixed split and a fixed split is also what makes `rarityWeights` mean
 * what it says — a consumable competing for a relic slot is a rarity share
 * nobody wrote down.
 */
export function rollShopStock(
  s: GameState,
  nodeId: NodeId,
  cfg: Readonly<GameConfig>,
): ShopStockItem[] {
  const domain = DOMAIN.shop(nodeId);
  const codes = drawRelicSlots(s, offerPool(s), domain, 0, cfg.shopRelicSlots, cfg);

  // Consumables restock: unlike relics, holding one does not remove it, so the
  // pool is the whole implemented set every time.
  let consumables = [...offerableConsumables()];
  for (let i = 0; i < cfg.shopConsumableSlots && consumables.length > 0; i++) {
    const pick = consumables[drawInt(s.seed, domain, 950 + i, consumables.length)]!;
    codes.push(pick.code);
    consumables = consumables.filter((c) => c.code !== pick.code);
  }

  return codes.map((code, slot) => ({
    code,
    price: shopPrice(code, s.seed, nodeId, slot, cfg),
    sold: false,
  }));
}

/** RL.09 The Anvil grants two operations instead of one (§6.7). */
export function forgeOperations(s: GameState): number {
  return s.relics.some((r) => r.code === 'RL.09') ? 2 : 1;
}

/** §6.7: 20g per guess, any quantity affordable. */
export const FORGE_GOLD_PER_GUESS = 20;

/**
 * How many relics a forge offers to work on. Three, like the reward screen's
 * three offers — a number a player can hold in their head against branch B.
 */
export const FORGE_CANDIDATES = 3;

/**
 * The relics THIS forge will upgrade, drawn on entry (R-035, §6.7).
 *
 * A forge used to list every upgradeable relic you held. That made the node
 * strictly better the more you carried, gave branch B nothing to compete
 * against once you held anything good, and meant the operation always went to
 * whatever your best relic happened to be. Drawing three makes WHICH relic you
 * can improve part of the run rather than a foregone conclusion, and it is the
 * same shape as the shop's shelf and the reward screen's offers.
 *
 * Eligibility is checked here, not on screen: an already-MK.II relic or one
 * with no upgrade tier would burn a slot on something unusable.
 */
export function drawForgeCandidates(s: GameState, nodeId: NodeId): string[] {
  const eligible = s.relics.filter((r) => !r.upgraded && REGISTRY[r.code]?.upgrade);
  if (eligible.length <= FORGE_CANDIDATES) return eligible.map((r) => r.instanceId);
  return drawShuffle(s.seed, DOMAIN.forge(nodeId), 0, eligible)
    .slice(0, FORGE_CANDIDATES)
    .map((r) => r.instanceId);
}

/**
 * Draw an event for this node. §6.8: without replacement within a run, gated by
 * `acts`. Returns null only if the act's pool is exhausted, which twelve events
 * against a 2–5 per run expectation makes unreachable in practice — handled
 * rather than asserted, because "unreachable in practice" is how runs break.
 */
export function drawEvent(s: GameState, nodeId: NodeId): EventDef | null {
  const eligible = eventsForAct(s.actIndex, s.seenEvents);
  if (eligible.length === 0) return null;
  const i = drawInt(s.seed, DOMAIN.offer(nodeId), 700, eligible.length);
  return eligible[i]!;
}

/**
 * Whether an option's `requires` is met. §6.8 is explicit that an unmet option
 * renders disabled with the requirement stated, never hidden — so this answers
 * "grey it out", never "drop it".
 */
export function optionAvailable(
  s: GameState,
  requires: { gold_min?: number; relics_min?: number } | undefined,
): boolean {
  if (!requires) return true;
  if (requires.gold_min !== undefined && s.gold < requires.gold_min) return false;
  if (requires.relics_min !== undefined && s.relics.length < requires.relics_min) return false;
  return true;
}

export { EVENTS };
