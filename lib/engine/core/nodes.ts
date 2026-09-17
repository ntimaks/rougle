import { EVENTS, eventsForAct, type EventDef } from '../content/events';
import { REGISTRY, offerableConsumables, offerableInAct, offerableRelics } from '../content/registry';
import type { RelicDef } from '../content/types';
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
 * §4.2 shop prices, from `cfg.prices`. FLAT — no variance.
 *
 * v1.3 derived a rarity base from the prototype's shelf and swung it ±20%,
 * because the prototype priced two RAREs differently and a lookup could not
 * explain that. §4.2 is a table with one number per rarity, and it is normative,
 * so the variance goes. It also has to: §11.5 asks how many relics a run buys,
 * and a ±20% swing on a 180g rare is a 72g spread — larger than the gap between
 * two rarities — which turns "can I afford a rare" into a dice roll.
 *
 * What the prices no longer do is gate rarity. They used to be the only thing
 * that did — a rare cost three commons and nothing else made it rare — and a
 * price is bad at it: a player who wants the rare saves two nodes and buys it,
 * and a player who cannot afford one walks past a shelf they can do nothing
 * with. §6.6's per-act shares carry the scarcity now, so §4.2's numbers came
 * down about a third and are affordable on purpose.
 */
export function shopPrice(code: string, cfg: Readonly<GameConfig>): number {
  const def = REGISTRY[code];
  return cfg.prices[def?.rarity ?? 'COMMON'] ?? cfg.prices.COMMON;
}

/** §4.2 — sell a held relic for half its price, rounded down. */
export function sellPrice(code: string, cfg: Readonly<GameConfig>): number {
  return Math.floor(shopPrice(code, cfg) * cfg.sellFraction);
}

/** §4.2 — 20g, +10g per reroll within the SAME shop. */
export function rerollCost(rerolls: number, cfg: Readonly<GameConfig>): number {
  return cfg.rerollBase + cfg.rerollStep * rerolls;
}

/**
 * §6.6 — the tier a shop stocks at. `RL.22` Polyglot raises it by one after a
 * long word, which is what the `shop:tierUp` counter carries.
 *
 * Shifting the act's rarity SHARES up one tier is what "stocks one rarity tier
 * higher" means: an Act I shelf under Polyglot is drawn on Act I's COMMON share
 * given to UNCOMMON and its UNCOMMON share given to RARE. RARE keeps its own
 * share as well, because there is no tier above it to promote into and dropping
 * it would make the relic lower the ceiling it is sold as raising.
 *
 * It used to raise the PRICE of whatever was drawn and leave the draw alone, so
 * a boss relic bought to improve the shelf instead charged UNCOMMON money for a
 * COMMON relic. That is the penalty its own comment said it was avoiding.
 */
const TIERS = ['COMMON', 'UNCOMMON', 'RARE'] as const;

function tierUpWeights(
  weights: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> {
  const out: Record<string, number> = { ...weights, COMMON: 0 };
  for (let i = 0; i < TIERS.length - 1; i++) {
    out[TIERS[i + 1]!] = (out[TIERS[i + 1]!] ?? 0) + (weights[TIERS[i]!] ?? 0);
  }
  return out;
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
 * §6.6 — the weight of each relic in a draw: its rarity's share of this act,
 * divided by how many of that rarity are still available, times §6.4's
 * archetype bias.
 *
 * The division is the whole trick. `rarityWeights` states a share of the DRAW,
 * and there are 8 COMMON relics against 12 UNCOMMON, so handing every relic its
 * tier's weight would give UNCOMMON half again the share the table claims.
 * Dividing by the live tier count makes the stated share the share that lands,
 * and keeps it landing as relics leave the pool — the last unheld RARE is
 * exactly as likely to appear as the first of seven was.
 */
export function rarityDrawWeights(
  s: GameState,
  pool: readonly RelicDef[],
  cfg: Readonly<GameConfig>,
  tier: Readonly<Record<string, number>>,
): number[] {
  const live: Record<string, number> = {};
  for (const d of pool) live[d.rarity] = (live[d.rarity] ?? 0) + 1;
  return pool.map(
    (d) => ((tier[d.rarity] ?? 0) / (live[d.rarity] ?? 1)) * archetypeWeight(s, d.archetype, cfg),
  );
}

/**
 * Draw `count` distinct relics from `pool`, rarity- and archetype-weighted.
 *
 * A relic whose rarity has weight 0 in this act is dropped before the draw
 * rather than given a zero weight: `drawWeighted` refuses a pool that sums to
 * nothing, and under Polyglot COMMON's share is 0, so a COMMON-only remainder
 * is reachable rather than hypothetical.
 */
export function drawRelicSlots(
  s: GameState,
  pool: readonly RelicDef[],
  domain: string,
  count: number,
  cfg: Readonly<GameConfig>,
  tier: Readonly<Record<string, number>>,
): string[] {
  let remaining = pool.filter((d) => (tier[d.rarity] ?? 0) > 0);
  const picked: string[] = [];
  for (let slot = 0; slot < count && remaining.length > 0; slot++) {
    const chosen = drawWeighted(
      s.seed,
      domain,
      slot,
      remaining,
      rarityDrawWeights(s, remaining, cfg, tier),
    );
    picked.push(chosen.code);
    remaining = remaining.filter((d) => d.code !== chosen.code);
  }
  return picked;
}

/** §6.6 — the rarity shares this shop draws on, Polyglot's tier-up applied. */
export function shopTierWeights(
  s: GameState,
  cfg: Readonly<GameConfig>,
): Readonly<Record<string, number>> {
  const base = cfg.rarityWeights[s.actIndex] ?? cfg.rarityWeights[0]!;
  return (s.counters['shop:tierUp'] ?? 0) > 0 ? tierUpWeights(base) : base;
}

/** Relics this act's shelf may stock: unheld, in-act, and not BOSS. */
export function shopRelicPool(s: GameState): RelicDef[] {
  return offerableRelics().filter(
    (d) =>
      d.rarity !== 'BOSS' &&
      !s.relics.some((r) => r.code === d.code) &&
      offerableInAct(d, s.actIndex),
  );
}

/**
 * §4.1 — three relics weighted by rarity (§6.6) and archetype, plus one
 * consumable in a reserved slot.
 *
 * `roll` addresses the RNG so a reroll (§4.2) draws a different shelf from the
 * same node: rerolling that returned the same three would be a 20g no-op.
 *
 * BOSS relics are excluded. §3.3 gives them out as a choice of two on a boss
 * clear and §6.7's upgrade rule treats them as a distinct thing; a boss relic
 * on a shelf would make the boss reward redundant. They carry weight 0 in
 * `cfg.rarityWeights` as well, so the exclusion holds even if this filter is
 * ever relaxed.
 */
export function rollShopStock(
  s: GameState,
  nodeId: NodeId,
  cfg: Readonly<GameConfig>,
  roll = 0,
): ShopStockItem[] {
  const domain = DOMAIN.shop(`${nodeId}:${roll}`);
  const codes = drawRelicSlots(
    s,
    shopRelicPool(s),
    domain,
    cfg.shopRelics,
    cfg,
    shopTierWeights(s, cfg),
  );

  // Consumables restock: unlike relics, holding one does not remove it.
  const consumables = offerableConsumables();
  for (let i = 0; i < cfg.shopConsumables && consumables.length > 0; i++) {
    const pick = consumables[drawInt(s.seed, domain, 600 + i, consumables.length)]!;
    codes.push(pick.code);
  }

  return codes.map((code) => ({ code, price: shopPrice(code, cfg), sold: false }));
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
