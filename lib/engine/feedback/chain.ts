import { DOMAIN, draw } from '../core/rng';
import type { GameState, WordState } from '../core/state';
import { hasModifier, hasRelic } from '../core/state';
import { cloneFeedback, type FeedbackResult, type TileState } from './types';

/**
 * The transform chain. MECHANICS.md §4.4 fixes the order; this file declares it
 * as a list rather than letting registration order decide.
 *
 * Steps 1→2→3 are the load-bearing part. Corruption runs BEFORE interpretation,
 * so Rangefinder reads distance off the *reported* state and a corrupted tile
 * yields a plausible lie rather than a visible contradiction. Get it backwards
 * and the two relics contradict each other on screen, which reads as a bug.
 *
 * Step 0 is an addition: the Silent Start modifier alters feedback and §4.4 has
 * no slot for it. See ADR-0006 / §13 I-17.
 *
 * Step 5 (deferral) and Decay are NOT here — they are functions of how many
 * turns have passed, not of the guess, so they live in the board projection
 * (§4.3, `projection.ts`).
 */

export interface ChainContext {
  state: Readonly<GameState>;
  word: Readonly<WordState>;
  /** 0-indexed turn of the row being transformed. */
  turn: number;
  solutionIndex: number;
}

export interface TransformStep {
  order: number;
  id: string;
  source: string;
  apply: (ctx: ChainContext, fb: FeedbackResult) => FeedbackResult;
}

const VISIBLE_STATES: TileState[] = ['GREEN', 'YELLOW', 'GREY'];

/** Step 0 — Silent Start. Yellows are withheld on the first guess only. */
function silentStart(ctx: ChainContext, fb: FeedbackResult): FeedbackResult {
  if (!hasModifier(ctx.word, 'SILENT_START') || ctx.turn !== 0) return fb;
  const out = cloneFeedback(fb);
  for (const tile of out.tiles) if (tile.state === 'YELLOW') tile.state = 'GREY';
  return out;
}

/**
 * Step 1 — Truth-roll (RL.28 Shaved Coin). Re-rolls which positions report
 * truthfully. Not implemented: RL.28 is blocked by §13 I-04 and I-05. The step
 * stays declared so the order cannot silently change when it lands.
 */
function truthRoll(_ctx: ChainContext, fb: FeedbackResult): FeedbackResult {
  return fb;
}

/** Which positions lie on this word. `truthMask` wins where RL.28 has set one. */
export function liesAt(word: Readonly<WordState>, index: number): boolean {
  if (word.truthMask) return word.truthMask[index] === false;
  return word.liarIndex === index;
}

/**
 * Step 2 — Corruption (Liar Letter). Flips one position's reported state and
 * sets `trustworthy: false`. RL.29 The Mask skips the step entirely.
 */
function corruption(ctx: ChainContext, fb: FeedbackResult): FeedbackResult {
  if (!hasModifier(ctx.word, 'LIAR_LETTER')) return fb;
  if (hasRelic(ctx.state, 'RL.29')) return fb; // The Mask
  const out = cloneFeedback(fb);
  out.tiles.forEach((tile, i) => {
    if (!liesAt(ctx.word, i)) return;
    const alternatives = VISIBLE_STATES.filter((s) => s !== tile.state);
    const roll = draw(ctx.state.seed, DOMAIN.liar(ctx.word.nodeId), ctx.turn * 100 + i);
    tile.state = alternatives[Math.floor(roll * alternatives.length)]!;
    tile.trustworthy = false;
  });
  return out;
}

/**
 * Step 3 — Distance (RL.04 Rangefinder). YELLOW tiles report how far off the
 * letter sits and stop reporting which letter it is.
 *
 * The true distance is computed at scoring time and stored on the raw result,
 * so this step never sees the solution. For a corrupted tile there is no true
 * distance to report, so it draws one from the values legal for the *reported*
 * state — deterministic, therefore stable under replay.
 */
function distance(ctx: ChainContext, fb: FeedbackResult): FeedbackResult {
  if (!hasRelic(ctx.state, 'RL.04')) {
    // Without the relic the stored distance is not information the player has.
    if (fb.tiles.every((t) => t.distance === null)) return fb;
    const stripped = cloneFeedback(fb);
    for (const tile of stripped.tiles) tile.distance = null;
    return stripped;
  }

  const out = cloneFeedback(fb);
  const length = out.tiles.length;
  out.tiles.forEach((tile, i) => {
    if (tile.state !== 'YELLOW') {
      tile.distance = null;
      return;
    }
    if (!tile.trustworthy || tile.distance === null) {
      const legal = legalDistances(i, length);
      const roll = draw(ctx.state.seed, DOMAIN.liar(ctx.word.nodeId), ctx.turn * 10 + i);
      tile.distance = legal[Math.floor(roll * legal.length)]!;
    }
    tile.letter = null;
  });
  return out;
}

/** Distances a YELLOW at `index` could legally report in a word of `length`. */
export function legalDistances(index: number, length: number): number[] {
  const max = Math.max(index, length - 1 - index);
  return Array.from({ length: max }, (_, k) => k + 1);
}

/**
 * Step 4 — Injection (RL.31 Rosetta, RL.12 Hot Streak, CN.05 Skeleton Key).
 * Pre-set greens are applied to every row, including rows scored before the
 * tile was granted, because the player knows the letter from then on.
 */
function injection(ctx: ChainContext, fb: FeedbackResult): FeedbackResult {
  if (ctx.word.presetTiles.length === 0) return fb;
  const out = cloneFeedback(fb);
  for (const preset of ctx.word.presetTiles) {
    const tile = out.tiles[preset.index];
    if (!tile) continue;
    tile.state = 'GREEN';
    tile.letter = preset.letter;
    tile.distance = null;
    tile.trustworthy = true;
  }
  out.meta = {
    ...out.meta,
    revealedLetters: ctx.word.presetTiles.map((p) => ({ index: p.index, letter: p.letter })),
  };
  return out;
}

/**
 * Steps 5 (deferral) and 6 (derivation) are declared here for completeness but
 * are applied by `projection.ts`: deferral gates presentation on `turnNow`, and
 * derivation produces the keyboard rather than the row.
 */
export const CHAIN: readonly TransformStep[] = Object.freeze([
  { order: 0, id: 'suppression', source: 'MOD:SILENT_START', apply: silentStart },
  { order: 1, id: 'truth-roll', source: 'RL.28', apply: truthRoll },
  { order: 2, id: 'corruption', source: 'MOD:LIAR_LETTER | RL.29', apply: corruption },
  { order: 3, id: 'distance', source: 'RL.04', apply: distance },
  { order: 4, id: 'injection', source: 'RL.31 | RL.12 | CN.05', apply: injection },
]);

/** Runs steps 0–4 in declared order. Deferral and Decay come after, in projection. */
export function runChain(ctx: ChainContext, raw: FeedbackResult): FeedbackResult {
  let fb = raw;
  for (const step of CHAIN) fb = step.apply(ctx, fb);
  return fb;
}

/**
 * Annotates a freshly scored result with true distances, so the Rangefinder
 * transform never needs the solution. Stored on `GuessRecord.raw`: it is truth,
 * and it is withheld from the player unless RL.04 is held.
 */
export function annotateDistances(fb: FeedbackResult, solution: string): FeedbackResult {
  const greenAt = new Set<number>();
  fb.tiles.forEach((t, i) => {
    if (t.state === 'GREEN') greenAt.add(i);
  });
  const out = cloneFeedback(fb);
  out.tiles.forEach((tile, i) => {
    if (tile.state !== 'YELLOW' || tile.letter === null) return;
    let best: number | null = null;
    for (let j = 0; j < solution.length; j++) {
      if (j === i || greenAt.has(j) || solution[j] !== tile.letter) continue;
      const d = Math.abs(j - i);
      if (best === null || d < best) best = d;
    }
    tile.distance = best;
  });
  return out;
}
