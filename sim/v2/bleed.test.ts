import { describe, expect, it } from 'vitest';
import { SPEC, tableAfter } from '../../test/spec';
import { ECONOMY } from '../../lib/engine/economy/config';
import { DEFAULT_BLEED, playBleed, runStructure } from './bleed';

/**
 * The model's SHAPE, not its numbers. A balance model that quietly disagrees
 * with the spec about how many words a run has, or how often a boss pays,
 * produces confident nonsense — this one paid a boss's 120g and +4 bankroll
 * once per boss WORD rather than once per boss, inventing 20 bankroll and 600
 * gold a run, and the first read said the economy did not bite at all.
 */
describe('the v2.0 run structure matches §3.2 and §4', () => {
  const slots = runStructure(false);

  it('§3.2 — twenty words: 12 solve nodes plus bosses of 2, 1 and 5', () => {
    expect(SPEC).toContain('a complete run is **20 words**');
    expect(slots).toHaveLength(20);
    expect(slots.filter((s) => s.kind !== 'BOSS')).toHaveLength(12);
    for (const act of [0, 1, 2] as const) {
      expect(slots.filter((s) => s.act === act && s.kind !== 'BOSS')).toHaveLength(4);
    }
    expect(slots.filter((s) => s.kind === 'BOSS' && s.act === 0)).toHaveLength(2);
    expect(slots.filter((s) => s.kind === 'BOSS' && s.act === 1)).toHaveLength(1);
    expect(slots.filter((s) => s.kind === 'BOSS' && s.act === 2)).toHaveLength(5);
  });

  it('§4 — a shop after every solve node, twelve of them, none after a boss', () => {
    expect(SPEC).toContain('Twelve shops per run.');
    expect(slots.filter((s) => s.shopAfter)).toHaveLength(12);
    expect(slots.filter((s) => s.kind === 'BOSS' && s.shopAfter)).toHaveLength(0);
  });

  it('§3.3 — a boss pays once for CLEARING it, not once per word', () => {
    const paying = slots.filter((s) => s.kind === 'BOSS' && s.paysReward);
    expect(paying).toHaveLength(3);
    // Always the last word of the boss.
    for (const p of paying) {
      const idx = slots.indexOf(p);
      expect(slots[idx + 1]?.kind === 'BOSS' && slots[idx + 1]?.act === p.act).toBeFalsy();
    }
  });

  it('§3.1 — elites are capped at 1 / 2 / 3 by act', () => {
    const rows = tableAfter('| Node | Weight |');
    expect(rows.map((r) => r[0])).toEqual(['Word', 'Elite', 'Forge', 'Event']);
    for (const act of [0, 1, 2] as const) {
      const elites = slots.filter((s) => s.act === act && s.kind === 'ELITE');
      expect(elites.length).toBeLessThanOrEqual(act + 1);
    }
  });
});

describe('the model plays the economy it says it does', () => {
  it('is deterministic in the seed', () => {
    const a = playBleed('SEED0001', { ...DEFAULT_BLEED, start: 12 });
    const b = playBleed('SEED0001', { ...DEFAULT_BLEED, start: 12 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('never exceeds the §2.1 cap', () => {
    for (let i = 0; i < 40; i++) {
      const r = playBleed(`CAP${i}`, { ...DEFAULT_BLEED, start: 12 });
      for (const b of r.bankrollByWord) expect(b).toBeLessThanOrEqual(ECONOMY.bankrollCap);
    }
  });

  it('never buys more emergency rungs than §2.4 has', () => {
    for (let i = 0; i < 40; i++) {
      const r = playBleed(`RUNG${i}`, { ...DEFAULT_BLEED, start: 12, buyRefills: false });
      expect(r.emergenciesBought).toBeLessThanOrEqual(ECONOMY.emergencyCosts.length);
    }
  });

  it('buys at most three refills per shop across twelve shops', () => {
    for (let i = 0; i < 40; i++) {
      const r = playBleed(`REFILL${i}`, { ...DEFAULT_BLEED, start: 12 });
      expect(r.refillsBought).toBeLessThanOrEqual(3 * 12);
    }
  });

  it('a run that survives played all twenty words', () => {
    for (let i = 0; i < 40; i++) {
      const r = playBleed(`FULL${i}`, { ...DEFAULT_BLEED, start: 12 });
      if (r.survived) expect(r.bankrollByWord).toHaveLength(20);
    }
  });
});
