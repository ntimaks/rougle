'use client';

import { REGISTRY, type RelicDef } from '@/lib/engine';
import { RARITY_SPINE, RARITY_TEXT, glyphFor } from './rarity';
import { useMotion } from '@/lib/store/useMotion';

/**
 * CMP.04 — the relic card, in its offer state.
 *
 * The card prints its own hook. If a relic cannot name one, the hook list is
 * incomplete — the design made that visible on purpose, and it is the same rule
 * the engine enforces (AGENTS.md non-negotiable 6).
 *
 * It also prints the synergy line the sheet asks for: accent for a synergy,
 * vermillion for an anti-synergy, amber for a flagged balance risk. That
 * answers "why is this pile of relics doing nothing?" in the UI rather than in
 * a spreadsheet.
 */
export function RelicCard({
  code,
  held,
  selected,
  dimmed,
  index,
  onTap,
}: {
  code: string;
  held: readonly string[];
  selected: boolean;
  dimmed: boolean;
  index: number;
  onTap: () => void;
}) {
  const { animate } = useMotion();
  const def = REGISTRY[code];
  if (!def) return null;

  const synergy = synergyLine(def, held);

  return (
    <button
      type="button"
      onClick={onTap}
      aria-pressed={selected}
      className={`block w-full border text-left transition-[transform,box-shadow,opacity] duration-[120ms] ease-linear active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
        selected ? 'border-fg0 bg-strip shadow-[3px_3px_0_0_var(--dark-fg-0)]' : 'border-dark3 bg-panel'
      } ${dimmed ? 'opacity-40' : 'opacity-100'}`}
      style={
        animate
          ? { animation: 'rg-draw 200ms cubic-bezier(0.2,0.8,0.2,1) both', animationDelay: `${index * 90}ms` }
          : undefined
      }
    >
      <div className="flex items-stretch border-b border-dark3">
        <div className={`w-[5px] flex-none ${RARITY_SPINE[def.rarity]}`} aria-hidden />
        <div
          className={`flex min-w-0 flex-1 items-center gap-2 px-[10px] py-[9px] ${
            selected ? 'bg-fg0 text-ground' : 'bg-strip text-fg0'
          }`}
        >
          <span className="flex-none font-mono text-[13px]" aria-hidden>
            {glyphFor(def)}
          </span>
          <span className="truncate font-mono text-[12px] font-bold leading-none tracking-[0.1em]">
            {def.name}
          </span>
          <span
            className={`ml-auto flex-none border px-[4px] py-[3px] font-mono text-[8px] leading-none tracking-[0.14em] ${
              selected ? 'border-ground' : `border-current ${RARITY_TEXT[def.rarity]}`
            }`}
          >
            {def.rarity}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-[6px] px-[10px] py-[10px]">
        <p className="font-mono text-[11px] leading-[1.5] text-fg1">{def.rule}</p>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[8px] leading-none tracking-[0.14em] text-fg3">
            {def.archetype ?? 'CONSUMABLE'} · {def.hook}
          </span>
          {synergy && (
            <span className={`ml-auto font-mono text-[8px] leading-none tracking-[0.12em] ${synergy.tone}`}>
              {synergy.text}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function synergyLine(
  def: RelicDef,
  held: readonly string[],
): { text: string; tone: string } | null {
  const name = (code: string) => REGISTRY[code]?.name ?? code;

  const anti = (def.anti_synergy ?? []).find((code) => held.includes(code));
  if (anti) return { text: `ANTI · ${name(anti)}`, tone: 'text-red' };

  const synergy = (def.synergy ?? []).find((code) => held.includes(code));
  if (synergy) return { text: `+ ${name(synergy)}`, tone: 'text-accent' };

  if (def.balance_flag) return { text: 'VOLATILE', tone: 'text-amber' };
  return null;
}
