'use client';

import type { BoardRow } from '@/lib/engine';
import { Tile } from './Tile';
import { TILE } from './tileStyles';

/**
 * The board. Renders `projectBoard` output verbatim — one row per guess, and
 * under Mirror one row per SOLUTION per guess, because MECHANICS.md §7.1 says
 * two independent results with no merging.
 *
 * The empty rows below are not padding: the number of rows a player can still
 * afford is information, so the grid shows the shape of the word and the
 * current attempt, and stops. It does not pretend to a fixed six-row Wordle
 * board, because the budget is not six.
 */
export function Grid({
  rows,
  length,
  typed,
  solutionCount,
  latestBatchId,
}: {
  rows: readonly BoardRow[];
  length: number;
  typed: string;
  solutionCount: number;
  latestBatchId: number;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-[5px] px-4 py-[14px]">
      {rows.map((row) => (
        <div key={row.turn} className="flex flex-col gap-[5px]">
          {row.results.map((result, solutionIndex) => (
            <div key={solutionIndex} className="flex gap-[5px]">
              {solutionCount > 1 && (
                <span
                  className="flex w-[14px] flex-none items-center justify-center font-mono text-[9px] text-fg3"
                  aria-label={`solution ${solutionIndex === 0 ? 'A' : 'B'}`}
                >
                  {solutionIndex === 0 ? 'A' : 'B'}
                </span>
              )}
              {result.tiles.map((tile, i) => (
                <Tile
                  key={i}
                  tile={tile}
                  typedLetter={row.guess[i]}
                  index={i}
                  animate={row.turn === rows.length - 1}
                />
              ))}
            </div>
          ))}
        </div>
      ))}

      {/* The row being typed. */}
      <div className="flex gap-[5px]" key={`typing-${latestBatchId}`}>
        {solutionCount > 1 && <span className="w-[14px] flex-none" aria-hidden />}
        {Array.from({ length }, (_, i) => (
          <div
            key={i}
            className={`flex aspect-square max-h-[62px] flex-1 items-center justify-center border font-mono text-[24px] font-bold leading-none ${
              typed[i] ? TILE.TYPED : TILE.EMPTY
            }`}
          >
            {typed[i] ?? ''}
          </div>
        ))}
      </div>
    </div>
  );
}
