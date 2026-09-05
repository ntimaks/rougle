import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { DOMAIN, draw, drawInt, drawPick, drawShuffle, drawWeighted, formatSeed, hash32, isValidSeed } from './rng';

describe('draw', () => {
  it('is a pure function of its address', () => {
    expect(draw('SEED1234', 'word:n1', 0)).toBe(draw('SEED1234', 'word:n1', 0));
    expect(draw('SEED1234', 'word:n1', 0)).not.toBe(draw('SEED1234', 'word:n1', 1));
    expect(draw('SEED1234', 'word:n1', 0)).not.toBe(draw('SEED1234', 'word:n2', 0));
    expect(draw('SEED1234', 'word:n1', 0)).not.toBe(draw('SEED9999', 'word:n1', 0));
  });

  it('returns floats in [0, 1)', () => {
    for (let i = 0; i < 5000; i++) {
      const v = draw('SEED1234', 'uniform', i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is roughly uniform', () => {
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 100_000; i++) buckets[Math.floor(draw('SEED1234', 'uniform', i) * 10)]++;
    for (const b of buckets) expect(Math.abs(b - 10_000)).toBeLessThan(600);
  });

  /**
   * The property that matters: a roll added to one subsystem must not shift
   * another. With addresses rather than a cursor this is true by construction —
   * assert it anyway, because a future "optimisation" to a stateful generator
   * would silently invalidate every shared seed.
   */
  it('does not shift other subsystems when one draws more', () => {
    const mapRolls = [0, 1, 2].map((i) => draw('SEED1234', DOMAIN.map(0), i));
    for (let extra = 0; extra < 50; extra++) draw('SEED1234', DOMAIN.offer('n3'), extra);
    expect([0, 1, 2].map((i) => draw('SEED1234', DOMAIN.map(0), i))).toEqual(mapRolls);
  });

  it('returns the same value across processes', () => {
    const local = draw('SEED1234', 'cross-process', 7);
    const remote = execFileSync(
      'npx',
      [
        'tsx',
        '-e',
        "import { draw } from './lib/engine/core/rng'; process.stdout.write(String(draw('SEED1234','cross-process',7)));",
      ],
      { encoding: 'utf8', cwd: process.cwd() },
    );
    expect(Number(remote)).toBe(local);
  });
});

describe('helpers', () => {
  it('drawInt stays in range', () => {
    for (let i = 0; i < 1000; i++) {
      const v = drawInt('S', 'd', i, 7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
    expect(() => drawInt('S', 'd', 0, 0)).toThrow();
  });

  it('drawPick refuses an empty array', () => {
    expect(() => drawPick('S', 'd', 0, [])).toThrow(/empty/);
    expect(['a', 'b']).toContain(drawPick('S', 'd', 0, ['a', 'b']));
  });

  it('drawWeighted respects the weights', () => {
    let heads = 0;
    for (let i = 0; i < 20_000; i++) {
      if (drawWeighted('S', 'coin', i, ['H', 'T'], [0.8, 0.2]) === 'H') heads++;
    }
    expect(heads / 20_000).toBeGreaterThan(0.78);
    expect(heads / 20_000).toBeLessThan(0.82);
    expect(() => drawWeighted('S', 'd', 0, ['a'], [0])).toThrow();
  });

  it('drawShuffle is a permutation and is deterministic', () => {
    const items = [1, 2, 3, 4, 5, 6];
    const a = drawShuffle('S', 'shuffle', 0, items);
    expect(a.slice().sort()).toEqual(items);
    expect(drawShuffle('S', 'shuffle', 0, items)).toEqual(a);
    expect(drawShuffle('S', 'shuffle', 100, items)).not.toEqual(a);
  });
});

describe('seeds', () => {
  it('renders 8 base32 characters with no 0/O/1/I', () => {
    for (let i = 0; i < 2000; i++) {
      const seed = formatSeed(hash32(`entropy:${i}`));
      expect(seed).toHaveLength(8);
      expect(seed).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
      expect(isValidSeed(seed)).toBe(true);
    }
  });

  it('rejects malformed seeds', () => {
    expect(isValidSeed('SHORT')).toBe(false);
    expect(isValidSeed('OOOOOOOO')).toBe(false);
  });
});

describe('DOMAIN', () => {
  it('renders the strings from technical brief §2.5 verbatim', () => {
    expect(DOMAIN.map(2)).toBe('map:2');
    expect(DOMAIN.word('a1-2')).toBe('word:a1-2');
    expect(DOMAIN.modifier('a1-2')).toBe('modifier:a1-2');
    expect(DOMAIN.offer('a1-2')).toBe('offer:a1-2');
    expect(DOMAIN.shop('a1-2')).toBe('shop:a1-2');
    expect(DOMAIN.liar('a1-2')).toBe('liar:a1-2');
    expect(DOMAIN.truth('a1-2')).toBe('truth:a1-2');
    expect(DOMAIN.moth('a1-2')).toBe('moth:a1-2');
    expect(DOMAIN.relic('i7', 'onWordSolved')).toBe('relic:i7:onWordSolved');
  });
});
