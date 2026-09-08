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

  // One pass over a handful of seeds rather than five separate 40-run loops.
  // Every run here solves twenty words with the real entropy solver, so this
  // suite is the slowest thing in the repo by an order of magnitude and the
  // invariants are all cheap to check together. Ten seeds catch a broken bound;
  // two hundred only cost CI four minutes.
  it('respects every §2 and §4 bound it is modelling', () => {
    for (let i = 0; i < 10; i++) {
      for (const buyRefills of [true, false]) {
        const r = playBleed(`BOUND${i}`, { ...DEFAULT_BLEED, start: 12, buyRefills });
        for (const b of r.bankrollByWord) {
          expect(b, '§2.1 cap').toBeLessThanOrEqual(ECONOMY.bankrollCap);
          expect(b, 'bankroll never negative').toBeGreaterThanOrEqual(0);
        }
        expect(r.emergenciesBought, '§2.4 rungs').toBeLessThanOrEqual(
          ECONOMY.emergencyCosts.length,
        );
        // Per shop, not just the total: the total stays under 36 on its own
        // because the §2.1 cap and running out of gold both bite first, so it
        // cannot see a broken per-shop limit at all.
        expect(r.refillsByShop.length, '§4 twelve shops').toBeLessThanOrEqual(12);
        for (const n of r.refillsByShop) {
          expect(n, '§4.1 per-shop cap').toBeLessThanOrEqual(ECONOMY.refillsPerShop);
        }
        expect(r.refillsBought, '§4.1 run cap is the ladder length').toBeLessThanOrEqual(
          ECONOMY.refillCosts.length,
        );
        if (!buyRefills) {
          expect(r.refillsBought).toBe(0);
          expect(r.refillsByShop.every((n) => n === 0)).toBe(true);
        }
        // A run either played all twenty words or stopped at the one it died on.
        expect(r.bankrollByWord.length).toBe(r.survived ? 20 : r.diedAtWord + 1);
        expect(r.guessesByWord.length).toBe(r.survived ? 20 : r.diedAtWord + 1);
      }
    }
  });
});
