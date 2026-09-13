import { EVENTS, eventsForAct, type EventDef } from '../content/events';
import { REGISTRY, offerableConsumables, offerableInAct, offerableRelics } from '../content/registry';
import type { GameConfig } from './config';
import { heldRelics } from './reducer';
import { DOMAIN, drawInt, drawShuffle, drawWeighted } from './rng';
import type { GameState, NodeId, ShopStockItem } from './state';

/**
 * SHOP, FORGE and EVENT node entry — MECHANICS.md §6.4, §6.7, §6.8.
 *
 * Split out of reducer.ts for the same reason bank.ts is: these are three
 * self-contained economies and the reducer is already the longest file in the
 * engine. Every function here is pure and returns data; `reduce` applies it.
 */

/**
 * §4.2 shop prices, exactly as the table states them. FLAT — no variance.
 *
 * v1.3 derived a rarity base from the prototype's shelf and swung it ±20%,
 * because the prototype priced two RAREs differently and a lookup could not
 * explain that. §4.2 is a table with one number per rarity, and it is normative,
 * so the variance goes. It also has to: §11.5 asks how many relics a run buys,
 * and a ±20% swing on a 180g rare is a 72g spread — larger than the gap between
 * two rarities — which turns "can I afford a rare" into a dice roll.
 */
const PRICE: Readonly<Record<string, number>> = {
  COMMON: 60,
  UNCOMMON: 110,
  RARE: 180,
  BOSS: 180,
  CONSUMABLE: 40,
};

export function shopPrice(code: string): number {
  const def = REGISTRY[code];
  return PRICE[def?.rarity ?? 'COMMON'] ?? PRICE['COMMON']!;
}

/** §4.2 — sell a held relic for half its price, rounded down. */
export function sellPrice(code: string, cfg: Readonly<GameConfig>): number {
  return Math.floor(shopPrice(code) * cfg.sellFraction);
}

/** §4.2 — 20g, +10g per reroll within the SAME shop. */
export function rerollCost(rerolls: number, cfg: Readonly<GameConfig>): number {
  return cfg.rerollBase + cfg.rerollStep * rerolls;
}

/**
 * §6.5 — the tier a shop stocks at. `RL.22` Polyglot raises it by one after a
 * long word, which is what the `shop:tierUp` counter carries.
 */
const TIERS = ['COMMON', 'UNCOMMON', 'RARE'] as const;

function raiseTier(rarity: string): string {
  const i = TIERS.indexOf(rarity as (typeof TIERS)[number]);
  return i >= 0 && i < TIERS.length - 1 ? TIERS[i + 1]! : rarity;
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

/**
 * §4.1 — three relics weighted by archetype, plus one consumable.
 *
 * `roll` addresses the RNG so a reroll (§4.2) draws a different shelf from the
 * same node: rerolling that returned the same three would be a 20g no-op.
 *
 * BOSS relics are excluded. §3.3 gives them out as a choice of two on a boss
 * clear and §6.7's upgrade rule treats them as a distinct thing; a boss relic
 * on a shelf for 180g would make the boss reward redundant.
 */
export function rollShopStock(
  s: GameState,
  nodeId: NodeId,
  cfg: Readonly<GameConfig>,
  roll = 0,
): ShopStockItem[] {
  const tierUp = (s.counters['shop:tierUp'] ?? 0) > 0;
  const relics = offerableRelics().filter(
    (d) =>
      d.rarity !== 'BOSS' &&
      !s.relics.some((r) => r.code === d.code) &&
      offerableInAct(d, s.actIndex),
  );
  const stock: ShopStockItem[] = [];
  let remaining = relics;

  for (let slot = 0; slot < cfg.shopRelics && remaining.length > 0; slot++) {
    const chosen = drawWeighted(
      s.seed,
      DOMAIN.shop(`${nodeId}:${roll}`),
      slot,
      remaining,
      remaining.map((d) => archetypeWeight(s, d.archetype, cfg)),
    );
    // Polyglot raises what the shelf STOCKS, so the price rises with the tier.
    // Selling a common at a rare's price would be a penalty, not a boon.
    const rarity = tierUp ? raiseTier(chosen.rarity) : chosen.rarity;
    stock.push({ code: chosen.code, price: PRICE[rarity] ?? shopPrice(chosen.code), sold: false });
    remaining = remaining.filter((d) => d.code !== chosen.code);
  }

  // Consumables restock: unlike relics, holding one does not remove it.
  const consumables = offerableConsumables();
  for (let i = 0; i < cfg.shopConsumables && consumables.length > 0; i++) {
    const pick =
      consumables[drawInt(s.seed, DOMAIN.shop(`${nodeId}:${roll}`), 600 + i, consumables.length)]!;
    stock.push({ code: pick.code, price: shopPrice(pick.code), sold: false });
  }
  return stock;
}

/** RL.09 The Anvil grants two operations instead of one (§6.7). */
export function forgeOperations(s: GameState): number {
  return s.relics.some((r) => r.code === 'RL.09') ? 2 : 1;
}

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
  // §6.2 — the character innate is in `relics` but is not one the player holds.
  // Counting it offered the Pawnbroker's "sell one" to a player with nothing to
  // sell, and the destroy then had to no-op — an option that looks available
  // and does nothing.
  if (requires.relics_min !== undefined && heldRelics(s).length < requires.relics_min) return false;
  return true;
}

export { EVENTS };
