import { type FeedbackResult, type TileState } from './types';

/**
 * Base scorer. MECHANICS.md §4.3.
 *
 * This is a PORT of `score()` in `design/Rougle.dc.html`, not a rewrite. That
 * function was fuzzed against an independent reference over 200,000 randomised
 * cases with a reduced alphabet (to force duplicate collisions) with zero
 * mismatches. `scorer.diff.test.ts` re-runs that regime against the original
 * extracted from the prototype at test time, so the port cannot drift from the
 * proven implementation.
 *
 * The only intentional differences: it is typed, and it returns a
 * `FeedbackResult` rather than a G/Y/X string. The two loops are the original's.
 */
export function scoreStates(guess: string, solution: string): TileState[] {
  const g = guess.split('');
  const s = solution.split('');
  const out: TileState[] = g.map(() => 'GREY');
  const left: Record<string, number> = {};
  g.forEach((c, i) => {
    if (c === s[i]) out[i] = 'GREEN';
    else left[s[i]!] = (left[s[i]!] ?? 0) + 1;
  });
  g.forEach((c, i) => {
    if (out[i] !== 'GREEN' && (left[c] ?? 0) > 0) {
      out[i] = 'YELLOW';
      left[c] = left[c]! - 1;
    }
  });
  return out;
}

/** The scorer as the pipeline consumes it: a full, untransformed FeedbackResult. */
export function scoreBase(guess: string, solution: string): FeedbackResult {
  const states = scoreStates(guess, solution);
  return {
    tiles: guess.split('').map((letter, i) => ({
      letter,
      state: states[i]!,
      distance: null,
      trustworthy: true,
    })),
    meta: { vowelCount: null, hasRepeat: null, revealedLetters: [], deferred: false },
  };
}

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

/** MECHANICS.md §6.3 reveal payloads. Lexicon (RL.01) and CH.01's innate. */
export function vowelCount(word: string): number {
  return [...word].filter((c) => VOWELS.has(c)).length;
}

/** The Concordance (RL.05). */
export function hasRepeat(word: string): boolean {
  return new Set(word).size !== word.length;
}
