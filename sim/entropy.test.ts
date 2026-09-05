import { describe, expect, it } from 'vitest';
import { draw, scoreStates, type TileState } from '../lib/engine';
import { EntropyScratch, encode, encodeOne, entropyOf, pattern } from './entropy';
import { expectedInformation } from './solver';
import '../lib/engine/words/all';

/**
 * The fast scorer replaces the reference ONLY inside the entropy search, so it
 * gets the same differential treatment the port itself did: same fuzzing
 * regime, reduced alphabet to force duplicate collisions, zero mismatches.
 */

const RANK: Record<TileState, number> = { GREY: 0, YELLOW: 1, GREEN: 2, UNKNOWN: 0, HIDDEN: 0 };

function referencePattern(guess: string, solution: string): number {
  return scoreStates(guess, solution).reduce((acc, s, i) => acc + RANK[s] * 3 ** i, 0);
}

describe('fast pattern scorer', () => {
  const scratch = new EntropyScratch();

  it('matches the reference over 200k reduced-alphabet cases', () => {
    const alphabet = 'ABCDE';
    for (let n = 0; n < 200_000; n++) {
      const len = 4 + (n % 4);
      let guess = '';
      let solution = '';
      for (let i = 0; i < len; i++) {
        guess += alphabet[Math.floor(draw('FAST', `g:${n}`, i) * alphabet.length)];
        solution += alphabet[Math.floor(draw('FAST', `s:${n}`, i) * alphabet.length)];
      }
      const mine = pattern(
        encodeOne(guess),
        encodeOne(solution),
        0,
        len,
        scratch.counts,
        scratch.green,
      );
      if (mine !== referencePattern(guess, solution)) {
        throw new Error(`mismatch on ${guess} / ${solution}`);
      }
    }
  });

  it('matches the reference over 20k full-alphabet cases', () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let n = 0; n < 20_000; n++) {
      const len = 5 + (n % 3);
      let guess = '';
      let solution = '';
      for (let i = 0; i < len; i++) {
        guess += alphabet[Math.floor(draw('FAST26', `g:${n}`, i) * alphabet.length)];
        solution += alphabet[Math.floor(draw('FAST26', `s:${n}`, i) * alphabet.length)];
      }
      expect(
        pattern(encodeOne(guess), encodeOne(solution), 0, len, scratch.counts, scratch.green),
      ).toBe(referencePattern(guess, solution));
    }
  });
});

describe('entropy', () => {
  const scratch = new EntropyScratch();

  it('is zero when every candidate lands in one bucket', () => {
    expect(entropyOf(encodeOne('AAAAA'), encode(['AAAAA'], 5), scratch)).toBe(0);
  });

  it('is log2(n) when a guess separates every candidate into its own bucket', () => {
    // AEIOU scores differently against each of these, so the partition is 1/1/1/1.
    const words = ['ABABA', 'EBEBE', 'IBIBI', 'OBOBO'];
    const bits = entropyOf(encodeOne('AEIOU'), encode(words, 5), scratch);
    expect(bits).toBeCloseTo(Math.log2(4), 6);
  });

  it('is below log2(n) when a guess leaves candidates tied', () => {
    // ABCDE is green against itself and grey against all three others.
    const words = ['ABCDE', 'FGHIJ', 'KLMNO', 'PQRST'];
    const bits = entropyOf(encodeOne('ABCDE'), encode(words, 5), scratch);
    expect(bits).toBeCloseTo(-(0.25 * Math.log2(0.25) + 0.75 * Math.log2(0.75)), 6);
  });

  it('leaves its bucket scratch clean between calls', () => {
    const set = encode(['CRANE', 'SLATE', 'PLUMB'], 5);
    const first = entropyOf(encodeOne('CRANE'), set, scratch);
    entropyOf(encodeOne('SLATE'), set, scratch);
    expect(entropyOf(encodeOne('CRANE'), set, scratch)).toBe(first);
  });

  it('expectedInformation agrees with a naive partition count', () => {
    const words = ['CRANE', 'CRAVE', 'CRATE', 'SLATE', 'PLUMB'];
    const buckets = new Map<string, number>();
    for (const w of words) {
      const key = scoreStates('CRANE', w).join('');
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    let expected = 0;
    for (const count of buckets.values()) {
      const p = count / words.length;
      expected -= p * Math.log2(p);
    }
    expect(expectedInformation('CRANE', words)).toBeCloseTo(expected, 10);
  });
});
