/**
 * Feedback types. MECHANICS.md §4.2 is normative for the shape; this file only
 * types it and adds the dev-time freeze that keeps transforms honest.
 */

export type TileState = 'GREEN' | 'YELLOW' | 'GREY' | 'UNKNOWN' | 'HIDDEN';

export interface Tile {
  /**
   * `null` when identity is withheld (Rangefinder, R-002). Load-bearing: the
   * grid, the keyboard derivation, the solver and the share string must all
   * handle it. Anything that assumes a string here is a bug waiting for a
   * Rangefinder run.
   */
  letter: string | null;
  state: TileState;
  /** Rangefinder only: how many positions off the letter sits. */
  distance: number | null;
  /** false → the corruption texture. Liar Letter sets this. */
  trustworthy: boolean;
}

export interface FeedbackMeta {
  vowelCount: number | null;
  hasRepeat: boolean | null;
  revealedLetters: Array<{ index: number; letter: string }>;
  deferred: boolean;
  /**
   * Guesses until a deferred row speaks; null when it already has.
   *
   * Deferral is a designed cost — the Cipher makes you commit three guesses
   * before you learn anything. Not knowing WHEN a row resolves is incidental
   * friction on top of it, and it reads as the board being broken rather than
   * as a mechanic. Raised from playtest: "it seems like it's delayed, is that
   * the whole point?"
   */
  revealsIn: number | null;
}

export interface FeedbackResult {
  tiles: Tile[];
  meta: FeedbackMeta;
}

export const IN_DEV = process.env.NODE_ENV !== 'production';

/**
 * Deep-freezes a FeedbackResult in dev (E-02). A transform that mutates its
 * input rather than returning a new result throws here instead of producing a
 * board that disagrees with `GuessRecord.raw` three transforms later.
 */
export function freezeFeedback<T extends FeedbackResult>(fb: T): T {
  if (!IN_DEV) return fb;
  fb.tiles.forEach(Object.freeze);
  Object.freeze(fb.tiles);
  Object.freeze(fb.meta.revealedLetters);
  Object.freeze(fb.meta);
  return Object.freeze(fb);
}

/** Structural copy. Transforms build on this rather than mutating. */
export function cloneFeedback(fb: FeedbackResult): FeedbackResult {
  return {
    tiles: fb.tiles.map((t) => ({ ...t })),
    meta: { ...fb.meta, revealedLetters: fb.meta.revealedLetters.map((r) => ({ ...r })) },
  };
}

/** Compact debug rendering: G/Y/X/?/·, one char per tile. */
export function renderStates(fb: FeedbackResult): string {
  const glyph: Record<TileState, string> = {
    GREEN: 'G',
    YELLOW: 'Y',
    GREY: 'X',
    UNKNOWN: '?',
    HIDDEN: '·',
  };
  return fb.tiles.map((t) => glyph[t.state]).join('');
}
