import { describe, expect, it } from 'vitest';
import { CONFIG } from './config';
import { initialState, reduce } from './reducer';
import { FORGE_CANDIDATES, FORGE_GOLD_PER_GUESS, drawForgeCandidates, shopPrice } from './nodes';
import { EVENTS } from '../content/events';
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
 * Walk until a node of this kind is entered, or give up.
 *
 * `prefix` exists so a test can ask for a DIFFERENT forge rather than the same
 * one sixty times — R-035's draw is a function of seed and node, so sampling it
 * means varying the seed.
 */
function reach(kind: NodeKind, seeds = 60, prefix = 'NODE'): GameState | null {
  for (let i = 0; i < seeds; i++) {
    let s = run(`${prefix}${i}`);
    for (let step = 0; step < 40; step++) {
      if (s.phase === 'MAP') {
        const target =
          s.map.available.find((id: NodeId) => s.map.nodes[id]!.kind === kind) ??
          s.map.available[0];
        if (!target) break;
        s = reduce(s, { type: 'SELECT_NODE', nodeId: target }, CONFIG).state;
        if (s.map.nodes[s.map.currentId!]!.kind === kind) return s;
        continue;
      }
      if (s.phase === 'SHOP' || s.phase === 'FORGE' || s.phase === 'EVENT') {
        s = reduce(s, { type: 'LEAVE_NODE' }, CONFIG).state;
        continue;
      }
      // Row 1 is never a service row since playtest (0 gold at a shop is a dead
      // first move), so reaching one means playing through the words first.
      if (s.phase === 'WORD' && s.word) {
        const w = s.word;
        const answer = w.solutions[w.solved.findIndex((v) => !v)] ?? w.solutions[0]!;
        s = reduce(s, { type: 'SUBMIT_GUESS', guess: answer }, CONFIG).state;
        continue;
      }
      if (s.phase === 'REWARD') {
        s = reduce(s, { type: 'SKIP_OFFER' }, CONFIG).state;
        continue;
      }
      break;
    }
  }
  return null;
}

describe('every node kind dispatches and returns', () => {
  for (const kind of ['SHOP', 'FORGE', 'EVENT'] as const) {
    it(`${kind} opens its phase and LEAVE_NODE goes back to the map`, () => {
      const s = reach(kind);
      expect(s, `no ${kind} reachable in 60 seeds`).not.toBeNull();
      expect(s!.phase).toBe(kind);
      const left = reduce(s!, { type: 'LEAVE_NODE' }, CONFIG).state;
      expect(['MAP', 'ACT_END']).toContain(left.phase);
      expect(left.shop).toBeNull();
      expect(left.forge).toBeNull();
      expect(left.event).toBeNull();
    });
  }

  it('a service node never starts a word', () => {
    for (const kind of ['SHOP', 'FORGE', 'EVENT'] as const) {
      const s = reach(kind);
      expect(s!.word, `${kind} started a word`).toBeNull();
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

  it('price is stable across reads — it is addressed, not rolled per render', () => {
    const a = shopPrice('RL.01', 'PRICESEED', 'a0-r1c0', 0);
    const b = shopPrice('RL.01', 'PRICESEED', 'a0-r1c0', 0);
    expect(a).toBe(b);
  });

  it('rarity moves the price, and the design anchors are inside the band', () => {
    // Lexicon COMMON sits near 55g, a RARE near 150g, per the prototype shelf.
    const common = shopPrice('RL.01', 'BAND', 'a0-r1c0', 0);
    const rare = shopPrice('RL.04', 'BAND', 'a0-r1c0', 0);
    expect(common).toBeLessThan(rare);
    expect(common).toBeGreaterThanOrEqual(44);
    expect(common).toBeLessThanOrEqual(66);
    expect(rare).toBeGreaterThanOrEqual(120);
    expect(rare).toBeLessThanOrEqual(180);
  });
});

/** N held relics that a forge can legally work on, plus optionally spent ones. */
function plantRelics(n: number, alreadyUpgraded = false) {
  const codes = Object.values(REGISTRY)
    .filter((d) => d.upgrade)
    .slice(alreadyUpgraded ? 12 : 0, (alreadyUpgraded ? 12 : 0) + n);
  return codes.map((d, i) => ({
    instanceId: `${d.code}#planted${alreadyUpgraded ? 'U' : ''}${i}`,
    code: d.code,
    state: {},
    acquiredAt: 1,
    upgraded: alreadyUpgraded,
  }));
}

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

  it('converts gold to guesses at the §6.7 rate, and refuses what it cannot afford', () => {
    const s = { ...reach('FORGE')!, gold: 100 };
    const out = reduce(s, { type: 'FORGE_CONVERT', guesses: 3 }, CONFIG);
    expect(out.error).toBeUndefined();
    expect(out.state.gold).toBe(100 - 3 * FORGE_GOLD_PER_GUESS);
    expect(out.state.pool).toBe(s.pool + 3);

    const broke = { ...reach('FORGE')!, gold: 10 };
    expect(reduce(broke, { type: 'FORGE_CONVERT', guesses: 3 }, CONFIG).error?.code).toBe('UNAFFORDABLE');
  });

  it('an operation is spent either way, so the node is one decision', () => {
    const s = { ...reach('FORGE')!, gold: 500 };
    const after = reduce(s, { type: 'FORGE_CONVERT', guesses: 1 }, CONFIG).state;
    expect(after.forge!.operationsLeft).toBe(0);
    expect(reduce(after, { type: 'FORGE_CONVERT', guesses: 1 }, CONFIG).error?.code).toBe('NO_OPERATIONS');
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

  it('gold effects move gold', () => {
    // EV.10's READ THE WALL costs 20g and reveals the map — a clean check that
    // the vocabulary reaches the same GOLD effect a relic would use.
    let s = { ...reach('EVENT')!, gold: 500 };
    s = { ...s, event: { nodeId: s.event!.nodeId, code: 'EV.10' } };
    const out = reduce(s, { type: 'CHOOSE_EVENT_OPTION', key: 'B' }, CONFIG);
    expect(out.state.gold).toBe(480);
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
    // The Twins mirrors and does not defer, whatever the counter claims.
    expect(entered.word!.solutions.length).toBe(2);
    expect(entered.word!.deferralDepth).toBe(0);
  });
});
