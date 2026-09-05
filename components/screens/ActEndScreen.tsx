'use client';

import { useEffect, useState } from 'react';
import { CONFIG, type GameState } from '@/lib/engine';
import { Button } from '@/components/cmp/Button';
import { StatCell } from '@/components/cmp/StatCell';
import { useGame } from '@/lib/store/useGame';
import { useMotion } from '@/lib/store/useMotion';

/**
 * CMP.10 — the act-end receipt.
 *
 * The conversion counts: leftover guesses tick DOWN while gold ticks UP, 40ms
 * a step. That is the whole point of the screen — the conversion has to read as
 * a trade, not a total. A player who hoarded eight guesses should watch eight
 * guesses become gold, not be told the sum.
 */
const STEP_MS = 40;

export function ActEndScreen({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch);
  const { animate } = useMotion();
  const receipt = state.actReceipt;
  const [step, setStep] = useState(() => (animate ? 0 : (receipt?.leftover ?? 0)));

  const leftover = receipt?.leftover ?? 0;
  const rate = receipt?.rate ?? CONFIG.goldPerLeftoverGuess;

  useEffect(() => {
    if (!animate || step >= leftover) return;
    const timer = setTimeout(() => setStep((n) => n + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [animate, step, leftover]);

  const guessesLeft = leftover - step;
  const goldSoFar = Math.round(step * rate);
  const boosted = rate > CONFIG.goldPerLeftoverGuess;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 py-5">
      <div className="flex-none">
        <p className="font-mono text-[9px] leading-none tracking-[0.2em] text-fg2">
          ACT {['I', 'II', 'III'][receipt?.actIndex ?? 0]} CLEARED
        </p>
        <h1 className="mt-[7px] font-display text-[30px] font-bold uppercase leading-none tracking-[-0.02em]">
          The reckoning
        </h1>
        <p className="mt-3 font-mono text-[11px] leading-[1.6] text-fg2">
          What you did not spend converts at {rate}g a guess
          {boosted ? ' — The Ledger is paying above the going rate.' : '.'}
        </p>
      </div>

      <div className="mt-5 grid flex-none grid-cols-2 gap-[6px]">
        <StatCell
          label="GUESSES LEFT"
          value={String(guessesLeft)}
          tone={guessesLeft > 0 ? 'text-accent' : 'text-fg3'}
        />
        <StatCell label="CONVERTED" value={`${goldSoFar}g`} tone="text-amber" />
      </div>

      <div className="mt-4 flex-none border border-dark3 bg-panel px-3 py-[10px]">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[8px] leading-none tracking-[0.18em] text-fg2">
            GOLD IN HAND
          </span>
          <span className="font-pixel text-[28px] leading-[0.85] text-amber">{state.gold}g</span>
        </div>
      </div>

      <div className="mt-auto pt-6">
        <Button primary arrow onClick={() => dispatch({ type: 'ADVANCE' })}>
          ENTER ACT {['II', 'III'][receipt?.actIndex ?? 0] ?? 'III'}
        </Button>
      </div>
    </div>
  );
}
