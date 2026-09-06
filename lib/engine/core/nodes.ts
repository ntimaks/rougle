import { EVENTS, eventsForAct, type EventDef } from '../content/events';
import { REGISTRY, offerableConsumables, offerableInAct, offerableRelics } from '../content/registry';
import type { GameConfig } from './config';
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
 * Shop price, derived from the design rather than invented.
 *
 * The prototype's shelf prices Lexicon (COMMON) at 55g, The Auditor (RARE) at
 * 120g, Shaved Coin (RARE) at 180g, and two consumables at 35g and 60g. Two
 * RAREs at different prices means price is a rarity base plus variance, not a
 * lookup — and 150 ± 20% is exactly 120 and 180, which fixes both numbers.
 */
const PRICE_BASE: Readonly<Record<string, number>> = {
  COMMON: 55,
  UNCOMMON: 90,
  RARE: 150,
  CONSUMABLE: 45,
};

const PRICE_VARIANCE = 0.2;
const SHOP_SLOTS = 5;

export function shopPrice(code: string, seed: string, nodeId: NodeId, slot: number): number {
  const def = REGISTRY[code];
  const base = PRICE_BASE[def?.rarity ?? 'COMMON'] ?? PRICE_BASE['COMMON']!;
  // ±20%, addressed off the slot so a re-render never re-rolls the price.
  const swing = (draw(seed, DOMAIN.shop(nodeId), 900 + slot) * 2 - 1) * PRICE_VARIANCE;
  return Math.max(5, Math.round((base * (1 + swing)) / 5) * 5);
}

/**
 * §6.4 archetype weighting: bias toward what the player already holds, with a
 * floor so pivoting stays possible. The same formula the reward roll uses —
 * shared rather than reimplemented, because two copies of a weighting rule
 * drift and the drift is invisible.
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

/** Five slots: relics the player does not hold, plus consumables. */
export function rollShopStock(
  s: GameState,
  nodeId: NodeId,
  cfg: Readonly<GameConfig>,
): ShopStockItem[] {
  const relics = offerableRelics().filter(
    (d) => !s.relics.some((r) => r.code === d.code) && offerableInAct(d, s.actIndex),
  );
  // Consumables restock: unlike relics, holding one does not remove it.
  const pool = [...relics, ...offerableConsumables()];
  const stock: ShopStockItem[] = [];
  let remaining = pool;

  for (let slot = 0; slot < SHOP_SLOTS && remaining.length > 0; slot++) {
    const chosen = drawWeighted(
      s.seed,
      DOMAIN.shop(nodeId),
      slot,
      remaining,
      remaining.map((d) => archetypeWeight(s, d.archetype, cfg)),
    );
    stock.push({ code: chosen.code, price: shopPrice(chosen.code, s.seed, nodeId, slot), sold: false });
    remaining = remaining.filter((d) => d.code !== chosen.code);
  }
  return stock;
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
