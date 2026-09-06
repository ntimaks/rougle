'use client';

import type { WordState } from '@/lib/engine';

/**
 * Letters the player has PAID to learn about this word — RL.07 The Auditor,
 * CH.03 The Cryptographer, RL.26 The Lantern.
 *
 * These were written only into `word.revealed.letters`, where the keyboard
 * picked them up as a faint tint. So a player spent 5g, the drawer closed over
 * the answer, and the verdict was a slightly different shade on one key. From
 * playtest: "when I go from the relic screen it doesn't activate at all."
 *
 * Bought information should be the most legible thing on the board, not the
 * least. It stays for the whole word, because that is how long it is true.
 */
export function StampedLetters({ word }: { word: WordState }) {
  if (word.revealed.letters.length === 0) return null;

  return (
    <div className="flex flex-none flex-wrap items-center gap-[5px] border-b border-line-soft px-3 py-[6px]">
      <span className="font-mono text-[9px] leading-none tracking-[0.16em] text-fg3">STAMPED</span>
      {word.revealed.letters.map(({ letter, present }) => (
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
    </div>
  );
}
