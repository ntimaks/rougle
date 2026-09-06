import {
  CONFIG,
  DOMAIN,
  draw,
  formatSeed,
  hash32,
  initialState,
  projectBoard,
  reduce,
  currentPool,
  revealBlocker,
  type CharacterCode,
  type GameConfig,
  type GameState,
  wordList,
} from '../lib/engine';
import { EVENTS } from '../lib/engine/content/events';
import '../lib/engine/words/all';
import {
  DEFAULT_SOLVER,
  chooseGuess,
  filterCandidates,
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
  /** §2.5 reveals bought across the run, so the sink can be measured. */
  revealsBought: number;
  emergencyPurchases: number;
  relicsTaken: string[];
  finalGold: number;
  turns: number;
}

const MAX_ACTIONS = 4000;

export interface RunOptions {
  /** Gate 3: "does a no-relic bot die in Act II?" */
  noRelics?: boolean;
  /** Measure the game as it was before R-020, for the A/B on the reveal ladder. */
  noReveals?: boolean;
  /** Measure the game with the shop inert, for an A/B on the new sinks. */
  noShopping?: boolean;
  /** Overrides for when the bot buys a §2.5 reveal. See REVEAL_POLICY. */
  revealPolicy?: Partial<RevealPolicy>;
}

/**
 * When the bot buys a reveal.
 *
 * Two triggers, because "stuck" has two shapes and only one of them is about
 * the act pool. `poolAtMost` is running out of run; `guessesOnWordAtLeast` is
 * the one the playtest actually described — several guesses into a word and
 * still no idea — which can happen with a healthy pool and is invisible to any
 * threshold on it.
 *
 * `candidatesOver` guards both: with two candidates left you guess one, you do
 * not pay to be told which.
 */
export interface RevealPolicy {
  poolAtMost: number;
  guessesOnWordAtLeast: number;
  candidatesOver: number;
}

/** When the bot starts taking gold instead of relics at a word node (R-025). */
const RELICS_BEFORE_BANKING = 4;

export const REVEAL_POLICY: RevealPolicy = {
  poolAtMost: 2,
  guessesOnWordAtLeast: 3,
  candidatesOver: 5,
};

/**
 * Which position to buy. Picks the one that splits the candidate set most
 * evenly — the position whose letter is least predictable is the one carrying
 * the most information, which is the same principle the guess ranker uses.
 */
function revealTarget(
  s: GameState,
  view: SolverView,
  vocabulary: readonly string[],
): number | null {
  const word = s.word!;
  const known = new Set(word.presetTiles.map((p) => p.index));
  const candidates = filterCandidates(view, vocabulary);
  if (candidates.length === 0) return null;

  let best: number | null = null;
  let bestSpread = -1;
  for (let i = 0; i < word.length; i++) {
    if (known.has(i)) continue;
    const counts = new Map<string, number>();
    for (const candidate of candidates) {
      const letter = candidate[i]!;
      counts.set(letter, (counts.get(letter) ?? 0) + 1);
    }
    // Distinct letters at this position: more means the reveal eliminates more.
    const spread = counts.size;
    if (spread > bestSpread) {
      bestSpread = spread;
      best = i;
    }
  }
  return best;
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
  let revealsBought = 0;

  const known = new Map<number, ReturnType<typeof knownSolutions>>();
  const vocabRng = (i: number) => draw(seed, 'solver:vocab', i);

  while (s.phase !== 'DEATH' && s.phase !== 'VICTORY') {
    if (++actions > MAX_ACTIONS) {
      throw new Error(`Run ${seed} exceeded ${MAX_ACTIONS} actions — the loop is not terminating.`);
    }

    switch (s.phase) {
      case 'MAP': {
        // Route choice is a real decision now (R-01), and the bot does not make
        // it: it always walks the first available node. That is a deliberate
        // floor, not an oversight — a bot that picked optimally would hide how
        // punishing a bad route is, which is the thing route design is for.
        const nodeId = s.map.available[0];
        if (!nodeId) throw new Error(`Run ${seed} is on the map with nowhere to go.`);
        s = reduce(s, { type: 'SELECT_NODE', nodeId }, cfg).state;
        break;
      }

      case 'SHOP': {
        // Buy the cheapest affordable thing, then leave. Crude, and enough to
        // stop the shop being a pure gold sink in the report.
        if (!options.noShopping) {
          const affordable = (s.shop?.stock ?? [])
            .map((item, slot) => ({ item, slot }))
            .filter(({ item }) => !item.sold && item.price <= s.gold)
            .sort((a, b) => a.item.price - b.item.price);
          for (const { slot } of affordable) {
            const bought = reduce(s, { type: 'BUY_STOCK', slot }, cfg);
            if (!bought.error) s = bought.state;
          }
        }
        s = reduce(s, { type: 'LEAVE_NODE' }, cfg).state;
        break;
      }

      case 'FORGE': {
        // Upgrade the first relic THIS FORGE OFFERS (R-035); if it offers
        // nothing upgradeable, buy guesses. Reading `relics` here instead would
        // pick something outside the offer, take NOT_IN_OFFER, and break out of
        // the loop — leaving the bot standing in a forge doing nothing at all,
        // which is a silent measurement bug rather than a visible failure.
        while ((s.forge?.operationsLeft ?? 0) > 0) {
          const target = s.forge!.candidates.find(
            (id) => !s.relics.find((r) => r.instanceId === id)?.upgraded,
          );
          const op = target
            ? reduce(s, { type: 'FORGE_UPGRADE', instanceId: target }, cfg)
            : reduce(s, { type: 'FORGE_CONVERT', guesses: 1 }, cfg);
          if (op.error) break;
          s = op.state;
        }
        s = reduce(s, { type: 'LEAVE_NODE' }, cfg).state;
        break;
      }

      case 'EVENT': {
        // Always the last option, which §6.8 guarantees is the non-destructive
        // one. Understates events badly and says so in the report caveat — a bot
        // that never gambles cannot measure a system built on gambles.
        const def = s.event ? EVENTS[s.event.code] : undefined;
        const key = def?.options.at(-1)?.key;
        const chosen = key
          ? reduce(s, { type: 'CHOOSE_EVENT_OPTION', key }, cfg)
          : { state: s, error: { code: 'NO_SUCH_OPTION' } as const };
        s = chosen.error ? reduce(s, { type: 'LEAVE_NODE' }, cfg).state : chosen.state;
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

        const buildView = (state: GameState): SolverView => {
          const w = state.word!;
          const projected = projectBoard(state, w);
          return {
            length: w.length,
            modifiers: w.modifiers,
            board: projected,
            // board.locked, not word.lockedLetters: RL.02 The Sieve adds
            // proven-grey letters, and the engine will reject a guess using one.
            locked: projected.locked,
            presetTiles: w.presetTiles,
            revealed: w.revealed,
            solutionIndex: Math.max(0, solutionIndex),
          };
        };

        let view = buildView(s);

        // §2.5 — buy reveals when the pool cannot cover the search that is left.
        // Deliberately a DESPERATION policy, not optimal play: it buys only when
        // the pool is nearly gone and the word is still genuinely open. A skilled
        // human buys earlier and more often, so every number this produces is a
        // LOWER bound on what the ladder does to the game (§13 I-22).
        if (!options.noReveals) {
          const policy = { ...REVEAL_POLICY, ...options.revealPolicy };
          while (
            (currentPool(s) <= policy.poolAtMost ||
              s.word!.history.length >= policy.guessesOnWordAtLeast) &&
            revealBlocker(s, cfg) === null &&
            filterCandidates(view, known.get(word.length)!.all).length > policy.candidatesOver
          ) {
            const position = revealTarget(s, view, known.get(word.length)!.all);
            if (position === null) break;
            const bought = reduce(s, { type: 'BUY_REVEAL', index: position }, cfg);
            if (bought.error) break;
            s = bought.state;
            revealsBought++;
            view = buildView(s);
          }
        }

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
        // R-025 made the word-node reward a CHOICE, and a bot that always takes
        // the relic never earns gold — which would leave the shop, the forge and
        // both ladders measuring a player who cannot afford any of them.
        // Build first, then bank: take relics until the deck is real, then take
        // the gold. A floor, not optimal play, and stated in the report.
        const banking = offer.goldInstead !== null && s.relics.length >= RELICS_BEFORE_BANKING;
        s = banking
          ? reduce(s, { type: 'SKIP_OFFER' }, cfg).state
          : reduce(s, { type: 'ACCEPT_OFFER', code: offer.codes[0]! }, cfg).state;
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
    revealsBought,
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
