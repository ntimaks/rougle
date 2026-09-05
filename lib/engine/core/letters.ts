import type { GameState, WordState } from './state';
import { hasRelic } from './state';

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * R-003, implemented once and shared. The Moth, the Locked Key modifier and
 * The Guillotine's (dropped) penalty all draw from here.
 *
 * A letter present in any live solution is never eligible. Under Mirror there
 * are two solutions and both are protected — removing a letter that only the
 * second solution needs would be just as unwinnable.
 */
export function eligibleLettersForRemoval(solutions: readonly string[]): string[] {
  const forbidden = new Set(solutions.flatMap((s) => [...s]));
  return ALPHABET.filter((c) => !forbidden.has(c));
}

/**
 * The single predicate behind every letter removal. Three separate systems take
 * letters off the keyboard — RL.02 The Sieve, the Locked Key modifier and
 * RL.19 The Moth — and they must share one predicate, or a physical keyboard
 * bypasses a lock that the on-screen one enforces (relics.json RL.02).
 *
 * `provenGrey` is supplied by the caller from the projected board, because the
 * Sieve's locks derive from what has been *shown*, not from the solution.
 */
export function isLetterAvailable(
  s: GameState,
  word: WordState | null,
  letter: string,
  provenGrey: ReadonlySet<string>,
): boolean {
  if (!word) return true;
  if (word.lockedLetters.some((l) => l.letter === letter)) return false;
  if (hasRelic(s, 'RL.02') && provenGrey.has(letter)) return false;
  return true;
}

/**
 * How many positions differ between a guess and the nearest solution.
 *
 * R-016 fixes "within one letter" (RL.20 Blindfold) as Hamming distance <= 1:
 * the guess and the solution are always the same length, so at most one
 * position may differ. Transpositions do not count — "within one letter" reads
 * as one letter wrong, and a Damerau-style reading would make the relic
 * materially stronger for a phrase that does not say so.
 */
export function hammingDistance(guess: string, solutions: readonly string[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const solution of solutions) {
    if (solution.length !== guess.length) continue;
    let differing = 0;
    for (let i = 0; i < guess.length; i++) if (guess[i] !== solution[i]) differing++;
    if (differing < best) best = differing;
  }
  return best;
}
