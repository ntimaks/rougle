import { draw, scoreStates, wordList, type WordLength } from '../lib/engine';
import '../lib/engine/words/all';
import { DEFAULT_SOLVER, filterCandidates, knownSolutions, rankGuesses, type SolverConfig } from './solver';
import type { BoardRow, BoardView } from '../lib/engine';

/**
 * The clean baseline: plain Wordle, one word, no relics, no modifiers, no
 * reveals, unlimited guesses. This is the instrument the handicap is calibrated
 * against, because it is the only measurement directly comparable to the
 * figures MECHANICS.md §10.2 quotes — ~3.4 guesses/word for a strong solver,
 * ~3.9 for a competent human.
 *
 * Measuring inside a run would not do: a run's words carry modifiers and the
 * character's innate reveal, both of which move the number for reasons that
 * have nothing to do with solver skill.
 */
export function solveClean(
  solution: string,
  length: WordLength,
  solver: SolverConfig,
  seed: string,
): number {
  // The bot's vocabulary, not the game's: `vocabularyGap` drops a deterministic
  // slice, modelling a player who simply does not know some of the words.
  const known = knownSolutions(length, solver, (i) => draw(seed, 'baseline:vocab', i));
  const rows: BoardRow[] = [];

  for (let turn = 0; turn < 20; turn++) {
    const board: BoardView = { rows, keyboard: {}, locked: [], provenGrey: [] };
    const view = {
      length,
      modifiers: [] as never[],
      board,
      locked: [] as string[],
      presetTiles: [],
      revealed: { vowelCount: null, hasRepeat: null, letters: [] },
      solutionIndex: 0,
    };

    const fresh = (w: string) => !rows.some((r) => r.guess === w);
    let candidates = filterCandidates(view, known.preferred).filter(fresh);
    // Fall back to the full list once the words the bot "knows" are exhausted.
    if (candidates.length === 0) candidates = filterCandidates(view, known.all).filter(fresh);
    if (candidates.length === 0) return turn + 1;

    let guess: string;
    if (candidates.length <= 2) {
      guess = candidates[0]!;
    } else if (draw(seed, 'baseline:handicap', turn) < solver.suboptimality) {
      const pick = Math.floor(draw(seed, 'baseline:pick', turn) * candidates.length);
      guess = candidates[Math.min(pick, candidates.length - 1)]!;
    } else {
      guess = rankGuesses(candidates.slice(0, solver.searchWidth), candidates, length)[0]!.guess;
    }

    if (guess === solution) return turn + 1;

    const states = scoreStates(guess, solution);
    rows.push({
      guess,
      turn,
      results: [
        {
          tiles: guess.split('').map((letter, i) => ({
            letter,
            state: states[i]!,
            distance: null,
            trustworthy: true,
          })),
          meta: { vowelCount: null, hasRepeat: null, revealedLetters: [], deferred: false, revealsIn: null },
        },
      ],
    });
  }
  return 20;
}

/** Mean guesses per word over `count` seeded solutions. */
export function cleanBaseline(
  count: number,
  solver: SolverConfig = DEFAULT_SOLVER,
  length: WordLength = 5,
): number {
  const solutions = wordList(length).solutions;
  let total = 0;
  for (let i = 0; i < count; i++) {
    const solution = solutions[Math.floor(draw('BASELINE', 'word', i) * solutions.length)]!;
    total += solveClean(solution, length, solver, `BASE${i}`);
  }
  return total / count;
}
