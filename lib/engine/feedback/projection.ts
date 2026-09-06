import { CONFIG } from '../core/config';
import { ALPHABET } from '../core/letters';
import type { GameState, WordState } from '../core/state';
import { hasModifier, hasRelic } from '../core/state';
import { runChain } from './chain';
import { cloneFeedback, type FeedbackResult, type TileState } from './types';

/**
 * Board projection. Technical brief §4.3 — the pass the six-step chain needs.
 *
 * The chain is per-guess. Decay and deferral are not: they are functions of how
 * many turns have elapsed since a row was scored, so the same stored row must
 * render differently at turn 3 than at turn 2. Neither can be a step in a chain
 * that runs once at scoring time.
 *
 * This is consistent with how MECHANICS.md §4.4 already frames deferral —
 * "the full result is computed and stored; it is simply not shown yet" —
 * extended to cover Decay, which has the same shape: content computed once,
 * presentation a function of when you look.
 *
 * Provisional until MECHANICS.md rules §13 I-02. See ADR-0002.
 */

export interface BoardRow {
  guess: string;
  /** One result per solution. Two under Mirror; no merging (MECHANICS.md §7.1). */
  results: FeedbackResult[];
  turn: number;
}

export interface BoardView {
  rows: BoardRow[];
  /** Best-known state per letter, folded from the visible rows. Never stored. */
  keyboard: Record<string, TileState>;
  /** Letters that cannot be typed at all. Gates canDispatch as well as the UI. */
  locked: string[];
  /** Letters proven GREY on visible rows — what RL.02 The Sieve acts on. */
  provenGrey: string[];
}

/** Fog hides row n until n+1 is submitted. The Cipher boss is the same at depth 3. */
export function isDeferred(w: Readonly<WordState>, turn: number, turnNow: number): boolean {
  if (w.deferralDepth <= 0) return false;
  return turn > turnNow - 1 - w.deferralDepth;
}

/**
 * Guesses until a deferred row speaks. The inverse of `isDeferred`, from the
 * same arithmetic: the row resolves once `turnNow` reaches `turn + 1 + depth`.
 *
 * Deferral is a designed cost. Not knowing when it lifts is not — it turns a
 * mechanic into a screen that looks broken, which is how it was reported.
 */
export function revealsIn(w: Readonly<WordState>, turn: number, turnNow: number): number {
  return Math.max(1, turn + 1 + w.deferralDepth - turnNow);
}

/** Every tile HIDDEN, identity withheld, meta flagged deferred. */
export function withhold(fb: FeedbackResult): FeedbackResult {
  const out = cloneFeedback(fb);
  for (const tile of out.tiles) {
    tile.state = 'HIDDEN';
    tile.letter = null;
    tile.distance = null;
  }
  out.meta = { ...out.meta, deferred: true, revealedLetters: [], revealsIn: null };
  return out;
}

/**
 * Decay: a GREEN reverts to UNKNOWN once `decayTurns` have passed.
 *
 * UNKNOWN is a MECHANICS.md §4.2 state with no CMP.02 specimen — rendering it
 * as TYPED would make a submitted row look unsubmitted. Blocked design bug,
 * §13 I-01. The engine emits the correct state regardless; the UI owes it a
 * ninth tile treatment.
 */
export function decayGreens(fb: FeedbackResult): FeedbackResult {
  if (!fb.tiles.some((t) => t.state === 'GREEN')) return fb;
  const out = cloneFeedback(fb);
  for (const tile of out.tiles) if (tile.state === 'GREEN') tile.state = 'UNKNOWN';
  return out;
}

/**
 * The whole board as the player currently sees it. The view renders this
 * verbatim and never re-scores; the keyboard derives from the same payload.
 *
 * `turnNow` is `word.history.length` — the number of guesses submitted so far.
 */
export function projectBoard(
  state: Readonly<GameState>,
  w: Readonly<WordState>,
  turnNow: number = w.history.length,
): BoardView {
  const decaying = hasModifier(w, 'DECAY');

  // Two projections of the same rows. `rows` is what the player sees. `undecayed`
  // is the same board with Decay not applied, and it exists for exactly one
  // reason: RL.02 The Sieve permanently removes letters, and it must never do
  // that on the strength of a tile that only reads GREY because a GREEN next to
  // it faded. A letter shown green in one position and grey in another (the
  // duplicate-letter case) would otherwise become "proven absent" the moment
  // the green decayed, hard-locking a letter the solution needs. Decay is a
  // memory tax, not a source of false proof. See §13 I-18.
  const project = (applyDecay: boolean): BoardRow[] =>
    w.history.map((rec, turn) => ({
      guess: rec.guess,
      turn,
      results: rec.raw.map((raw, solutionIndex) => {
        const fb = runChain({ state, word: w, turn, solutionIndex }, raw);
        if (isDeferred(w, turn, turnNow)) {
          const held = withhold(fb);
          return { ...held, meta: { ...held.meta, revealsIn: revealsIn(w, turn, turnNow) } };
        }
        if (applyDecay && decaying && turn < turnNow - CONFIG.decayTurns) return decayGreens(fb);
        return fb;
      }),
    }));

  const rows = project(true);
  const undecayed = decaying ? project(false) : rows;

  const keyboard = deriveKeyboard(rows, w);
  const provenGrey = deriveProvenGrey(undecayed, w, decaying ? undefined : keyboard);
  const locked = deriveLocked(state, w, provenGrey);
  return { rows, keyboard, locked, provenGrey: [...provenGrey] };
}

/**
 * Best-known state per letter across the visible rows.
 *
 * Under Mirror this folds BOTH solutions' results together and keeps the best,
 * because the keyboard is a memory aid rather than a claim about a specific
 * word (MECHANICS.md §7.1). A letter green in solution A and absent in B shows
 * green on the keyboard and grey in row B, which is correct in both places.
 */
const RANK: Record<TileState, number> = { HIDDEN: 0, UNKNOWN: 1, GREY: 2, YELLOW: 3, GREEN: 4 };

export function deriveKeyboard(
  rows: readonly BoardRow[],
  w: Readonly<WordState>,
): Record<string, TileState> {
  const out: Record<string, TileState> = {};
  for (const row of rows) {
    for (const result of row.results) {
      if (result.meta.deferred) continue;
      result.tiles.forEach((tile, i) => {
        // Rangefinder withholds identity, so fall back to the typed guess: the
        // player knows which letter they typed even when the tile will not say.
        const letter = tile.letter ?? row.guess[i];
        if (!letter) return;
        const current = out[letter];
        if (current === undefined || RANK[tile.state] > RANK[current]) out[letter] = tile.state;
      });
    }
  }
  for (const preset of w.presetTiles) out[preset.letter] = 'GREEN';
  for (const revealed of w.revealed.letters) {
    if (revealed.present) {
      if (out[revealed.letter] === undefined || RANK[out[revealed.letter]!] < RANK.YELLOW) {
        out[revealed.letter] = 'YELLOW';
      }
    } else if (out[revealed.letter] === undefined) {
      out[revealed.letter] = 'GREY';
    }
  }
  return out;
}

/**
 * Letters PROVEN absent. RL.02 The Sieve's input, and the reason it is not just
 * "every grey on the keyboard".
 *
 * A tile can read GREY without proving anything:
 *
 * - Liar Letter sets `trustworthy: false`. A corrupted GREY is not evidence.
 * - Silent Start reports GREY in place of YELLOW on the first guess. Those
 *   greys mean "not green here", not "not in the word".
 *
 * Treating either as proof lets the Sieve hard-lock a letter the solution
 * needs, which makes the word unsolvable with no counterplay — exactly what
 * R-003 forbids for The Moth and the Locked Key modifier. The invariant test in
 * `projection.test.ts` asserts it directly. Raised as §13 I-18.
 */
export function deriveProvenGrey(
  rows: readonly BoardRow[],
  w: Readonly<WordState>,
  keyboard?: Record<string, TileState>,
): Set<string> {
  const best = keyboard ?? deriveKeyboard(rows, w);
  const silentStart = hasModifier(w, 'SILENT_START');
  const proven = new Set<string>();

  for (const [letter, state] of Object.entries(best)) {
    if (state !== 'GREY') continue;
    const hasHonestGrey = rows.some((row, turn) => {
      if (silentStart && turn === 0) return false;
      return row.results.some((result) => {
        if (result.meta.deferred) return false;
        return result.tiles.some(
          (tile, i) =>
            tile.state === 'GREY' && tile.trustworthy && (tile.letter ?? row.guess[i]) === letter,
        );
      });
    });
    if (hasHonestGrey) proven.add(letter);
  }
  return proven;
}

/**
 * Every letter the player cannot type. Three systems feed it — RL.02 The Sieve,
 * the Locked Key modifier and RL.19 The Moth — and they share one predicate so
 * a physical keyboard cannot bypass what the on-screen one enforces.
 */
export function deriveLocked(
  state: Readonly<GameState>,
  w: Readonly<WordState>,
  provenGrey: ReadonlySet<string>,
): string[] {
  const locked = new Set(w.lockedLetters.map((l) => l.letter));
  if (hasRelic(state, 'RL.02')) for (const c of provenGrey) locked.add(c);
  return ALPHABET.filter((c) => locked.has(c));
}
