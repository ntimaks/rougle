'use client';

import { REGISTRY } from '@/lib/engine';
import { RARITY_TEXT, glyphFor } from './rarity';

/**
 * CMP.04's chip state — the same object at 28px with the description dropped.
 * Never two truths about one relic: the chip and the card read from the same
 * registry entry.
 *
 * A suppressed relic (MECHANICS.md §6.3's information cap) dims and says so.
 * That is the only way a player finds out their third reveal relic is doing
 * nothing.
 */
export function RelicChip({
  code,
  suppressed = false,
  onTap,
}: {
  code: string;
  suppressed?: boolean;
  onTap?: () => void;
}) {
  const def = REGISTRY[code];
  if (!def) return null;

  const label = suppressed ? `${def.name} — suppressed by the information cap` : def.name;

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={!onTap}
      title={suppressed ? `${def.rule} — SUPPRESSED: at most 2 pre-guess reveals per word (§6.3)` : def.rule}
      aria-label={label}
      className={`flex h-[28px] flex-none items-center gap-[5px] border px-[6px] font-mono text-[9px] leading-none tracking-[0.1em] ${
        suppressed ? 'border-dark2 text-fg3 opacity-50' : 'border-line-strong text-fg1'
      }`}
    >
      <span className={suppressed ? '' : RARITY_TEXT[def.rarity]} aria-hidden>
        {glyphFor(def)}
      </span>
      <span className="max-w-[86px] truncate">{def.name}</span>
      {suppressed && <span className="text-red" aria-hidden>✕</span>}
    </button>
  );
}
