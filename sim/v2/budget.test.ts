import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SPEC, num, tableAfter } from '../../test/spec';
import {
  BUDGET,
  CEILING,
  REFERENCE_GUESSES,
  UNMEASURED,
  meanNet,
  valuations,
  type Rarity,
} from './budget';

const REGISTRY = JSON.parse(
  readFileSync(resolve(__dirname, '../../docs/v2/relics.json'), 'utf8'),
) as {
  relics: Array<{ code: string; name: string; rarity: string; value_note?: string }>;
  characters: Array<{ code: string; payout_bonus?: { amount: number } }>;
};

// The measured distribution, fixed in `budget.ts`. A flat one will not do:
// every relic here is gated on a guess-count threshold.

describe('§6.4 — the value budget matches the spec', () => {
  it('the allowance table', () => {
    const rows = tableAfter('| Rarity | Bankroll per word |');
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      const rarity = row[0]!.replace(/`/g, '') as Rarity;
      expect(BUDGET[rarity], rarity).toBe(num(row[1]!));
    }
  });

  it('the ceiling is half the bleed, and the bleed is §2.3 at its own baseline', () => {
    expect(SPEC).toContain('no single relic may exceed half the bleed');
    expect(BUDGET.bleed).toBe(1.8);
    expect(CEILING).toBeCloseTo(0.9, 10);
    // Consistency: the boss allowance must be reachable under the ceiling, or
    // no boss relic could ever be worth its own tier.
    expect(BUDGET.BOSS).toBeLessThanOrEqual(CEILING);
  });
});

describe('§6.5 — the retuned registry fits the budget', () => {
  const measurable = valuations();

  it('every valued relic states its worth in the registry', () => {
    const codes = new Set(
      measurable.map((v) => v.code.replace('+', '')).filter((c) => c.startsWith('RL.')),
    );
    for (const code of codes) {
      const relic = REGISTRY.relics.find((r) => r.code === code);
      expect(relic, code).toBeDefined();
      expect(relic!.value_note, `${code} needs a value_note`).toMatch(/bankroll\/word/);
    }
  });

  it('no relic that moves bankroll or payout is left above the ceiling', () => {
    // Measured on the real guess distribution by `sim/v2/budget.ts`; this pins
    // the ones that are pure arithmetic over a fixed distribution, so a rule
    // change in the registry that doubles a payout fails here rather than in a
    // sweep three snapshots later.
    const over = valuations().filter((v) => v.overCeiling);
    expect(over.map((v) => `${v.code} ${v.value.toFixed(2)}`)).toEqual([]);
  });

  it('CH.02 The Gambler sits under the boss allowance, not over it', () => {
    const gambler = REGISTRY.characters.find((c) => c.code === 'CH.02')!;
    expect(gambler.payout_bonus?.amount).toBe(2);
  });

  it('names the relics it cannot value rather than omitting them', () => {
    expect(UNMEASURED.length).toBeGreaterThan(10);
    for (const u of UNMEASURED) {
      expect(REGISTRY.relics.some((r) => r.code === u.code), u.code).toBe(true);
      expect(u.why.length).toBeGreaterThan(5);
    }
  });
});

describe('the reference distribution', () => {
  it('matches the measured mean, so a valuation means something', () => {
    const mean =
      REFERENCE_GUESSES.reduce((a, b) => a + b, 0) / REFERENCE_GUESSES.length;
    expect(mean).toBeGreaterThan(3.7);
    expect(mean).toBeLessThan(3.9);
    // 43.3% of words fall in three or fewer — the number every payout relic
    // in the registry is gated on.
    const fast = REFERENCE_GUESSES.filter((g) => g <= 3).length / REFERENCE_GUESSES.length;
    expect(fast).toBeCloseTo(0.433, 2);
  });
});

describe('the bleed the budget is stated against', () => {
  it('§2.3 at 3.9 guesses is −1.8, which is where 1.8 comes from', () => {
    // basePayout(5, 3.9) is not playable, but the arithmetic is the claim.
    expect(6 - 2 * 3.9).toBeCloseTo(-BUDGET.bleed, 10);
  });

  it('meanNet reports the same shape on a flat distribution', () => {
    expect(meanNet(Array.from({ length: 10 }, () => 3))).toBe(0);
    expect(meanNet(Array.from({ length: 10 }, () => 4))).toBe(-2);
  });
});
