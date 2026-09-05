import type { TileState } from '@/lib/engine';

/**
 * CMP.02's tile states, as a STATIC map. Tailwind cannot see runtime-assembled
 * class names, and the one thing that must never silently break is tile colour
 * (technical brief §1.4).
 *
 * Every value here resolves to a NIKOLASS token or the game-local `--g-*` layer
 * through `@theme inline` in globals.css. A hex literal in this file, or any
 * other file under /components, is a review rejection.
 */
export type TileVisualState =
  | 'EMPTY'
  | 'TYPED'
  | 'ABSENT'
  | 'PRESENT'
  | 'CORRECT'
  | 'RANGEFINDER'
  | 'UNTRUSTWORTHY'
  | 'DEFERRED'
  | 'DECAYED';

export const TILE: Record<TileVisualState, string> = {
  EMPTY: 'bg-transparent text-fg0 border-dark2',
  TYPED: 'bg-transparent text-fg0 border-fg0',
  ABSENT: 'bg-absent text-fg3 border-line',
  PRESENT: 'bg-amber text-ink border-ink',
  CORRECT: 'bg-accent text-ink border-ink',
  // R-002: renders the distance, NO glyph. CMP.02 still draws a character in
  // this state; that is the filed design bug, not a licence to draw one here.
  RANGEFINDER: 'bg-amber text-ink border-ink',
  UNTRUSTWORTHY: 'bg-dark2 text-fg0 border-fg0',
  DEFERRED: 'bg-sunken text-absent-fg border-dark2',
  // §13 I-01: MECHANICS.md §4.2 defines UNKNOWN and Decay reverts GREEN to it,
  // but CMP.02 specifies only eight states and none of them is UNKNOWN.
  // Rendering it as TYPED would make a submitted row look unsubmitted, so this
  // placeholder is deliberately distinct and deliberately unfinished.
  DECAYED: 'bg-transparent text-fg2 border-line-strong border-dashed',
};

/** Maps an engine tile to its CMP.02 specimen. */
export function tileVisual(
  state: TileState,
  trustworthy: boolean,
  hasDistance: boolean,
  typed: boolean,
): TileVisualState {
  if (state === 'HIDDEN') return 'DEFERRED';
  if (state === 'UNKNOWN') return 'DECAYED';
  if (!trustworthy) return 'UNTRUSTWORTHY';
  if (state === 'YELLOW') return hasDistance ? 'RANGEFINDER' : 'PRESENT';
  if (state === 'GREEN') return 'CORRECT';
  if (state === 'GREY') return 'ABSENT';
  return typed ? 'TYPED' : 'EMPTY';
}
