'use client';

import { useState } from 'react';
import { CHARACTERS, formatSeed, hash32, isImplemented, type CharacterCode } from '@/lib/engine';
import { useGame } from '@/lib/store/useGame';

/**
 * Character select, unstyled. S.01's full treatment is a Phase 2 ticket; this
 * exists so a run can be started at all.
 *
 * The seed is generated HERE, not in the engine: the engine has no clock and no
 * crypto, which is what makes it replayable. Entropy is an input.
 */
export function TitleCard() {
  const dispatch = useGame((s) => s.dispatch);
  const [seed, setSeed] = useState(() => formatSeed(hash32(String(Date.now()))));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col gap-6 border-x border-line-soft p-4">
      <div>
        <p className="text-[10px] tracking-[0.2em] text-fg3">CHOOSE A CHARACTER</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-fg0">ROUGLE</h1>
      </div>

      <label className="flex items-center gap-2 text-xs text-fg2">
        SEED
        <input
          value={seed}
          onChange={(e) => setSeed(e.target.value.toUpperCase().slice(0, 8))}
          className="flex-1 border border-line-strong bg-transparent px-2 py-1 font-mono text-fg0"
          aria-label="Run seed"
        />
        <button
          type="button"
          onClick={() => setSeed(formatSeed(hash32(`${seed}${Date.now()}`)))}
          className="border border-line-strong px-2 py-1 text-fg2"
        >
          ↻
        </button>
      </label>

      <ul className="flex flex-col gap-3">
        {CHARACTERS.map((c) => {
          const playable = isImplemented(c.code);
          return (
            <li key={c.code}>
              <button
                type="button"
                disabled={!playable}
                onClick={() =>
                  dispatch({ type: 'START_RUN', seed, characterCode: c.code as CharacterCode })
                }
                className="flex min-h-[52px] w-full flex-col items-start border border-line-strong px-3 py-2 text-left disabled:opacity-40"
              >
                <span className="text-sm font-bold tracking-[0.14em] text-fg0">
                  {c.name} <span className="text-fg3">{c.code}</span>
                </span>
                <span className="text-xs text-fg2">
                  POOL {c.pool_modifier >= 0 ? `+${c.pool_modifier}` : c.pool_modifier} · {c.innate}
                </span>
                {!playable && (
                  <span className="mt-1 text-[10px] text-red">
                    NOT PLAYABLE — innate blocked by technical brief §13 I-04
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
