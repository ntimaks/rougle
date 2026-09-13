'use client';

import { REGISTRY, type ScalingCounter } from '@/lib/engine';
import { RARITY_TEXT, glyphFor } from './rarity';
import { useMotion } from '@/lib/store/useMotion';

/**
 * CMP.04's chip state — the same object at 28px with the description dropped.
 * Never two truths about one relic: the chip and the card read from the same
 * registry entry.
 *
 * §6.5 requires a scaling relic's counter to be visible AT ALL TIMES, so it is
 * on the chip and not only in the drawer — the drawer is a thing you open, and
 * a number you have to go and look for is not what "always visible" means. It
 * is the one piece of per-instance state the chip carries.
 *
 * v1.3's chip also rendered a SUPPRESSED state for §6.3's information cap.
 * §6.2 removed the cap at five slots, so nothing suppresses anything and the
 * state is gone with it.
 */
export function RelicChip({
  code,
  onTap,
  /** §6.5's run-long counter, for the six relics that carry one. */
  counter = null,
  /** What this relic just did, if it fired in the current batch. */
  fired = null,
  batchId = 0,
}: {
  code: string;
  onTap?: () => void;
  counter?: ScalingCounter | null;
  fired?: string | null;
  batchId?: number;
}) {
  const { animate } = useMotion();
  const def = REGISTRY[code];
  if (!def) return null;

  const label = counter ? `${def.name} — ${counter.label} ${counter.value}` : def.name;

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={!onTap}
      title={counter ? `${def.rule}\n\n${counter.label}: ${counter.value}` : def.rule}
      aria-label={label}
      // Keyed on the batch so the flash restarts on every dispatch: a relic
      // that fires twice in a row must read as twice, not as still-on.
      key={fired ? `fired-${batchId}` : 'idle'}
      className={`relative flex h-[28px] flex-none items-center gap-[5px] border px-[6px] font-mono text-[9px] leading-none tracking-[0.1em] ${
        fired ? 'border-accent text-fg0' : 'border-line-strong text-fg1'
      }`}
      style={
        fired && animate
          ? { animation: 'rg-fire 620ms cubic-bezier(0.2,0.8,0.2,1) both' }
          : undefined
      }
    >
      <span className={RARITY_TEXT[def.rarity]} aria-hidden>
        {glyphFor(def)}
      </span>
      <span className="max-w-[86px] truncate">{def.name}</span>
      {counter && (
        // The number, not the effect it produces. §6.5's point is that the
        // counter is the thing being built; the rule text says what it buys.
        <span
          className={`flex-none border-l border-current pl-[5px] font-bold ${
            counter.cap !== null && counter.value >= counter.cap ? 'text-amber' : 'text-accent'
          }`}
        >
          {counter.value}
          {counter.cap !== null && counter.value >= counter.cap && '·MAX'}
        </span>
      )}
      {fired && (
        <span
          className="pointer-events-none absolute -top-[13px] left-0 whitespace-nowrap font-mono text-[9px] font-bold leading-none text-accent"
          style={animate ? { animation: 'rg-cost 620ms cubic-bezier(0.2,0.8,0.2,1) both' } : undefined}
        >
          {fired}
        </span>
      )}
    </button>
  );
}
