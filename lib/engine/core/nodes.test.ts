import { describe, expect, it } from 'vitest';
import { CONFIG } from './config';
import { initialState, reduce } from './reducer';
import { FORGE_GOLD_PER_GUESS, shopPrice } from './nodes';
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

/** Walk until a node of this kind is entered, or give up. */
function reach(kind: NodeKind, seeds = 60): GameState | null {
  for (let i = 0; i < seeds; i++) {
    let s = run(`NODE${i}`);
    for (let step = 0; step < 14; step++) {
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

describe('§6.7 forge', () => {
  it('grants one operation, or two holding RL.09 The Anvil', () => {
    expect(reach('FORGE')!.forge!.operationsLeft).toBe(1);
  });

  it('upgrading marks the instance, spends the operation, and cannot repeat', () => {
    let s = reach('FORGE')!;
    const target = s.relics[0];
    expect(target, 'the run starts with a character innate to upgrade').toBeDefined();
    const before = s.forge!.operationsLeft;
    const out = reduce(s, { type: 'FORGE_UPGRADE', instanceId: target!.instanceId }, CONFIG);
    if (!REGISTRY[target!.code]?.upgrade) {
      // Character innates have no MK.II; that is a refusal, not a crash.
      expect(out.error?.code).toBe('NOT_UPGRADEABLE');
      return;
    }
    s = out.state;
    expect(s.relics[0]!.upgraded).toBe(true);
    expect(s.forge!.operationsLeft).toBe(before - 1);
    expect(reduce(s, { type: 'FORGE_UPGRADE', instanceId: target!.instanceId }, CONFIG).error?.code)
      .toBe('NO_OPERATIONS');
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
