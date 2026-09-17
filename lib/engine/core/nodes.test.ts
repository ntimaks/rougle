import { describe, expect, it } from 'vitest';
import { CONFIG } from './config';
import { applyEffects, heldRelics, initialState, reduce, relicSlots } from './reducer';
import {
  FORGE_CANDIDATES,
  drawForgeCandidates,
  optionAvailable,
  rerollCost,
  rollShopStock,
  sellPrice,
  shopPrice,
} from './nodes';
import { EVENTS, EVENT_DEFS } from '../content/events';
import { REGISTRY } from '../content/registry';
import type { GameState, NodeId, NodeKind } from './state';
import '../words/all';

/**
 * R-05 — node dispatch. Every node kind the map can generate routes somewhere
 * and returns to the map, which is the thing that had to be true before R-01's
 * generator could be switched on at all.
 */

function run(seed: string): GameState {
  return reduce(initialState(seed, 'CH.01'), {
    type: 'START_RUN',
    seed,
    characterCode: 'CH.01',
  }).state;
}

/**
 * Walk until a state of this PHASE is reached, or give up.
 *
 * Phase, not node kind, because §4 makes the shop a thing that opens after a
 * solve node rather than a node you route to — so "reach a shop" is now "clear
 * a word", and the two can no longer be asked for the same way.
 *
 * `prefix` exists so a test can ask for a DIFFERENT forge rather than the same
 * one sixty times — R-035's draw is a function of seed and node, so sampling it
 * means varying the seed.
 */
function reach(phase: 'SHOP' | 'FORGE' | 'EVENT', seeds = 60, prefix = 'NODE'): GameState | null {
  const kind: NodeKind | null = phase === 'SHOP' ? null : phase;
  for (let i = 0; i < seeds; i++) {
    let s = run(`${prefix}${i}`);
    for (let step = 0; step < 40; step++) {
      if (s.phase === phase) return s;
      if (s.phase === 'MAP') {
        const target =
          (kind && s.map.available.find((id: NodeId) => s.map.nodes[id]!.kind === kind)) ??
          s.map.available[0];
        if (!target) break;
        s = reduce(s, { type: 'SELECT_NODE', nodeId: target }, CONFIG).state;
        continue;
      }
      if (s.phase === 'SHOP' || s.phase === 'FORGE' || s.phase === 'EVENT') {
        s = reduce(s, { type: 'LEAVE_NODE' }, CONFIG).state;
        continue;
      }
      if (s.phase === 'WORD' && s.word) {
        const w = s.word;
        const answer = w.solutions[w.solved.findIndex((v) => !v)] ?? w.solutions[0]!;
        s = reduce(s, { type: 'SUBMIT_GUESS', guess: answer }, CONFIG).state;
        continue;
      }
      if (s.phase === 'REWARD' || s.phase === 'REPLACE') {
        s = reduce(s, { type: 'SKIP_OFFER' }, CONFIG).state;
        continue;
      }
      break;
    }
  }
  return null;
}

describe('every service screen dispatches and returns', () => {
  for (const phase of ['SHOP', 'FORGE', 'EVENT'] as const) {
    it(`${phase} opens its phase and LEAVE_NODE goes back to the map`, () => {
      const s = reach(phase);
      expect(s, `no ${phase} reachable in 60 seeds`).not.toBeNull();
      expect(s!.phase).toBe(phase);
      const left = reduce(s!, { type: 'LEAVE_NODE' }, CONFIG).state;
      expect(['MAP', 'WORD', 'REWARD']).toContain(left.phase);
      expect(left.shop).toBeNull();
      expect(left.forge).toBeNull();
      expect(left.event).toBeNull();
    });
  }

  it('§4 — the shop is not a node, so no map node is one', () => {
    // "A shop opens after every solve node, elites included. It is not a map
    // node and cannot be routed around."
    const s = run('SHOPNODE');
    for (const node of Object.values(s.map.nodes)) {
      expect(node.kind, `${node.id} is a SHOP node`).not.toBe('SHOP');
    }
  });

  it('§4 — clearing a solve node opens one, every time', () => {
    let s = run('AFTERWORD');
    for (let step = 0; step < 20; step++) {
      if (s.phase === 'MAP') {
        s = reduce(s, { type: 'SELECT_NODE', nodeId: s.map.available[0]! }, CONFIG).state;
        continue;
      }
      if (s.phase === 'WORD' && s.word) {
        const kind = s.map.nodes[s.word.nodeId]!.kind;
        const answer = s.word.solutions[0]!;
        const out = reduce(s, { type: 'SUBMIT_GUESS', guess: answer }, CONFIG).state;
        if (kind === 'WORD' || kind === 'ELITE') {
          expect(out.phase, `clearing a ${kind} did not open a shop`).toBe('SHOP');
          return;
        }
        s = out;
        continue;
      }
      break;
    }
    throw new Error('never reached a solve node');
  });

  it('a service screen never starts a word', () => {
    for (const phase of ['FORGE', 'EVENT'] as const) {
      const s = reach(phase);
      expect(s!.word, `${phase} started a word`).toBeNull();
    }
  });
});

describe('§6.4 shop', () => {
  it('stocks things the player does not already hold, priced by rarity', () => {
    const s = reach('SHOP')!;
    expect(s.shop!.stock.length).toBeGreaterThan(0);
    for (const item of s.shop!.stock) {
      expect(REGISTRY[item.code], `${item.code} is not in the registry`).toBeDefined();
      expect(item.price).toBeGreaterThan(0);
      if (!REGISTRY[item.code]!.isConsumable) {
        expect(s.relics.some((r) => r.code === item.code), `${item.code} already held`).toBe(false);
      }
    }
  });

  it('buying charges exactly the listed price and marks the slot sold', () => {
    let s = reach('SHOP')!;
    s = { ...s, gold: 1000 };
    const item = s.shop!.stock[0]!;
    const after = reduce(s, { type: 'BUY_STOCK', slot: 0 }, CONFIG).state;
    expect(after.gold).toBe(1000 - item.price);
    expect(after.shop!.stock[0]!.sold).toBe(true);
    const held = REGISTRY[item.code]!.isConsumable ? after.consumables : after.relics;
    expect(held.some((h) => h.code === item.code)).toBe(true);
  });

  it('the same slot cannot be bought twice, and an empty purse is refused', () => {
    let s = { ...reach('SHOP')!, gold: 1000 };
    s = reduce(s, { type: 'BUY_STOCK', slot: 0 }, CONFIG).state;
    expect(reduce(s, { type: 'BUY_STOCK', slot: 0 }, CONFIG).error?.code).toBe('SOLD_OUT');
    const broke = { ...reach('SHOP')!, gold: 0 };
    expect(reduce(broke, { type: 'BUY_STOCK', slot: 0 }, CONFIG).error?.code).toBe('UNAFFORDABLE');
  });

  it('§4.2 — price is the rarity, flat, with no variance at all', () => {
    // v1.3 swung it ±20%, derived from a prototype shelf that priced two RAREs
    // differently. §4.2 is a table and it is normative — and a 72g spread on a
    // rare is wider than the gap between two rarities, which turns "can I
    // afford this" into a dice roll.
    //
    // Read from `cfg.prices` rather than from literals: §6.6 made the prices a
    // balance lever, and a test that pins them stops the lever moving.
    expect(shopPrice('RL.01', CONFIG)).toBe(CONFIG.prices.COMMON);
    expect(shopPrice('RL.03', CONFIG)).toBe(CONFIG.prices.UNCOMMON);
    expect(shopPrice('RL.04', CONFIG)).toBe(CONFIG.prices.RARE);
    expect(shopPrice('CN.01', CONFIG)).toBe(CONFIG.prices.CONSUMABLE);
    // The rungs must stay ordered, whatever the numbers become.
    expect(CONFIG.prices.COMMON).toBeLessThan(CONFIG.prices.UNCOMMON);
    expect(CONFIG.prices.UNCOMMON).toBeLessThan(CONFIG.prices.RARE);
  });

  it('§4.2 — selling returns half, rounded down', () => {
    expect(sellPrice('RL.01', CONFIG)).toBe(Math.floor(CONFIG.prices.COMMON / 2));
    expect(sellPrice('RL.03', CONFIG)).toBe(Math.floor(CONFIG.prices.UNCOMMON / 2));
  });

  it('§4.2 — a reroll costs more each time WITHIN a shop', () => {
    expect(rerollCost(0, CONFIG)).toBe(CONFIG.rerollBase);
    expect(rerollCost(1, CONFIG)).toBe(CONFIG.rerollBase + CONFIG.rerollStep);
    expect(rerollCost(3, CONFIG)).toBe(CONFIG.rerollBase + 3 * CONFIG.rerollStep);
  });

  it('§4.2 — a reroll draws a different shelf, and charges for it', () => {
    const s = { ...reach('SHOP')!, gold: 1000 };
    const before = s.shop!.stock.map((x) => x.code).join();
    const out = reduce(s, { type: 'REROLL_SHOP' }, CONFIG);
    expect(out.error).toBeUndefined();
    expect(out.state.gold).toBe(1000 - CONFIG.rerollBase);
    expect(out.state.shop!.rerolls).toBe(1);
    // A reroll that returned the same three would be a 20g no-op.
    expect(out.state.shop!.stock.map((x) => x.code).join()).not.toBe(before);
  });

  it('§4.1 — three relics and one consumable, and no boss relics', () => {
    const s = reach('SHOP')!;
    const relics = s.shop!.stock.filter((x) => !REGISTRY[x.code]!.isConsumable);
    const consumables = s.shop!.stock.filter((x) => REGISTRY[x.code]!.isConsumable);
    expect(relics).toHaveLength(CONFIG.shopRelics);
    expect(consumables).toHaveLength(CONFIG.shopConsumables);
    // §3.3 hands boss relics out on a boss clear. One on a shelf for 180g would
    // make the boss reward redundant.
    for (const item of relics) expect(REGISTRY[item.code]!.rarity).not.toBe('BOSS');
  });

  it('§4.1 — one refill per shop, off the run-long ladder', () => {
    const s = { ...reach('SHOP')!, gold: 1000, bankroll: 5 };
    const first = reduce(s, { type: 'BUY_REFILL' }, CONFIG);
    expect(first.error).toBeUndefined();
    expect(first.state.bankroll).toBe(6);
    expect(first.state.stats.refillsBought).toBe(1);
    expect(reduce(first.state, { type: 'BUY_REFILL' }, CONFIG).error?.code).toBe('REFILL_EXHAUSTED');
  });

  it('§4.1 — a refill is refused at the cap rather than sold into overflow', () => {
    // At 10g a guess the overflow returns an eighth of a rung. That is a trap,
    // not a trade.
    const full = { ...reach('SHOP')!, gold: 1000, bankroll: CONFIG.economy.bankrollCap };
    expect(reduce(full, { type: 'BUY_REFILL' }, CONFIG).error?.code).toBe('BANKROLL_FULL');
  });

  it('§4.2 — a held relic sells for half, and leaves the board', () => {
    const s = reach('SHOP')!;
    const planted = plantRelics(1)[0]!;
    const held = { ...s, relics: [...s.relics, planted], gold: 0 };
    const out = reduce(held, { type: 'SELL_RELIC', instanceId: planted.instanceId }, CONFIG);
    expect(out.error).toBeUndefined();
    expect(out.state.gold).toBe(sellPrice(planted.code, CONFIG));
    expect(out.state.relics.some((r) => r.instanceId === planted.instanceId)).toBe(false);
  });

  it('§6.2 — the character innate is not a slot and is not sellable', () => {
    const s = reach('SHOP')!;
    const innate = s.relics.find((r) => r.code === s.characterCode)!;
    expect(reduce(s, { type: 'SELL_RELIC', instanceId: innate.instanceId }, CONFIG).error?.code).toBe(
      'NO_SUCH_ITEM',
    );
  });

  it('§6.2 — a sixth relic waits for the player to destroy one of five', () => {
    const s = reach('SHOP')!;
    const onShelf = s.shop!.stock.map((x) => x.code);
    const full = {
      ...s,
      relics: [...s.relics, ...plantRelics(CONFIG.relicSlots, false, onShelf)],
      gold: 1000,
    };
    const slot = full.shop!.stock.findIndex(
      (x) => !REGISTRY[x.code]!.isConsumable && !full.relics.some((r) => r.code === x.code),
    );
    expect(slot, 'no unheld relic on the shelf to buy').toBeGreaterThanOrEqual(0);
    expect(full.relics.filter((r) => r.code !== full.characterCode)).toHaveLength(
      CONFIG.relicSlots,
    );
    const out = reduce(full, { type: 'BUY_STOCK', slot }, CONFIG);
    expect(out.state.pendingReplace?.code).toBe(full.shop!.stock[slot]!.code);
    // Not silently dropped, and not silently over the cap.
    expect(out.state.relics.filter((r) => r.code !== full.characterCode)).toHaveLength(
      CONFIG.relicSlots,
    );

    const victim = out.state.relics.find((r) => r.code !== full.characterCode)!;
    const done = reduce(out.state, { type: 'REPLACE_RELIC', instanceId: victim.instanceId }, CONFIG);
    expect(done.state.pendingReplace).toBeNull();
    expect(done.state.relics.some((r) => r.instanceId === victim.instanceId)).toBe(false);
    expect(done.state.relics.some((r) => r.code === full.shop!.stock[slot]!.code)).toBe(true);
    expect(done.state.relics.filter((r) => r.code !== full.characterCode)).toHaveLength(
      CONFIG.relicSlots,
    );
  });
});

/** N held relics that a forge can legally work on, plus optionally spent ones. */
/**
 * `exclude` keeps a planted board off a specific shelf. §6.6 concentrates a
 * shelf's three slots on the rarities the act deals in, and the registry holds
 * 18 shelf-eligible relics, so a fixed plant of five can now cover every slot
 * on offer — which leaves "buy the thing you do not hold" with nothing to buy.
 */
function plantRelics(n: number, alreadyUpgraded = false, exclude: readonly string[] = []) {
  const codes = Object.values(REGISTRY)
    .filter((d) => d.upgrade && !exclude.includes(d.code))
    .slice(alreadyUpgraded ? 12 : 0, (alreadyUpgraded ? 12 : 0) + n);
  return codes.map((d, i) => ({
    instanceId: `${d.code}#planted${alreadyUpgraded ? 'U' : ''}${i}`,
    code: d.code,
    state: {},
    acquiredAt: 1,
    upgraded: alreadyUpgraded,
  }));
}

describe('§6.6 rarity gates supply, not price', () => {
  /** Every relic code a fresh run in this act would see on a shelf. */
  function shelfCodes(actIndex: 0 | 1 | 2, seeds: number, tierUp = false): string[] {
    const out: string[] = [];
    for (let i = 0; i < seeds; i++) {
      const base = initialState(`RW${actIndex}X${i}`, 'CH.01');
      const s: GameState = {
        ...base,
        actIndex,
        counters: tierUp ? { ...base.counters, 'shop:tierUp': 1 } : base.counters,
      };
      out.push(...rollShopStock(s, `a${actIndex}-r2c0`, CONFIG).map((x) => x.code));
    }
    return out;
  }

  const share = (codes: readonly string[], rarity: string): number => {
    const relics = codes.filter((c) => !REGISTRY[c]?.isConsumable);
    return relics.filter((c) => REGISTRY[c]?.rarity === rarity).length / relics.length;
  };

  it('a RARE turns up as often as §6.6 says, not as often as it is numerous', () => {
    // The bug this replaces: no draw read `rarity`, so every relic was equally
    // likely and RARE — 7 of 27 offerable relics — filled 23% of every shelf.
    for (const actIndex of [0, 1, 2] as const) {
      const codes = shelfCodes(actIndex, 400);
      for (const rarity of ['COMMON', 'UNCOMMON', 'RARE'] as const) {
        const want = CONFIG.rarityWeights[actIndex][rarity];
        expect(
          Math.abs(share(codes, rarity) - want),
          `act ${actIndex + 1} ${rarity}: ${(share(codes, rarity) * 100).toFixed(1)}% vs ${want * 100}%`,
        ).toBeLessThan(0.06);
      }
    }
  });

  it('rares get commoner every act and commons get rarer', () => {
    const rare = ([0, 1, 2] as const).map((a) => share(shelfCodes(a, 400), 'RARE'));
    const common = ([0, 1, 2] as const).map((a) => share(shelfCodes(a, 400), 'COMMON'));
    expect(rare[0]!).toBeLessThan(rare[1]!);
    expect(rare[1]!).toBeLessThan(rare[2]!);
    expect(common[0]!).toBeGreaterThan(common[1]!);
    expect(common[1]!).toBeGreaterThan(common[2]!);
  });

  it('a boss relic is never on a shelf — §3.3 is the only way to hold one', () => {
    for (const actIndex of [0, 1, 2] as const) {
      for (const code of shelfCodes(actIndex, 300)) {
        expect(REGISTRY[code]!.rarity, `${code} leaked onto an act ${actIndex + 1} shelf`).not.toBe(
          'BOSS',
        );
      }
    }
    // And the weights say so too, so the rule survives the filter being relaxed.
    for (const act of [0, 1, 2] as const) expect(CONFIG.rarityWeights[act].BOSS).toBe(0);
  });

  it('the shelf keeps its reserved consumable slot and its relic count', () => {
    for (const actIndex of [0, 1, 2] as const) {
      const codes = shelfCodes(actIndex, 100);
      const perShelf = codes.length / 100;
      expect(perShelf).toBe(CONFIG.shopRelics + CONFIG.shopConsumables);
      const consumables = codes.filter((c) => REGISTRY[c]?.isConsumable).length;
      expect(consumables / 100).toBe(CONFIG.shopConsumables);
    }
  });

  it('a shelf is affordable — §4.2 prices it under one act of income', () => {
    // "Slightly pricey, but you can afford them." A shelf nobody can touch is
    // not a shop; one cleared out of pocket money is not a choice.
    const s = reach('SHOP')!;
    const shelf = s.shop!.stock.reduce((a, item) => a + item.price, 0);
    expect(shelf).toBeGreaterThan(CONFIG.prices.RARE);
    expect(shelf).toBeLessThan(CONFIG.rewards.word * 12);
  });

  it('§6.5 tier-up raises what RL.22 Polyglot stocks, and not what it charges', () => {
    // It used to raise only the PRICE of whatever was drawn, so a boss relic
    // bought to improve the shop charged uncommon money for a common relic.
    const plain = shelfCodes(0, 400);
    const raised = shelfCodes(0, 400, true);
    expect(share(raised, 'COMMON'), 'tier-up should promote every COMMON away').toBe(0);
    expect(share(raised, 'RARE')).toBeGreaterThan(share(plain, 'RARE'));
    // Every price is still the price of the relic actually on the shelf.
    const base = initialState('TIERPRICE', 'CH.01');
    const s: GameState = { ...base, counters: { ...base.counters, 'shop:tierUp': 1 } };
    for (const item of rollShopStock(s, 'a0-r2c0', CONFIG)) {
      expect(item.price, `${item.code} is priced off its own rarity`).toBe(
        shopPrice(item.code, CONFIG),
      );
    }
  });
});

describe('§6.7 forge', () => {
  it('grants one operation, or two holding RL.09 The Anvil', () => {
    expect(reach('FORGE')!.forge!.operationsLeft).toBe(1);
  });

  it('upgrading marks the instance, spends the operation, and cannot repeat', () => {
    let s = reach('FORGE')!;
    const target = s.forge!.candidates[0];
    if (!target) return; // Nothing eligible was drawn; covered below.
    const before = s.forge!.operationsLeft;
    s = reduce(s, { type: 'FORGE_UPGRADE', instanceId: target }, CONFIG).state;
    expect(s.relics.find((r) => r.instanceId === target)!.upgraded).toBe(true);
    expect(s.forge!.operationsLeft).toBe(before - 1);
    expect(reduce(s, { type: 'FORGE_UPGRADE', instanceId: target }, CONFIG).error?.code)
      .toBe('NO_OPERATIONS');
  });

  /*
   * R-035. The forge draws what it will work on; it does not open your bag.
   *
   * Tested against the draw rather than against a walked run: the first forge a
   * run reaches typically holds only the character innate, which has no MK.II,
   * so a walked test asserting "at most three" passes while every offer is
   * empty. Measured over 203 walked forges with relics taken, the offer is 3 in
   * 79% of visits against a mean of 7.2 eligible held — the cap is doing work.
   */
  it('offers at most three, and only relics that have an unspent MK.II', () => {
    const base = reach('FORGE')!;
    const s = { ...base, relics: [...base.relics, ...plantRelics(8), ...plantRelics(2, true)] };
    const offer = drawForgeCandidates(s, 'n-forge');
    expect(offer).toHaveLength(FORGE_CANDIDATES);
    expect(new Set(offer).size, 'no relic is offered twice').toBe(offer.length);
    for (const id of offer) {
      const held = s.relics.find((r) => r.instanceId === id);
      expect(held, 'the offer names a relic actually held').toBeDefined();
      expect(held!.upgraded, 'never one already MK.II').toBe(false);
      expect(REGISTRY[held!.code]!.upgrade, 'never one with no MK.II').toBeDefined();
    }
  });

  it('offers everything eligible when fewer than three are', () => {
    const base = reach('FORGE')!;
    const two = { ...base, relics: [...base.relics, ...plantRelics(2)] };
    expect(drawForgeCandidates(two, 'n-forge')).toHaveLength(2);
    expect(drawForgeCandidates(base, 'n-forge'), 'a run holding only its innate').toEqual([]);
  });

  it('refuses a relic it did not offer, however upgradeable it is', () => {
    const s = reach('FORGE')!;
    // The relic must be HELD and ELIGIBLE and merely absent from the offer, or
    // an older check fires first and the test proves nothing about R-035. The
    // first forge of a run typically holds only the character innate, which has
    // no MK.II, so the outsider is planted rather than hoped for.
    const upgradeable = Object.values(REGISTRY).find((d) => d.upgrade)!;
    const outsider = {
      instanceId: `${upgradeable.code}#outside`,
      code: upgradeable.code,
      state: {},
      acquiredAt: 1,
      upgraded: false,
    };
    const forced = { ...s, relics: [...s.relics, outsider] };
    expect(forced.forge!.candidates).not.toContain(outsider.instanceId);
    const err = reduce(forced, { type: 'FORGE_UPGRADE', instanceId: outsider.instanceId }, CONFIG).error;
    expect(err?.code).toBe('NOT_IN_OFFER');
  });

  it('is a function of the address: same node same offer, different node different', () => {
    const base = reach('FORGE')!;
    const s = { ...base, relics: [...base.relics, ...plantRelics(8)] };
    expect(drawForgeCandidates(s, 'n-forge')).toEqual(drawForgeCandidates(s, 'n-forge'));
    const elsewhere = ['n-a', 'n-b', 'n-c', 'n-d'].map((id) => drawForgeCandidates(s, id).join());
    expect(new Set(elsewhere).size, 'two forges in a run are not the same forge').toBeGreaterThan(1);
  });

  it('R-046 — branch B sells off the SAME ladder the shop sells from', () => {
    const s = { ...reach('FORGE')!, gold: 1000, bankroll: 5 };
    const out = reduce(s, { type: 'FORGE_REFILL' }, CONFIG);
    expect(out.error).toBeUndefined();
    expect(out.state.gold).toBe(1000 - CONFIG.economy.refillCosts[0]!);
    expect(out.state.bankroll).toBe(6);
    // The run counter is what makes it one ladder: the next rung is dearer
    // wherever it is bought. Priced separately, the cheaper venue was the only
    // one anyone used — 34.3% to 63.5% on a relic-less run.
    expect(out.state.stats.refillsBought).toBe(1);

    const broke = { ...reach('FORGE')!, gold: 10, bankroll: 5 };
    expect(reduce(broke, { type: 'FORGE_REFILL' }, CONFIG).error?.code).toBe('UNAFFORDABLE');
  });

  it('R-046 — the ladder runs out, and the forge cannot go past it', () => {
    const spent = {
      ...reach('FORGE')!,
      gold: 5000,
      bankroll: 5,
      stats: { ...reach('FORGE')!.stats, refillsBought: CONFIG.economy.refillCosts.length },
    };
    expect(reduce(spent, { type: 'FORGE_REFILL' }, CONFIG).error?.code).toBe('REFILL_EXHAUSTED');
  });

  it('an operation is spent either way, so the node is one decision', () => {
    const s = { ...reach('FORGE')!, gold: 500, bankroll: 5 };
    const after = reduce(s, { type: 'FORGE_REFILL' }, CONFIG).state;
    expect(after.forge!.operationsLeft).toBe(0);
    expect(reduce(after, { type: 'FORGE_REFILL' }, CONFIG).error?.code).toBe('NO_OPERATIONS');
  });
});

describe('§6.8 events', () => {
  it('opens a real event and records it as seen', () => {
    const s = reach('EVENT')!;
    expect(EVENTS[s.event!.code]).toBeDefined();
    expect(s.seenEvents).toContain(s.event!.code);
  });

  it('only draws events legal in this act', () => {
    const s = reach('EVENT')!;
    expect(EVENTS[s.event!.code]!.acts).toContain(s.actIndex + 1);
  });

  it('choosing an option resolves it and returns to the map', () => {
    const s = reach('EVENT')!;
    const safe = EVENTS[s.event!.code]!.options.at(-1)!;
    const out = reduce(s, { type: 'CHOOSE_EVENT_OPTION', key: safe.key }, CONFIG);
    expect(out.error).toBeUndefined();
    expect(out.state.event).toBeNull();
    expect(['MAP', 'ACT_END', 'REWARD']).toContain(out.state.phase);
    expect(out.events.some((e) => e.type === 'EVENT_RESOLVED')).toBe(true);
  });

  it('an unmet requirement is refused rather than silently ignored', () => {
    const s = { ...reach('EVENT')!, gold: 0, relics: [] };
    const def = EVENTS[s.event!.code]!;
    const gated = def.options.find((o) => o.requires);
    if (!gated) return;
    expect(reduce(s, { type: 'CHOOSE_EVENT_OPTION', key: gated.key }, CONFIG).error?.code)
      .toBe('REQUIREMENT_UNMET');
  });

  it('a bogus option key is refused', () => {
    const s = reach('EVENT')!;
    expect(reduce(s, { type: 'CHOOSE_EVENT_OPTION', key: 'ZZ' }, CONFIG).error?.code)
      .toBe('NO_SUCH_OPTION');
  });

  it('gold effects move gold, at the price the option prints', () => {
    // EV.10's READ THE WALL reveals the map. Read the price out of the event
    // rather than retyping it: it moved from 20g to 40g in the v2.0 rescale,
    // and a hardcoded literal would fail on a content edit that is not a bug.
    let s = { ...reach('EVENT')!, gold: 500 };
    s = { ...s, event: { nodeId: s.event!.nodeId, code: 'EV.10' } };
    const option = EVENTS['EV.10']!.options.find((o) => o.key === 'B')!;
    const priced = option.effect.find((x) => 'gold_delta' in x) as { gold_delta: number };
    const out = reduce(s, { type: 'CHOOSE_EVENT_OPTION', key: 'B' }, CONFIG);
    expect(out.state.gold).toBe(500 + priced.gold_delta);
    expect(out.state.map.modifiersRevealed).toBe(true);
  });
});

/**
 * A playtest screenshot showed the Act II Twins labelled THE CIPHER and running
 * the Cipher's 3-turn deferral over a two-solution word: six rows submitted, not
 * one tile of feedback. Both the boss name and the deferral were read from
 * `state.actIndex` rather than from the node, so any drift between the two
 * silently grafted one boss's mechanic onto another's word.
 */
describe('a boss is whatever the NODE says it is', () => {
  it('every node carries the act that generated it', () => {
    for (let i = 0; i < 30; i++) {
      const s = run(`STAMP${i}`);
      for (const node of Object.values(s.map.nodes)) {
        expect(node.actIndex, `${node.id} is unstamped`).toBe(s.actIndex);
      }
    }
  });

  it('deferral and Mirror never both land on one word', () => {
    // The Cipher defers and does not mirror; the Twins mirrors and does not
    // defer. Deferral over two solutions is unreadable, so nothing may produce
    // it by accident.
    for (let i = 0; i < 40; i++) {
      let s = run(`DEFER${i}`);
      for (let step = 0; step < 120; step++) {
        if (s.phase === 'DEATH' || s.phase === 'VICTORY') break;
        if (s.phase === 'WORD' && s.word) {
          const w = s.word;
          expect(
            w.deferralDepth > 0 && w.solutions.length > 1,
            `${w.nodeId}: deferral ${w.deferralDepth} over ${w.solutions.length} solutions`,
          ).toBe(false);
          const answer = w.solutions[w.solved.findIndex((v) => !v)] ?? w.solutions[0]!;
          s = reduce(s, { type: 'SUBMIT_GUESS', guess: answer }, CONFIG).state;
          continue;
        }
        if (s.phase === 'MAP') {
          s = reduce(s, { type: 'SELECT_NODE', nodeId: s.map.available[0]! }, CONFIG).state;
          continue;
        }
        if (s.phase === 'SHOP' || s.phase === 'FORGE' || s.phase === 'EVENT') {
          s = reduce(s, { type: 'LEAVE_NODE' }, CONFIG).state;
          continue;
        }
        if (s.phase === 'REWARD') {
          s = reduce(s, { type: 'SKIP_OFFER' }, CONFIG).state;
          continue;
        }
        s = reduce(s, { type: 'ADVANCE' }, CONFIG).state;
      }
    }
  });

  it('a stale actIndex can no longer mislabel a boss or borrow its deferral', () => {
    // Reproduce the drift directly: act 1's map, act 0's counter.
    let s = run('DRIFT');
    for (let step = 0; step < 60 && s.actIndex === 0; step++) {
      if (s.phase === 'WORD' && s.word) {
        const w = s.word;
        s = reduce(s, { type: 'SUBMIT_GUESS', guess: w.solutions[0]! }, CONFIG).state;
      } else if (s.phase === 'MAP') {
        s = reduce(s, { type: 'SELECT_NODE', nodeId: s.map.available[0]! }, CONFIG).state;
      } else if (s.phase === 'SHOP' || s.phase === 'FORGE' || s.phase === 'EVENT') {
        s = reduce(s, { type: 'LEAVE_NODE' }, CONFIG).state;
      } else if (s.phase === 'REWARD') {
        s = reduce(s, { type: 'SKIP_OFFER' }, CONFIG).state;
      } else {
        s = reduce(s, { type: 'ADVANCE' }, CONFIG).state;
      }
    }
    expect(s.actIndex, 'the walk should have reached act 2').toBe(1);

    const bossId = s.map.bossId;
    const drifted = {
      ...s,
      actIndex: 0 as const,
      phase: 'MAP' as const,
      word: null,
      map: { ...s.map, currentId: null, available: [bossId] },
    };
    const entered = reduce(drifted, { type: 'SELECT_NODE', nodeId: bossId }, CONFIG).state;
    // Standing on the Act II boss with the counter claiming Act I. The Cipher
    // defers and does not mirror, whatever the counter says — the drift the
    // screenshot caught was exactly this, in the other direction.
    expect(entered.word!.deferralDepth).toBe(CONFIG.cipherDeferralDepth);
    expect(entered.word!.solutions.length).toBe(1);
  });
});

/**
 * §6.8's effect vocabulary, end to end.
 *
 * Five of its verbs used to be recorded as `unapplied:<verb>` counters and do
 * nothing — which meant eight of the thirteen events had an option that read
 * like a decision and was not one. These fire them through `reduce` rather than
 * asserting on the translation, because the translation was never the part that
 * was wrong.
 */
describe('§6.8 the effect vocabulary actually fires', () => {
  /** Stand a run in an EVENT node with a chosen event and unlimited gold. */
  function atEvent(code: string, over: Partial<GameState> = {}): GameState {
    const s = reach('EVENT')!;
    return { ...s, gold: 2000, event: { nodeId: s.event!.nodeId, code }, ...over };
  }

  it('every verb in the vocabulary reaches an implementation', () => {
    // The catch-all records an unknown verb as `unapplied:<verb>`. Nothing in
    // the shipped content may land there — a verb that does nothing is an
    // option that reads like a decision and is not one.
    let s = reach('EVENT')!;
    s = { ...s, gold: 2000, bankroll: 20 };
    for (const def of EVENT_DEFS) {
      for (const option of def.options) {
        const at = { ...s, event: { nodeId: s.event!.nodeId, code: def.code } };
        if (!optionAvailable(at, option.requires)) continue;
        const out = reduce(at, { type: 'CHOOSE_EVENT_OPTION', key: option.key }, CONFIG);
        const dropped = Object.keys(out.state.counters).filter((k) => k.startsWith('unapplied:'));
        expect(dropped, `${def.code}/${option.key}`).toEqual([]);
      }
    }
  });

  it('EV.13 THE SIXTH SHELF really is a sixth shelf', () => {
    const s = atEvent('EV.13', { bankroll: 20 });
    const out = reduce(s, { type: 'CHOOSE_EVENT_OPTION', key: 'A' }, CONFIG).state;
    expect(relicSlots(out, CONFIG)).toBe(CONFIG.relicSlots + 1);
    expect(out.bankroll).toBe(16);

    // And the cap it raises is the one GRANT_RELIC enforces, or the 4 bankroll
    // bought nothing. The incoming code has to be one the five do not already
    // hold, or the grant no-ops for an unrelated reason and the test passes on
    // the wrong thing.
    const planted = plantRelics(CONFIG.relicSlots);
    const five = { ...out, relics: [...out.relics, ...planted] };
    const incoming = Object.values(REGISTRY).find(
      (d) => !d.isConsumable && !five.relics.some((r) => r.code === d.code),
    )!;
    const granted = applyEffects(five, [{ kind: 'GRANT_RELIC', code: incoming.code }], CONFIG).state;
    expect(granted.pendingReplace, 'the sixth slot was not honoured').toBeNull();
    expect(heldRelics(granted)).toHaveLength(CONFIG.relicSlots + 1);

    // Without the shelf, the same grant stops at five and asks.
    const noShelf = { ...five, bonusRelicSlots: 0 };
    const capped = applyEffects(noShelf, [{ kind: 'GRANT_RELIC', code: incoming.code }], CONFIG).state;
    expect(capped.pendingReplace?.code).toBe(incoming.code);
  });

  it('EV.08 THE UNDERTAKER arms a revival that the engine can find', () => {
    // It charged 160g and armed nothing: events.json calls the flag
    // `undertaker_revival` and the reducer looked for two other names.
    const s = atEvent('EV.08');
    const out = reduce(s, { type: 'CHOOSE_EVENT_OPTION', key: 'A' }, CONFIG).state;
    expect(out.revivalBankroll).toBe(6);
    expect(out.gold).toBe(2000 - 160);
  });

  it('EV.09 forces LIAR LETTER onto every word left in the act, and no further', () => {
    const s = atEvent('EV.09');
    let out = reduce(s, { type: 'CHOOSE_EVENT_OPTION', key: 'A' }, CONFIG).state;
    expect(out.actEffects.forcedModifiers.map((f) => f.id)).toEqual(['LIAR_LETTER']);
    // A boss relic came with it, so the run is standing at the offer.
    expect(out.pendingOffer?.codes.length).toBe(1);
    out = reduce(out, { type: 'SKIP_OFFER' }, CONFIG).state;

    const word = walkToWord(out);
    expect(word.word!.modifiers).toContain('LIAR_LETTER');
    expect(word.word!.liarIndex).not.toBeNull();

    // §6.8 — it dies with the act.
    const nextAct = { ...word, actEffects: { ...word.actEffects } };
    expect(startNextAct(nextAct).actEffects.forcedModifiers).toEqual([]);
  });

  it('EV.11 forces LOCKED KEY for exactly three words, then stops', () => {
    const s = atEvent('EV.11');
    let out = reduce(s, { type: 'CHOOSE_EVENT_OPTION', key: 'B' }, CONFIG).state;
    expect(out.actEffects.forcedModifiers[0]).toMatchObject({ id: 'LOCKED_KEY', words: 3 });
    // Three consumables came with it; §6.2 caps them at 2, so the third is
    // dropped rather than overflowing.
    expect(out.consumables.length).toBeLessThanOrEqual(CONFIG.consumableSlots);

    const seen: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      out = walkToWord(out);
      seen.push(out.word!.modifiers.includes('LOCKED_KEY'));
      out = solveCurrentWord(out);
    }
    expect(seen.slice(0, 3), 'the first three words').toEqual([true, true, true]);
  });

  it('EV.12 B clears every modifier for the rest of the act', () => {
    const s = atEvent('EV.12');
    let out = reduce(s, { type: 'CHOOSE_EVENT_OPTION', key: 'B' }, CONFIG).state;
    expect(out.actEffects.modifiersSuppressed).toBe(true);
    expect(out.gold).toBe(2000 - 120);
    out = walkToWord(out);
    expect(out.word!.modifiers).toEqual([]);
  });

  it('EV.12 A rerolls the act, and can make it worse', () => {
    // "IT MAY GET WORSE" is the stake, so the reroll has to be able to. A
    // reroll that only ever removed modifiers would be a free Compositor.
    // Sampled across ROLLS, not across one state forty times. The reroll is
    // addressed off `modifierRerolls`, so varying that is what varies the draw
    // — an earlier version of this loop rebuilt the same state each pass and
    // got the same answer forty times, which passed "it changes something" and
    // could never have caught "it only ever helps".
    const base = atEvent('EV.12', {});
    const before = unvisitedModifierCount(base);
    let changed = 0;
    let worse = 0;
    for (let roll = 0; roll < 40; roll++) {
      const seeded = { ...base, counters: { ...base.counters, modifierRerolls: roll } };
      const after = unvisitedModifierCount(
        reduce(seeded, { type: 'CHOOSE_EVENT_OPTION', key: 'A' }, CONFIG).state,
      );
      if (after !== before) changed++;
      if (after > before) worse++;
    }
    expect(changed, 'the reroll never changed anything').toBeGreaterThan(0);
    expect(worse, 'the reroll can only ever help — "IT MAY GET WORSE" is a lie').toBeGreaterThan(0);
  });

  it('EV.02 B grants a rare outright; EV.04 A offers two to keep one', () => {
    const unseen = reduce(atEvent('EV.02'), { type: 'CHOOSE_EVENT_OPTION', key: 'B' }, CONFIG).state;
    const taken = heldRelics(unseen);
    expect(taken).toHaveLength(1);
    expect(REGISTRY[taken[0]!.code]!.rarity).toBe('RARE');
    expect(unseen.pendingOffer, 'granted outright, not offered').toBeNull();

    const s = atEvent('EV.04', { relics: [...atEvent('EV.04').relics, ...plantRelics(1)] });
    const offered = reduce(s, { type: 'CHOOSE_EVENT_OPTION', key: 'A' }, CONFIG).state;
    expect(offered.pendingOffer?.codes).toHaveLength(2);
    for (const code of offered.pendingOffer!.codes) {
      expect(REGISTRY[code]!.rarity).toBe('RARE');
    }
  });

  it('EV.01 B shows the first letter of every remaining word this act', () => {
    const s = atEvent('EV.01');
    let out = reduce(s, { type: 'CHOOSE_EVENT_OPTION', key: 'B' }, CONFIG).state;
    expect(out.actEffects.firstLettersRevealed).toBe(true);
    for (let i = 0; i < 2; i++) {
      out = walkToWord(out);
      const first = out.word!.presetTiles.find((p) => p.index === 0);
      expect(first?.letter, `word ${i + 1}`).toBe(out.word!.solutions[0]![0]);
      out = solveCurrentWord(out);
    }
  });
});

/** Walk forward until a WORD is in progress. Throws rather than looping. */
function walkToWord(start: GameState): GameState {
  let s = start;
  for (let i = 0; i < 30; i++) {
    if (s.phase === 'WORD' && s.word) return s;
    if (s.phase === 'MAP') {
      s = reduce(s, { type: 'SELECT_NODE', nodeId: s.map.available[0]! }, CONFIG).state;
      continue;
    }
    if (s.phase === 'SHOP' || s.phase === 'FORGE' || s.phase === 'EVENT') {
      s = reduce(s, { type: 'LEAVE_NODE' }, CONFIG).state;
      continue;
    }
    if (s.phase === 'REWARD' || s.phase === 'REPLACE') {
      s = reduce(s, { type: 'SKIP_OFFER' }, CONFIG).state;
      continue;
    }
    break;
  }
  throw new Error(`walkToWord: stuck in ${s.phase}`);
}

function solveCurrentWord(s: GameState): GameState {
  let next = s;
  for (const solution of s.word!.solutions) {
    next = reduce(next, { type: 'SUBMIT_GUESS', guess: solution }, CONFIG).state;
  }
  return next;
}

/** Modifiers still ahead of the player in this act. */
function unvisitedModifierCount(s: GameState): number {
  return Object.values(s.map.nodes)
    .filter((n) => !n.visited && (n.kind === 'WORD' || n.kind === 'ELITE'))
    .reduce((n, node) => n + node.modifiers.length, 0);
}

/** Clear the act's effects the way `startAct` does, without a whole act. */
function startNextAct(s: GameState): GameState {
  return reduce({ ...s, word: null, phase: 'MAP', map: { ...s.map, currentId: s.map.bossId, available: [] } }, { type: 'ADVANCE' }, CONFIG).state;
}
