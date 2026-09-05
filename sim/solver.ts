import {
  scoreStates,
  wordList,
  type BoardView,
  type ModifierId,
  type TileState,
  type WordLength,
} from '../lib/engine';
import { EntropyScratch, encode, encodeOne, entropyOf, pattern, type Encoded } from './entropy';

/**
 * The simulated player. Technical brief §9, MECHANICS.md §10.2.
 *
 * Entropy-maximising: fixed opener, then filter candidates by feedback
 * consistency and pick the guess with the highest expected information.
 *
 * It plays better than a human — roughly 3.4 guesses/word against a human 3.9 —
 * so `SolverConfig` carries an explicit handicap rather than the balance being
 * tuned until the bot's win rate looks right. Calibrate once, commit the value
 * with the run that produced it, sweep at that setting (H-03).
 */

export interface SolverConfig {
  /**
   * Probability of playing a plausible candidate instead of the
   * information-optimal one.
   *
   * The obvious knob — "take the second-best guess" — turns out to be far too
   * weak to span the gap: the second-best guess is almost as informative as the
   * best, and driving this to 1.0 under that reading moved the mean from 3.06
   * to only 3.31, well short of the 3.9 human baseline. Humans do not play the
   * second-best line, they play a word they think might be the answer, so that
   * is what this models: when the roll fires, pick uniformly from the consistent
   * candidates.
   */
  suboptimality: number;
  /** Probability of forgetting a decayed green. See the Decay caveat below. */
  memoryDecay: number;
  /** Fraction of SOLUTIONS the bot pretends not to know. */
  vocabularyGap: number;
  /** Guesses scored per turn once the candidate set is large. §9. */
  searchWidth: number;
}

export const DEFAULT_SOLVER: SolverConfig = {
  suboptimality: 0,
  memoryDecay: 0,
  vocabularyGap: 0,
  searchWidth: 200,
};

export interface SolverView {
  length: WordLength;
  modifiers: readonly ModifierId[];
  board: BoardView;
  locked: readonly string[];
  presetTiles: ReadonlyArray<{ index: number; letter: string }>;
  revealed: {
    vowelCount: number | null;
    hasRepeat: boolean | null;
    letters: ReadonlyArray<{ letter: string; present: boolean }>;
  };
  /** Which of the (one or two) solutions this call is trying to crack. */
  solutionIndex: number;
}

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
const openerCache = new Map<string, string>();
const scratch = new EntropyScratch();

/**
 * Encoding the full solution list is O(n) and the narrowing loop below does it
 * once per row per turn — the same 1057 words, re-packed, thousands of times a
 * run. Cached by list identity, which is stable for a run because
 * `knownSolutions` builds the vocabulary once.
 */
const encodeCache = new WeakMap<readonly string[], Encoded>();

function encodeCached(words: readonly string[], length: WordLength): Encoded {
  const hit = encodeCache.get(words);
  if (hit) return hit;
  const built = encode(words, length);
  encodeCache.set(words, built);
  return built;
}

/**
 * Consistency of one candidate with one observed row.
 *
 * The observed row is what the PLAYER sees — `projectBoard` output — not the
 * stored truth. Every adversarial mechanic is therefore handled here, where the
 * information actually arrives:
 *
 * - HIDDEN (Fog, Cipher): the row is unread. No constraint at all.
 * - UNKNOWN (Decay): the bot remembers what the tile said. See the caveat.
 * - trustworthy === false (Liar Letter): the corruption texture tells the
 *   player the tile is lying, so the constraint is "the true state is NOT the
 *   reported one" rather than nothing. The brief's §9 policy assumes the lie is
 *   invisible; MECHANICS.md §4.2 makes it visible, so this models the visible
 *   version. The relax-on-empty fallback below still covers the other reading.
 * - distance with letter === null (Rangefinder): a genuine constraint — some
 *   letter of the solution sits N positions from here — and modelled as one,
 *   because treating it as noise would systematically under-rate the relic.
 * - SILENT_START: turn 0 reports no yellows, so a GREY on turn 0 under that
 *   modifier means "not green here", nothing more.
 */
export function consistent(
  candidate: string,
  guess: string,
  observed: ReadonlyArray<{ state: TileState; letter: string | null; distance: number | null; trustworthy: boolean }>,
  opts: { silentStartRow: boolean; rangefinder: boolean },
): boolean {
  const truth = scoreStates(guess, candidate);

  for (let i = 0; i < observed.length; i++) {
    const tile = observed[i]!;
    if (tile.state === 'HIDDEN') return true; // whole row withheld
    const actual = truth[i]!;

    if (!tile.trustworthy) {
      // We know this position lied; we just do not know what it hid.
      if (opts.rangefinder && tile.distance !== null) continue;
      if (actual === tile.state) return false;
      continue;
    }

    if (tile.state === 'UNKNOWN') {
      // Decayed green: the bot remembers it was green.
      if (actual !== 'GREEN') return false;
      continue;
    }

    if (opts.silentStartRow && tile.state === 'GREY') {
      if (actual === 'GREEN') return false;
      continue;
    }

    if (tile.distance !== null && tile.letter === null) {
      // Rangefinder: state is YELLOW and the letter sits `distance` away.
      if (actual !== 'YELLOW') return false;
      const letter = guess[i]!;
      const nearest = nearestOffset(candidate, letter, i, truth);
      if (nearest !== tile.distance) return false;
      continue;
    }

    if (actual !== tile.state) return false;
  }
  return true;
}

function nearestOffset(
  candidate: string,
  letter: string,
  index: number,
  truth: readonly TileState[],
): number | null {
  let best: number | null = null;
  for (let j = 0; j < candidate.length; j++) {
    if (j === index || candidate[j] !== letter || truth[j] === 'GREEN') continue;
    const d = Math.abs(j - index);
    if (best === null || d < best) best = d;
  }
  return best;
}

/**
 * Packs an observed row into the same base-3 pattern the fast scorer produces,
 * or returns null when the row carries something the packing cannot express —
 * a withheld tile, a corrupted one, a Rangefinder distance, or a Silent Start
 * first guess. Those rows fall back to the general `consistent` check.
 */
function packObserved(
  tiles: ReadonlyArray<{ state: TileState; letter: string | null; distance: number | null; trustworthy: boolean }>,
  silentStartRow: boolean,
): number | null {
  if (silentStartRow) return null;
  let pat = 0;
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i]!;
    if (!tile.trustworthy || tile.distance !== null) return null;
    if (tile.state === 'GREEN') pat += 2 * 3 ** i;
    else if (tile.state === 'YELLOW') pat += 3 ** i;
    else if (tile.state !== 'GREY') return null; // HIDDEN or UNKNOWN
  }
  return pat;
}

/**
 * Narrowing is prefix-cached. Turn t re-checks rows 0..t-1, and the first row
 * always runs against the whole solution list, so without this the same 1000+
 * comparisons are redone every single guess. Keyed on the row prefix, so each
 * turn pays only for the row it just added.
 */
const narrowCache = new Map<string, readonly string[]>();
const NARROW_CACHE_LIMIT = 20_000;

function rowSignature(guess: string, observed: number | null, tiles: readonly { state: TileState; distance: number | null; trustworthy: boolean }[]): string {
  if (observed !== null) return `${guess}:${observed}`;
  return `${guess}:${tiles.map((t) => `${t.state}${t.distance ?? ''}${t.trustworthy ? '' : '!'}`).join('')}`;
}

/** Narrows the solution list against every visible row. */
export function filterCandidates(view: SolverView, pool: readonly string[]): string[] {
  const rangefinder = view.board.rows.some((r) =>
    r.results[view.solutionIndex]?.tiles.some((t) => t.distance !== null),
  );
  const silentStart = view.modifiers.includes('SILENT_START');

  // Pre-guess reveals and pre-set tiles describe the FIRST solution. Under
  // Mirror the second one is a different word, and applying the first's vowel
  // count to it eliminates the real answer on turn one — exactly the shape of
  // bug that makes a boss look unbeatable. (Which solution a reveal describes
  // under Mirror is itself unstated; raised as §13 I-19.)
  const revealsApply = view.solutionIndex === 0;
  const hasReveals =
    view.presetTiles.length > 0 ||
    view.revealed.vowelCount !== null ||
    view.revealed.hasRepeat !== null ||
    view.revealed.letters.length > 0;

  let key = `${view.length}:${pool.length}:${view.solutionIndex}`;
  let candidates: readonly string[] = pool;

  if (revealsApply && hasReveals) {
    key += `|r${view.revealed.vowelCount}/${view.revealed.hasRepeat}/${view.presetTiles
      .map((t) => `${t.index}${t.letter}`)
      .join('')}/${view.revealed.letters.map((l) => `${l.letter}${l.present ? '+' : '-'}`).join('')}`;
    const cached = narrowCache.get(key);
    candidates = cached ?? applyReveals(view, pool);
    if (!cached) narrowCache.set(key, candidates);
  }

  const rows = view.board.rows;
  for (let turn = 0; turn < rows.length; turn++) {
    const row = rows[turn]!;
    const result = row.results[view.solutionIndex];
    if (!result || result.meta.deferred) continue;
    const silentStartRow = silentStart && turn === 0;
    const observed = packObserved(result.tiles, silentStartRow);

    key += `|${rowSignature(row.guess, observed, result.tiles)}`;
    const cached = narrowCache.get(key);
    if (cached) {
      candidates = cached;
      continue;
    }

    let narrowed: string[];
    if (observed !== null) {
      // Fast path: an ordinary row is just a pattern match.
      const guessCode = encodeOne(row.guess);
      const set = candidates === pool ? encodeCached(pool, view.length) : encode(candidates, view.length);
      narrowed = [];
      for (let c = 0; c < set.count; c++) {
        const p = pattern(guessCode, set.codes, c * set.length, set.length, scratch.counts, scratch.green);
        if (p === observed) narrowed.push(candidates[c]!);
      }
    } else {
      const opts = { silentStartRow, rangefinder };
      narrowed = candidates.filter((c) => consistent(c, row.guess, result.tiles, opts));
    }

    // Relax rather than empty. A contradiction means a model assumption was
    // wrong — a lie read the other way, a forgotten decayed green — and a
    // solver with no candidates cannot play at all.
    if (narrowed.length > 0) candidates = narrowed;
    if (narrowCache.size > NARROW_CACHE_LIMIT) narrowCache.clear();
    narrowCache.set(key, candidates);
  }
  return [...candidates];
}

/** Pre-guess reveals: vowel count, repeat flag, named letters, pre-set tiles. */
function applyReveals(view: SolverView, pool: readonly string[]): string[] {
  return pool.filter((word) => {
    for (const preset of view.presetTiles) {
      if (word[preset.index] !== preset.letter) return false;
    }
    if (view.revealed.vowelCount !== null) {
      let vowels = 0;
      for (const c of word) if (VOWELS.has(c)) vowels++;
      if (vowels !== view.revealed.vowelCount) return false;
    }
    if (view.revealed.hasRepeat !== null) {
      if ((new Set(word).size !== word.length) !== view.revealed.hasRepeat) return false;
    }
    for (const r of view.revealed.letters) {
      if (word.includes(r.letter) !== r.present) return false;
    }
    return true;
  });
}

/**
 * Shannon entropy of the feedback-pattern partition a guess induces.
 *
 * Delegates to the typed-array scorer in `entropy.ts`, which is differentially
 * tested against the engine's reference scorer. The straightforward Map-of-
 * strings version is ~25x slower and made a 1000-run sweep a 25-minute job.
 */
export function expectedInformation(guess: string, candidates: readonly string[]): number {
  if (candidates.length === 0) return 0;
  const length = candidates[0]!.length as WordLength;
  return entropyOf(encodeOne(guess), encode(candidates, length), scratch);
}

/** Batch form: encodes the candidate set once for the whole search. */
export function rankGuesses(
  pool: readonly string[],
  candidates: readonly string[],
  length: WordLength,
): Array<{ guess: string; bits: number }> {
  const set = encode(candidates, length);
  return pool
    .map((guess) => ({ guess, bits: entropyOf(encodeOne(guess), set, scratch) }))
    .sort((a, b) => b.bits - a.bits || (a.guess < b.guess ? -1 : 1));
}

/**
 * The fixed opener, computed once per length and cached for the process.
 *
 * Cached by LENGTH, not by candidate set: the full-list computation is O(n²)
 * (~1.1M scorings at length 5) and keying it on the candidate set would recompute
 * it on every word that opens with a reveal, which is most of them once the
 * player holds Lexicon. Narrowed openings use the ordinary search instead.
 */
export function opener(length: WordLength, pool: readonly string[]): string {
  const key = String(length);
  const cached = openerCache.get(key);
  if (cached) return cached;

  // Full entropy over the whole list is O(n²) and only paid once per process.
  const best = rankGuesses(pool, pool, length)[0]!.guess;
  openerCache.set(key, best);
  return best;
}

export interface SolverDeps {
  cfg: SolverConfig;
  /** [0,1) draws. The harness addresses these so a solver run is replayable. */
  rng: (index: number) => number;
}

/**
 * The bot's vocabulary. `vocabularyGap` drops a deterministic slice of the
 * solution list, modelling a player who does not know some of the words.
 *
 * `preferred` and `all` are both returned, and the solver falls back to `all`
 * when `preferred` runs dry. That fallback is the whole point: a gap that
 * simply removes the answer makes the word UNSOLVABLE, which turns a handicap
 * into a wall — a 9% gap then means 9% of words cost the entire remaining pool,
 * and the mean guesses-per-word rises for a reason that has nothing to do with
 * how a human plays. A human who does not know a word still gets there from the
 * constraints, a couple of guesses later. That is what this models.
 */
export interface Vocabulary {
  preferred: string[];
  all: string[];
}

export function knownSolutions(
  length: WordLength,
  cfg: SolverConfig,
  rng: (i: number) => number,
): Vocabulary {
  const all = [...wordList(length).solutions];
  if (cfg.vocabularyGap <= 0) return { preferred: all, all };
  return { preferred: all.filter((_, i) => rng(i) >= cfg.vocabularyGap), all };
}

export interface SolverChoice {
  guess: string;
  candidatesRemaining: number;
  /** True when the bot's candidate set no longer contains the real answer. */
  lostTheAnswer: boolean;
}

export function chooseGuess(
  view: SolverView,
  vocab: Vocabulary,
  deps: SolverDeps,
  solution: string,
): SolverChoice {
  const locked = new Set(view.locked);
  const legal = (w: string) => ![...w].some((c) => locked.has(c));

  // Never repeat a guess. Two things make this load-bearing rather than tidy:
  // a repeated guess buys no information at all, and when the candidate set has
  // been relaxed (below) the same guess would otherwise be re-chosen every turn
  // until the pool runs out.
  const alreadyGuessed = new Set(view.board.rows.map((r) => r.guess));
  const narrow = (pool: readonly string[]) =>
    filterCandidates(view, pool).filter((w) => legal(w) && !alreadyGuessed.has(w));

  let candidates = narrow(vocab.preferred);
  if (candidates.length === 0) candidates = narrow(vocab.all);
  const lostTheAnswer = !candidates.includes(solution);

  if (candidates.length === 0) {
    // Every candidate is locked out, eliminated or already tried: probe with
    // any legal word that has not been guessed.
    const fallback =
      vocab.all.find((w) => legal(w) && !alreadyGuessed.has(w)) ?? vocab.all[0]!;
    return { guess: fallback, candidatesRemaining: 0, lostTheAnswer: true };
  }
  if (candidates.length <= 2) {
    return { guess: candidates[0]!, candidatesRemaining: candidates.length, lostTheAnswer };
  }

  // An unconstrained opening is the same every time; take the precomputed one.
  if (view.board.rows.length === 0 && candidates.length === vocab.preferred.length) {
    const first = opener(view.length, candidates);
    if (legal(first)) return { guess: first, candidatesRemaining: candidates.length, lostTheAnswer };
  }

  // The handicap: a human plays a word they think might be the answer rather
  // than the one that splits the space best.
  //
  // Rolled BEFORE the entropy search, not after. Ranking two hundred guesses
  // and then throwing the ranking away is most of the harness's runtime at a
  // high handicap, and at the calibrated setting the ranking is discarded
  // almost every turn.
  const turn = view.board.rows.length;
  if (deps.rng(turn) < deps.cfg.suboptimality) {
    const pick = Math.floor(deps.rng(1000 + turn) * candidates.length);
    return {
      guess: candidates[Math.min(pick, candidates.length - 1)]!,
      candidatesRemaining: candidates.length,
      lostTheAnswer,
    };
  }

  const searchPool = candidates.slice(0, deps.cfg.searchWidth);
  const scored = rankGuesses(searchPool, candidates, view.length);
  return { guess: scored[0]!.guess, candidatesRemaining: candidates.length, lostTheAnswer };
}

/**
 * ⚠ THE DECAY CAVEAT — repeat this in every report.
 *
 * The bot has perfect memory and pays no Decay cost. Decay is a memory tax on
 * humans only, so simulation systematically OVERRATES the player on Decay
 * words. Do not tune Decay from sim data. `memoryDecay` models a slice of it
 * and is not a substitute for playtesting.
 */
export const DECAY_CAVEAT =
  'Decay is a memory tax on humans only; the solver has perfect recall. ' +
  'Do not tune Decay from these numbers.';
