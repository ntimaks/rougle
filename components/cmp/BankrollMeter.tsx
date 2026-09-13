'use client';

import { useMotion } from '@/lib/store/useMotion';

/**
 * CMP.01 — the bankroll meter. §2.1: "the health bar, the clock and the score
 * at once. It must never leave the screen."
 *
 * Number AND pips, per the design's own Q1: the number is the exact value a
 * player budgets against, the pip row is the shape of the loss. It is never a
 * smooth percentage bar — discrete segments because the resource is discrete,
 * and a player must be able to count what is left at a glance.
 *
 * `max` is the §2.1 cap of 24 and no longer varies by act — which settles §13
 * I-13, the open question of whether a 17-pip row reads the same as a 24-pip
 * one. There is one row for the whole run now, so a pip is always the same
 * width and the shape of the loss is comparable from word 1 to word 20. That is
 * §2.2's argument rendered: a signal every word requires a stake that persists.
 *
 * Crossing 5 downward turns the whole meter vermillion and starts the screen
 * flicker; crossing upward clears both immediately. The tension is chromatic,
 * not modal — nothing else changes.
 */
export const CRITICAL_AT = 5;

export function BankrollMeter({
  value,
  max,
  batchId,
  compact = false,
  trailing,
}: {
  value: number;
  max: number;
  /** Restarts the tick animation when a new event batch lands. */
  batchId: number;
  compact?: boolean;
  /**
   * Rendered at the right of the number row — the gold counter, in the HUD.
   * A slot rather than a sibling so the PIP ROW spans the full width beneath
   * both: the pips are the shape of the loss, and a half-width bar reads as a
   * half-empty one.
   */
  trailing?: React.ReactNode;
}) {
  const { animate } = useMotion();
  const critical = value <= CRITICAL_AT;
  const hue = critical ? 'text-red' : 'text-fg0';
  const pipOn = critical ? 'bg-red border-red' : 'bg-accent border-accent';

  return (
    <div className="flex w-full min-w-0 flex-col gap-[2px]">
      <span className="font-mono text-[9px] leading-none tracking-[0.2em] text-fg2">
        BANKROLL
      </span>
      <div className="flex items-baseline gap-[6px]">
        <span
          // The key restarts rg-tick on every change, which is the whole point:
          // the number must visibly move, not just differ.
          key={batchId}
          className={`font-pixel text-[40px] leading-[0.8] ${hue} ${animate ? 'animate-[rg-tick_120ms_steps(3,end)]' : ''}`}
          aria-label={`${value} guesses left of ${max}`}
        >
          {value}
        </span>
        <span className="font-mono text-[11px] leading-none text-fg3">/{max}</span>
        {critical && (
          <span className="ml-2 flex items-center gap-[5px] font-mono text-[9px] font-bold leading-none tracking-[0.14em] text-red">
            <span
              className={`h-[6px] w-[6px] bg-red ${animate ? 'animate-[rg-pulse_0.7s_steps(1,end)_infinite]' : ''}`}
              aria-hidden
            />
            BANKROLL CRITICAL
          </span>
        )}
        {trailing && <div className="ml-auto">{trailing}</div>}
      </div>

      {!compact && (
        // §2.1 is a HARD cap — anything over it converts to gold immediately —
        // so the row is exactly `max` long and the value can never exceed it.
        // v1.3's R-024 let the pool overflow and the row grew to match; there
        // is nothing to carry now, and the overflow shows as a gold event.
        <div className="mt-[4px] flex h-[11px] gap-[2px]" aria-hidden>
          {Array.from({ length: max }, (_, i) => (
            <div
              key={i}
              className={`flex-1 border ${i < value ? pipOn : 'border-dark3 bg-transparent'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
