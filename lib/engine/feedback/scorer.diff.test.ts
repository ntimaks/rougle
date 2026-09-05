import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { draw } from '../core/rng';
import { scoreStates } from './scorer';
import { hasRepeat, scoreBase, vowelCount } from './scorer';

/**
 * E-01. The port is only worth anything if it is differentially tested against
 * the thing it was ported from. MECHANICS.md §4.3 says the prototype's `score()`
 * is proven; this test extracts that exact function from the design bundle and
 * runs both over the same fuzzing regime the proof used.
 *
 * Extracting rather than transcribing is deliberate: a transcribed reference
 * drifts the moment somebody "tidies" it, and then the test proves nothing.
 */
const PROTOTYPE = resolve(__dirname, '../../../design/Rougle.dc.html');

function loadOriginalScorer(): (guess: string, sol: string) => string[] {
  const html = readFileSync(PROTOTYPE, 'utf8');
  const match = /\n\s*score\(guess, sol\) \{\n([\s\S]*?)\n\s*\}\n/.exec(html);
  if (!match?.[1]) throw new Error('Could not extract score() from the prototype');
  return new Function('guess', 'sol', match[1]) as (g: string, s: string) => string[];
}

const MAP: Record<string, string> = { G: 'GREEN', Y: 'YELLOW', X: 'GREY' };

describe('scoreStates — differential against the prototype', () => {
  const original = loadOriginalScorer();

  it('extracts a function that behaves like the documented scorer', () => {
    expect(original('CRANE', 'CRANE').join('')).toBe('GGGGG');
    expect(original('AAAAA', 'BBBBB').join('')).toBe('XXXXX');
  });

  /**
   * 200,000 randomised cases over a reduced alphabet. The small alphabet is the
   * point: it forces duplicate letters into collision constantly, which is the
   * only part of two-pass scoring anyone ever gets wrong.
   */
  it('matches the original over 200k reduced-alphabet cases', () => {
    const alphabet = 'ABCDE';
    let checked = 0;
    for (let n = 0; n < 200_000; n++) {
      const len = 4 + (n % 4); // 4..7
      let guess = '';
      let solution = '';
      for (let i = 0; i < len; i++) {
        guess += alphabet[Math.floor(draw('DIFFTEST', `g:${n}`, i) * alphabet.length)];
        solution += alphabet[Math.floor(draw('DIFFTEST', `s:${n}`, i) * alphabet.length)];
      }
      const mine = scoreStates(guess, solution);
      const theirs = original(guess, solution).map((c) => MAP[c]);
      if (mine.join(',') !== theirs.join(',')) {
        throw new Error(
          `mismatch on guess=${guess} solution=${solution}: ${mine.join('')} vs ${theirs.join('')}`,
        );
      }
      checked++;
    }
    expect(checked).toBe(200_000);
  });

  it('matches the original over 20k full-alphabet cases', () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let n = 0; n < 20_000; n++) {
      const len = 5 + (n % 3);
      let guess = '';
      let solution = '';
      for (let i = 0; i < len; i++) {
        guess += alphabet[Math.floor(draw('DIFFTEST26', `g:${n}`, i) * alphabet.length)];
        solution += alphabet[Math.floor(draw('DIFFTEST26', `s:${n}`, i) * alphabet.length)];
      }
      expect(scoreStates(guess, solution).map((s) => s[0])).toEqual(
        original(guess, solution).map((c) => MAP[c]![0]),
      );
    }
  });
});

describe('scoreStates — properties', () => {
  it('never reports more of a letter than the solution holds', () => {
    const alphabet = 'ABCD';
    for (let n = 0; n < 20_000; n++) {
      let guess = '';
      let solution = '';
      for (let i = 0; i < 5; i++) {
        guess += alphabet[Math.floor(draw('PROP', `g:${n}`, i) * alphabet.length)];
        solution += alphabet[Math.floor(draw('PROP', `s:${n}`, i) * alphabet.length)];
      }
      const states = scoreStates(guess, solution);
      for (const c of new Set(guess)) {
        const reported = [...guess].filter((g, i) => g === c && states[i] !== 'GREY').length;
        const present = [...solution].filter((s) => s === c).length;
        expect(reported).toBeLessThanOrEqual(present);
      }
    }
  });

  it('scores an exact match all green and nothing else does', () => {
    expect(scoreStates('SLATE', 'SLATE').every((s) => s === 'GREEN')).toBe(true);
    expect(scoreStates('SLATS', 'SLATE').every((s) => s === 'GREEN')).toBe(false);
  });
});

describe('scoreBase', () => {
  it('returns trustworthy tiles carrying their own letter and no distance', () => {
    const fb = scoreBase('CRANE', 'CRAVE');
    expect(fb.tiles.map((t) => t.letter).join('')).toBe('CRANE');
    expect(fb.tiles.every((t) => t.trustworthy)).toBe(true);
    expect(fb.tiles.every((t) => t.distance === null)).toBe(true);
    expect(fb.meta).toEqual({
      vowelCount: null,
      hasRepeat: null,
      revealedLetters: [],
      deferred: false,
    });
  });
});

describe('meta helpers', () => {
  it('counts vowels', () => {
    expect(vowelCount('CRANE')).toBe(2);
    expect(vowelCount('RHYTHM')).toBe(0);
  });

  it('detects repeats', () => {
    expect(hasRepeat('LLAMA')).toBe(true);
    expect(hasRepeat('CRANE')).toBe(false);
  });
});
