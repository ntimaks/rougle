'use client';

import type { Tile as EngineTile } from '@/lib/engine';
import { TILE, tileVisual } from './tileStyles';
import { useMotion } from '@/lib/store/useMotion';

/**
 * CMP.02 — the tile. Nine states, and the corruption language.
 *
 * It renders `FeedbackResult.tiles[n]` verbatim and derives nothing. If this
 * component ever computes a state, Liar Letter breaks (AGENTS.md §8).
 *
 * Untrustworthy is a TEXTURE, not a colour, so it composes with whatever state
 * is underneath — Liar Letter and Rangefinder have to stay legible together.
 */
export function Tile({
  tile,
  typedLetter,
  index,
  animate: shouldAnimate = false,
}: {
  tile: EngineTile;
  /** What the player typed, for when Rangefinder withholds the identity. */
  typedLetter?: string;
  index: number;
  animate?: boolean;
}) {
  const { animate } = useMotion();
  const visual = tileVisual(tile.state, tile.trustworthy, tile.distance !== null, !!typedLetter);
  const flip = shouldAnimate && animate;

  return (
    <div
      className={`relative flex aspect-square max-h-[62px] flex-1 items-center justify-center overflow-hidden border font-mono text-[24px] font-bold leading-none ${TILE[visual]}`}
      style={flip ? { animation: 'rg-flip 180ms steps(3,end)', animationDelay: `${index * 55}ms` } : undefined}
      aria-label={ariaFor(tile, typedLetter)}
    >
      {/*
        R-002: the rangefinder tile renders its DISTANCE and no glyph. That is
        the whole trade the relic makes — distance in exchange for identity —
        and CMP.02's specimen still draws a character, which is the filed bug.
      */}
      {tile.distance !== null ? tile.distance : (tile.letter ?? typedLetter ?? '')}

      {!tile.trustworthy && (
        <>
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg,rgba(238,238,238,.55) 0 1px,transparent 1px 3px)',
            }}
            aria-hidden
          />
          {animate && (
            <div
              className="pointer-events-none absolute left-0 right-0 h-[6px]"
              style={{
                background: 'rgba(238,238,238,.22)',
                animation: 'rg-scan 1.9s linear infinite',
              }}
              aria-hidden
            />
          )}
        </>
      )}
    </div>
  );
}

/** The tile's meaning in words, because colour is never the only carrier. */
function ariaFor(tile: EngineTile, typedLetter?: string): string {
  const letter = tile.letter ?? typedLetter ?? '';
  if (tile.state === 'HIDDEN') return 'withheld';
  if (tile.state === 'UNKNOWN') return `${letter}, decayed`;
  const state =
    tile.state === 'GREEN' ? 'correct' : tile.state === 'YELLOW' ? 'present' : 'absent';
  const distance = tile.distance !== null ? `, ${tile.distance} positions away` : '';
  const lie = tile.trustworthy ? '' : ', untrustworthy';
  return `${letter} ${state}${distance}${lie}`;
}
