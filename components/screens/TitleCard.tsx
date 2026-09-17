'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CHARACTERS, formatSeed, hash32, isImplemented, type CharacterCode } from '@/lib/engine';
import { useGame } from '@/lib/store/useGame';
import { useMotion } from '@/lib/store/useMotion';

/**
 * S.02 — character select. "Pick a hand" sets the act pool and one innate
 * rule, locked for the run. Tap selects a card; the footer button only turns
 * live once a hand is chosen (component sheet: select-then-commit, never a
 * single tap that spends the run).
 *
 * The seed is generated HERE, not in the engine: the engine has no clock and
 * no crypto, which is what makes it replayable. Entropy is an input.
 */
const SKIN: Record<string, { glyph: string; hue: string; fig: string; archLabel: string }> = {
  'CH.01': { glyph: '◇', hue: 'text-accent', fig: 'FIG.01', archLabel: 'INFORMATION' },
  'CH.02': { glyph: '✦', hue: 'text-magenta', fig: 'FIG.02', archLabel: 'RISK' },
  'CH.03': { glyph: '◈', hue: 'text-blue', fig: 'FIG.03', archLabel: 'INFORMATION' },
};
const DEFAULT_SKIN = { glyph: '◇', hue: 'text-accent', fig: 'FIG', archLabel: '' };

export function TitleCard() {
  const dispatch = useGame((s) => s.dispatch);
  const { animate } = useMotion();
  const [seed] = useState(() => formatSeed(hash32(String(Date.now()))));
  const [picked, setPicked] = useState<CharacterCode | null>(null);

  const chosen = picked && isImplemented(picked) ? picked : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-none border-b border-dark3 px-4 pb-3 pt-4">
        <span className="font-mono text-[9px] leading-none tracking-[0.2em] text-fg2">STEP 01 / 01</span>
        <h2 className="mt-[6px] font-display text-[26px] font-bold uppercase leading-none tracking-[-0.02em]">
          Pick a hand
        </h2>
        <p className="mt-[6px] font-mono text-[11px] leading-[1.5] text-fg3">
          Loadout sets the act pool and one innate rule. It cannot be changed mid-run.
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-[14px]">
        {CHARACTERS.map((c, i) => {
          const playable = isImplemented(c.code);
          const selected = picked === c.code;
          const skin = SKIN[c.code] ?? DEFAULT_SKIN;
          return (
            <button
              key={c.code}
              type="button"
              disabled={!playable}
              onClick={() => setPicked(c.code as CharacterCode)}
              aria-pressed={selected}
              style={animate ? { animationDelay: `${i * 70}ms` } : undefined}
              className={`block w-full border text-left transition-[transform,box-shadow] duration-[120ms] ease-linear active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40 ${
                selected
                  ? 'border-fg0 bg-strip shadow-[3px_3px_0_0_var(--dark-fg-0)]'
                  : 'border-dark3 bg-panel'
              } ${animate ? 'animate-[rg-draw_180ms_cubic-bezier(0.2,0.8,0.2,1)_both]' : ''}`}
            >
              <div
                className={`flex items-center gap-2 border-b px-[10px] py-[7px] ${
                  selected ? 'border-fg0 bg-fg0 text-ground' : 'border-dark3 bg-strip text-fg1'
                }`}
              >
                <span className="font-mono text-[10px] font-bold leading-none tracking-[0.16em]">
                  {c.name}
                </span>
                <span className="ml-auto font-mono text-[9px] leading-none tracking-[0.1em] opacity-70">
                  {c.code}
                </span>
              </div>

              <div className="flex gap-[10px] px-[10px] py-3">
                <div className="relative flex h-[66px] w-[54px] flex-none items-center justify-center border border-dark3 bg-chrome">
                  <span className={`font-pixel text-[30px] leading-none ${skin.hue}`}>{skin.glyph}</span>
                  <span className="absolute -bottom-px -left-px border border-dark3 bg-chrome px-[3px] py-[2px] font-mono text-[7px] leading-none tracking-[0.1em] text-fg3">
                    {skin.fig}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
                  <div className="flex flex-wrap gap-[5px]">
                    <span className={`border px-[5px] py-[3px] font-mono text-[9px] leading-none tracking-[0.1em] ${skin.hue}`} style={{ borderColor: 'currentColor' }}>
                      BANKROLL {c.bankroll_start}
                    </span>
                    {skin.archLabel && (
                      <span className="border border-fg3 px-[5px] py-[3px] font-mono text-[9px] leading-none tracking-[0.1em] text-fg2">
                        {skin.archLabel}
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[11px] leading-[1.45] text-fg1">{c.innate}</p>
                  {!playable && (
                    <span className="font-mono text-[10px] leading-none text-red">NOT PLAYABLE YET</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-none items-center gap-[10px] border-t border-dark3 bg-panel px-4 py-3">
        <Link
          href="/"
          className="flex-none border border-fg3 px-3 font-mono text-[11px] leading-none text-fg2 no-underline"
          style={{ minHeight: 46, display: 'flex', alignItems: 'center' }}
        >
          ←
        </Link>
        <button
          type="button"
          disabled={!chosen}
          onClick={() => chosen && dispatch({ type: 'START_RUN', seed, characterCode: chosen })}
          className={`flex min-h-[46px] flex-1 items-center justify-between px-[14px] font-mono text-[13px] font-bold leading-none tracking-[0.14em] transition-[transform,box-shadow] duration-[120ms] ease-linear active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
            chosen
              ? 'border border-ink bg-accent text-ink shadow-[3px_3px_0_0_var(--dark-fg-0)]'
              : 'cursor-not-allowed border border-line-strong bg-transparent text-fg3'
          }`}
        >
          <span>{chosen ? 'ENTER ACT I' : 'PICK A HAND'}</span>
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}
