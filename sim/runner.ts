import {
  CONFIG,
  DOMAIN,
  draw,
  formatSeed,
  hash32,
  initialState,
  projectBoard,
  reduce,
  type CharacterCode,
  type GameConfig,
  type GameState,
  wordList,
} from '../lib/engine';
import '../lib/engine/words/all';
import {
  DEFAULT_SOLVER,
  chooseGuess,
  knownSolutions,
  type SolverConfig,
  type SolverView,
} from './solver';

/**
 * Plays one seeded run headlessly. No UI, no timers, no I/O.
 *
 * Every decision the bot makes is addressed off the run seed, so a run is a
 * pure function of (seed, character, solver config) and replays byte-identically
 * — which is Gate 1.
 */

export interface RunResult {
  seed: string;
  characterCode: CharacterCode;
  won: boolean;
  deathCause: string | null;
  deathActIndex: number;
  deathNodeId: string | null;
  /**
   * Death-cause attribution (MECHANICS.md §10.1). Captured at the guess that
   * emptied the pool:
   *  - answerKnown: the answer was still in the bot's candidate set, so the
   *    deduction was sound and the budget or the word ran out, not the player.
   *  - candidatesRemaining: how many indistinguishable candidates were left.
   * Together they separate "ran out of guesses" from "was forced to coin-flip
   * between four words that differ by one letter", which is the §8.1 failure.
   */
  deathWithAnswerKnown: boolean;
  deathCandidatesRemaining: number;
  wordsSolved: number;
  guessesSpent: number;
  refundsGranted: number;
  guessesPerWord: number[];
  guessesPerWordByAct: Array<number[]>;
  /** Guesses spent on each act's boss. B-06 measures the Twins from this. */
  bossGuessesByAct: Array<number[]>;
  cleanFiveLetterGuesses: number[];
  goldEarned: number;
  goldSpent: number;
  emergencyPurchases: number;
  relicsTaken: string[];
  finalGold: number;
  turns: number;
}

const MAX_ACTIONS = 4000;

export interface RunOptions {
  /** Gate 3: "does a no-relic bot die in Act II?" */
  noRelics?: boolean;
}

export function playRun(
  seed: string,
  characterCode: CharacterCode = 'CH.01',
  solver: SolverConfig = DEFAULT_SOLVER,
  cfg: Readonly<GameConfig> = CONFIG,
  options: RunOptions = {},
): RunResult {
  let s: GameState = initialState(seed, characterCode);
  s = reduce(s, { type: 'START_RUN', seed, characterCode }, cfg).state;

  const guessesPerWordByAct: number[][] = [[], [], []];
  const bossGuessesByAct: number[][] = [[], [], []];
  const cleanFive: number[] = [];
  let deathWithAnswerKnown = false;
  let deathCandidatesRemaining = 0;
  let actions = 0;

  const known = new Map<number, ReturnType<typeof knownSolutions>>();
  const vocabRng = (i: number) => draw(seed, 'solver:vocab', i);

  while (s.phase !== 'DEATH' && s.phase !== 'VICTORY') {
    if (++actions > MAX_ACTIONS) {
      throw new Error(`Run ${seed} exceeded ${MAX_ACTIONS} actions — the loop is not terminating.`);
    }

    switch (s.phase) {
      case 'MAP': {
        const nodeId = s.map.available[0];
        if (!nodeId) throw new Error(`Run ${seed} is on the map with nowhere to go.`);
        s = reduce(s, { type: 'SELECT_NODE', nodeId }, cfg).state;
        break;
      }

      case 'WORD': {
        const word = s.word!;
        const actIndex = s.actIndex;
        const before = word.history.length;
        const solutionIndex = word.solved.findIndex((v) => !v);
        const target = word.solutions[Math.max(0, solutionIndex)]!;

        if (!known.has(word.length)) {
          known.set(word.length, knownSolutions(word.length, solver, vocabRng));
        }

        const board = projectBoard(s, word);
        const view: SolverView = {
          length: word.length,
          modifiers: word.modifiers,
          board,
          // board.locked, not word.lockedLetters: RL.02 The Sieve adds
          // proven-grey letters, and the engine will reject a guess using one.
          locked: board.locked,
          presetTiles: word.presetTiles,
          revealed: word.revealed,
          solutionIndex: Math.max(0, solutionIndex),
        };

        const choice = chooseGuess(
          view,
          known.get(word.length)!,
          {
            cfg: solver,
            rng: (i) => draw(seed, DOMAIN.relic(`solver:${word.nodeId}`, 'choose'), i),
          },
          target,
        );

        const result = reduce(s, { type: 'SUBMIT_GUESS', guess: choice.guess }, cfg);
        if (result.error) {
          // An illegal guess (locked letter, not in the list) costs the bot a
          // turn's worth of nothing; fall back to any legal candidate.
          const fallback = fallbackGuess(s, view);
          if (!fallback) throw new Error(`Run ${seed}: no legal guess (${result.error.code}).`);
          s = reduce(s, { type: 'SUBMIT_GUESS', guess: fallback }, cfg).state;
        } else {
          s = result.state;
        }

        if (!s.word || s.word.history.length !== before + 1 || s.phase !== 'WORD') {
          // The word ended on this guess.
          const used = before + 1;
          if (s.stats.guessesPerWord.length > guessesPerWordByAct.flat().length) {
            guessesPerWordByAct[actIndex]!.push(used);
            if (word.nodeId.endsWith('-boss')) bossGuessesByAct[actIndex]!.push(used);
            if (word.length === 5 && word.modifiers.length === 0) cleanFive.push(used);
          }
        }
        if (s.phase === 'EMERGENCY' || s.phase === 'DEATH') {
          deathWithAnswerKnown = !choice.lostTheAnswer;
          deathCandidatesRemaining = choice.candidatesRemaining;
        }
        break;
      }

      case 'REWARD': {
        const offer = s.pendingOffer;
        if (!offer) {
          s = reduce(s, { type: 'ADVANCE' }, cfg).state;
          break;
        }
        if (options.noRelics) {
          s = reduce(s, { type: 'SKIP_OFFER' }, cfg).state;
          break;
        }
        const pick = offer.codes[0]!;
        s = reduce(s, { type: 'ACCEPT_OFFER', code: pick }, cfg).state;
        break;
      }

      case 'EMERGENCY': {
        const buy = reduce(s, { type: 'BUY_EMERGENCY' }, cfg);
        s = buy.error ? reduce(s, { type: 'DECLINE_EMERGENCY' }, cfg).state : buy.state;
        break;
      }

      default:
        s = reduce(s, { type: 'ADVANCE' }, cfg).state;
    }
  }

  return {
    seed,
    characterCode,
    won: s.phase === 'VICTORY',
    deathCause: s.outcome?.cause ?? null,
    deathActIndex: s.actIndex,
    deathNodeId: s.stats.deathNodeId,
    deathWithAnswerKnown,
    deathCandidatesRemaining,
    wordsSolved: s.stats.wordsSolved,
    guessesSpent: s.stats.guessesSpent,
    refundsGranted: s.stats.refundsGranted,
    guessesPerWord: s.stats.guessesPerWord,
    guessesPerWordByAct,
    bossGuessesByAct,
    cleanFiveLetterGuesses: cleanFive,
    goldEarned: s.stats.goldEarned,
    goldSpent: s.stats.goldSpent,
    emergencyPurchases: s.stats.emergencyPurchases,
    relicsTaken: s.stats.relicsTaken,
    finalGold: s.gold,
    turns: actions,
  };
}

/**
 * Any legal word at all. Reached when the solver's candidate set has been
 * locked out from under it; searches the full guess list rather than the
 * solution list, because a probe only has to be legal, not plausible.
 */
function fallbackGuess(s: GameState, view: SolverView): string | null {
  const locked = new Set(view.locked);
  for (const word of wordList(view.length).valid) {
    if ([...word].some((c) => locked.has(c))) continue;
    if (!reduce(s, { type: 'SUBMIT_GUESS', guess: word }).error) return word;
  }
  return null;
}

/** Deterministic seed for run `n` of a sweep. */
export function sweepSeed(label: string, n: number): string {
  return formatSeed(hash32(`${label}:${n}`));
}
