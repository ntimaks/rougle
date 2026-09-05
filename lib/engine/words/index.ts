import solutions5 from '../../../data/solutions-5.json';
import valid5 from '../../../data/valid-5.json';
import { drawInt } from '../core/rng';

/**
 * Word lists. Built offline by `scripts/build-wordlists.ts` and committed to
 * `/data`; nothing here curates, filters or scores — that all happened at build
 * time (MECHANICS.md §8).
 *
 * Length 5 is imported statically because every act uses it. Lengths 6 and 7
 * are registered by `words/all.ts`, which the app dynamic-imports and the sim
 * imports directly, so ~600KB of Act III vocabulary stays out of the initial
 * bundle (ticket C-02).
 */

export type WordLength = 5 | 6 | 7;

export interface WordList {
  length: WordLength;
  solutions: string[];
  /** Membership test for input validation. Solutions are a subset. */
  valid: Set<string>;
}

interface RawList {
  length: number;
  count: number;
  words: string;
}

function build(sol: RawList, val: RawList): WordList {
  const solutions = sol.words.split('\n').filter(Boolean);
  const valid = new Set(val.words.split('\n').filter(Boolean));
  for (const w of solutions) valid.add(w); // solutions are always legal guesses
  return { length: sol.length as WordLength, solutions, valid };
}

const LISTS = new Map<WordLength, WordList>([
  [5, build(solutions5 as RawList, valid5 as RawList)],
]);

export function registerWordList(sol: unknown, val: unknown): void {
  const list = build(sol as RawList, val as RawList);
  LISTS.set(list.length, list);
}

export function hasWordList(length: WordLength): boolean {
  return LISTS.has(length);
}

export function wordList(length: WordLength): WordList {
  const list = LISTS.get(length);
  if (!list) {
    throw new Error(
      `No ${length}-letter word list registered. Import lib/engine/words/all.ts ` +
        '(sim) or dynamic-import it before entering an act that uses long words.',
    );
  }
  return list;
}

export function isValidGuess(guess: string, length: WordLength): boolean {
  return guess.length === length && wordList(length).valid.has(guess);
}

/**
 * Draws a solution. `exclude` holds the solutions already used this run, so a
 * run never repeats a word; on collision the index walks forward rather than
 * re-rolling, which keeps the draw addressed and bounded.
 */
export function drawSolution(
  seed: string,
  domain: string,
  length: WordLength,
  exclude: ReadonlySet<string> = new Set(),
): string {
  const { solutions } = wordList(length);
  const start = drawInt(seed, domain, 0, solutions.length);
  for (let i = 0; i < solutions.length; i++) {
    const candidate = solutions[(start + i) % solutions.length]!;
    if (!exclude.has(candidate)) return candidate;
  }
  throw new Error(`Every ${length}-letter solution is excluded (${solutions.length} total)`);
}
