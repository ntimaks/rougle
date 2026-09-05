import { describe, expect, it } from 'vitest';
import { drawSolution, hasWordList, isValidGuess, wordList } from './index';
import { clusters } from '../../../scripts/build-wordlists';
import './all';

/** E-12 — word lists. MECHANICS.md §8 owns the curation; this checks the load. */

describe('lists', () => {
  it('registers 5, 6 and 7 letter lists', () => {
    for (const n of [5, 6, 7] as const) {
      expect(hasWordList(n)).toBe(true);
      expect(wordList(n).solutions.length).toBeGreaterThan(400);
      expect(wordList(n).valid.size).toBeGreaterThan(wordList(n).solutions.length);
    }
  });

  it('every solution is a legal guess', () => {
    for (const n of [5, 6, 7] as const) {
      for (const word of wordList(n).solutions) expect(wordList(n).valid.has(word)).toBe(true);
    }
  });

  it('every word is upper-case, alphabetic and the right length', () => {
    for (const n of [5, 6, 7] as const) {
      for (const word of wordList(n).solutions) {
        expect(word).toMatch(new RegExp(`^[A-Z]{${n}}$`));
      }
    }
  });

  it('validates guesses by length and membership', () => {
    const first = wordList(5).solutions[0]!;
    expect(isValidGuess(first, 5)).toBe(true);
    expect(isValidGuess('ZZZZZ', 5)).toBe(false);
    expect(isValidGuess('CAT', 5)).toBe(false);
  });
});

describe('curation — MECHANICS.md §8.1', () => {
  it('the shipped solution lists contain no ambiguity clusters', () => {
    for (const [n, threshold] of [[5, 4], [6, 5], [7, 5]] as const) {
      const found = clusters(wordList(n).solutions, threshold);
      expect([...found].slice(0, 10), `length ${n}`).toEqual([]);
    }
  });

  it('the canonical offenders are gone from solutions but legal as guesses', () => {
    const five = wordList(5);
    for (const word of ['WATCH', 'BATCH', 'CATCH', 'MATCH', 'LIGHT', 'MIGHT', 'NIGHT']) {
      expect(five.solutions, word).not.toContain(word);
      expect(five.valid.has(word), word).toBe(true);
    }
  });

  it('clusters() finds a family and leaves a small one alone', () => {
    expect([...clusters(['WATCH', 'BATCH', 'CATCH', 'MATCH'], 4)].sort()).toEqual([
      'BATCH',
      'CATCH',
      'MATCH',
      'WATCH',
    ]);
    expect([...clusters(['WATCH', 'BATCH'], 4)]).toEqual([]);
  });
});

describe('drawSolution', () => {
  it('is deterministic for an address', () => {
    expect(drawSolution('SEEDAAAA', 'word:n1', 5)).toBe(drawSolution('SEEDAAAA', 'word:n1', 5));
  });

  it('never repeats an excluded word', () => {
    const exclude = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const word = drawSolution('SEEDAAAA', `word:n${i}`, 5, exclude);
      expect(exclude.has(word)).toBe(false);
      exclude.add(word);
    }
  });
});
