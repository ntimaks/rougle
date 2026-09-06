'use client';

import { useState } from 'react';
import { canDispatch, revealBlocker, revealCost, type GameState } from '@/lib/engine';
import { useGame } from '@/lib/store/useGame';

/**
 * The §2.5 reveal ladder, on the word screen.
 *
 * Two things this has to communicate that a plain "buy" button would not:
 *
 * The price is the SECOND price gold has. Emergency guesses come out of the
 * same purse (§2.3), so the strip prints what an out costs beside what a letter
 * costs — the trade is the mechanic, and a player who cannot see both sides of
 * it is not making a decision, they are pressing a button.
 *
 * Legality comes from `revealBlocker`, never re-derived here. The engine's
 * reason is the reason shown, so the disabled state can always say WHY.
 */
export function RevealBar({
  state,
  emergencyCost,
}: {
  state: GameState;
  emergencyCost: number | null;
}) {
  const dispatch = useGame((s) => s.dispatch);
  const [picking, setPicking] = useState(false);

  const blocker = revealBlocker(state);
  const cost = revealCost(state);
  const word = state.word!;
  const known = new Set(word.presetTiles.map((p) => p.index));

  // Rule A is a "not yet", not a "no". Showing a dead control for the whole
  // first guess of every word teaches players to ignore the strip.
  if (blocker?.code === 'REVEAL_UNAVAILABLE' && word.history.length === 0) return null;

  return (
    <div className="flex-none border-t border-line-soft px-3 py-2">
      {picking ? (
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] leading-none tracking-[0.14em] text-fg2">
            WHICH?
          </span>
          <div className="flex flex-1 gap-[5px]">
            {Array.from({ length: word.length }, (_, i) => {
              const legal = canDispatch(state, { type: 'BUY_REVEAL', index: i }) === null;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!legal}
                  onClick={() => {
                    dispatch({ type: 'BUY_REVEAL', index: i });
                    setPicking(false);
                  }}
                  aria-label={`Reveal position ${i + 1}`}
                  className={`flex aspect-square flex-1 items-center justify-center border font-mono text-[13px] font-bold leading-none ${
                    legal
                      ? 'border-accent text-accent'
                      : 'cursor-not-allowed border-line-soft text-fg3'
                  }`}
                >
                  {known.has(i) ? '·' : i + 1}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setPicking(false)}
            className="font-mono text-[9px] leading-none tracking-[0.14em] text-fg3 underline"
          >
            CANCEL
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={blocker !== null}
            onClick={() => setPicking(true)}
            className={`flex min-h-[30px] items-center gap-2 border px-3 font-mono text-[11px] font-bold leading-none tracking-[0.12em] transition-[transform,box-shadow] duration-[120ms] ease-linear active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
              blocker
                ? 'cursor-not-allowed border-line-strong text-fg3'
                : 'border-fg0 text-fg0 shadow-[2px_2px_0_0_var(--line-strong)]'
            }`}
          >
            <span>REVEAL</span>
            {cost !== null && <span className="text-accent">{cost}g</span>}
          </button>

          <span className="font-mono text-[9px] leading-none tracking-[0.12em] text-fg3">
            {blocker
              ? // Verbatim, not uppercased: the engine's messages carry a gold
                // amount, and "20G NEEDED" reads as a different unit.
                blocker.message
              : emergencyCost !== null
                ? // The whole point of the strip: the same gold buys a guess.
                  `${'//'} A GUESS COSTS ${emergencyCost}g`
                : `${'//'} NO GUESSES LEFT TO BUY`}
          </span>

          <span className="ml-auto font-mono text-[11px] font-bold leading-none text-accent">
            {state.gold}g
          </span>
        </div>
      )}
    </div>
  );
}
