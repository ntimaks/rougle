'use client';

import type { WordState } from '@/lib/engine';

/**
 * Everything the player KNOWS about this word without having guessed it —
 * RL.07 The Auditor, CH.03 The Cryptographer, RL.26 The Lantern, and the §2.5
 * reveals and relic presets that fix a letter to a position.
 *
 * Two claims, kept apart because they are different claims:
 *
 * - STAMPED — "this letter is in the word" / "is not". `word.revealed.letters`.
 * - KNOWN — "position 3 is an S". `word.presetTiles`.
 *
 * The second used to have no display of its own: it was stamped over the board
 * instead, greening the tile at that index in every row. R-036 stopped that,
 * because a row is what a guess scored and overwriting it destroyed a YELLOW,
 * ate the Rangefinder distance, and under Mirror asserted solution A's letter
 * on solution B's row. So it is shown here, as its own thing, which is also
 * what it was asked for: "those given answers that are not related to the
 * actual previous guesses should be displayed differently."
 *
 * Bought information should be the most legible thing on the board, not the
 * least. It stays for the whole word, because that is how long it is true.
 */
export function StampedLetters({ word }: { word: WordState }) {
  const stamped = word.revealed.letters;
  const known = word.presetTiles;
  if (stamped.length === 0 && known.length === 0) return null;
  // Under Mirror a known letter is true of ONE solution (§7.2, R-036), so it
  // has to say which. With one solution there is nothing to disambiguate.
  const twinned = word.solutions.length > 1;

  return (
    <div className="flex flex-none flex-wrap items-center gap-[5px] border-b border-line-soft px-3 py-[6px]">
      {stamped.length > 0 && (
        <span className="font-mono text-[9px] leading-none tracking-[0.16em] text-fg3">STAMPED</span>
      )}
      {stamped.map(({ letter, present }) => (
        <span
          key={letter}
          className={`flex items-center gap-[3px] border px-[5px] py-[3px] font-mono text-[9px] font-bold leading-none tracking-[0.1em] ${
            present ? 'border-accent text-accent' : 'border-line-strong text-fg3 line-through'
          }`}
        >
          {letter}
          <span className="tracking-[0.14em]">{present ? 'IN' : 'OUT'}</span>
        </span>
      ))}

      {known.length > 0 && (
        <span className="font-mono text-[9px] leading-none tracking-[0.16em] text-fg3">KNOWN</span>
      )}
      {[...known]
        .sort((a, b) => a.solutionIndex - b.solutionIndex || a.index - b.index)
        .map((p) => (
          <span
            key={`${p.solutionIndex}:${p.index}`}
            className="flex items-center gap-[4px] border border-accent px-[5px] py-[3px] font-mono text-[9px] font-bold leading-none tracking-[0.1em] text-accent"
            aria-label={`${twinned ? `solution ${p.solutionIndex === 0 ? 'A' : 'B'}, ` : ''}position ${p.index + 1} is ${p.letter}`}
          >
            {twinned && <span className="text-fg3">{p.solutionIndex === 0 ? 'A' : 'B'}</span>}
            <span className="text-fg2">{p.index + 1}</span>
            {p.letter}
          </span>
        ))}
    </div>
  );
}
