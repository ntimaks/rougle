'use client';

import { useMemo, useState } from 'react';
import { CONFIG, activeReveals, currentPool, type GameState } from '@/lib/engine';
import { PoolMeter } from './cmp/PoolMeter';
import { RelicChip } from './cmp/RelicChip';
import { RelicDrawer } from './cmp/RelicDrawer';
import { useGame } from '@/lib/store/useGame';
import { relicFires } from '@/lib/store/relicFire';

/**
 * The persistent chrome and HUD. Read-only, and it lives up top: every primary
 * action sits in the bottom third, within thumb reach.
 *
 * The seed is stamped here at run start and held unchanged through death or
 * victory. It is the run's identity (MECHANICS.md §9).
 */
export function Chrome({ state, batchId }: { state: GameState; batchId: number }) {
  const events = useGame((s) => s.events);
  // One entry per relic that fired in the last dispatch. Relics were "very low
  // feedback" in playtest: the only evidence Tin Cup paid you was a gold
  // counter that was moving anyway.
  const fired = useMemo(
    () => new Map(relicFires(events).map((f) => [f.code, f.label])),
    [events],
  );
  const skip = useGame((s) => s.skipAnimations);
  const setSkip = useGame((s) => s.setSkipAnimations);
  const inGauntlet = state.word?.poolSource === 'GAUNTLET';
  const poolMax = inGauntlet ? CONFIG.gauntlet.pool : state.poolMax;
  const suppressed = new Set(activeReveals(state).suppressed);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <div className="relative z-[6] flex h-[32px] flex-none items-stretch border-b border-dark3 bg-chrome">
        <div className="flex min-w-0 flex-1 items-center gap-[10px] px-3">
          <span className="font-mono text-[10px] font-bold leading-none tracking-[0.2em]">ROUGLE</span>
          <span className="font-mono text-[9px] leading-none tracking-[0.16em] text-fg3">
            ACT {['I', 'II', 'III'][state.actIndex]}
          </span>
          <span className="ml-auto font-mono text-[9px] leading-none tracking-[0.12em] text-fg3">
            {state.seed}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setSkip(!skip)}
          aria-pressed={skip}
          title="Skip animations"
          className="flex-none border-l border-dark3 px-[11px] font-mono text-[9px] leading-none tracking-[0.14em] text-fg2 transition-colors hover:bg-fg0 hover:text-ground"
        >
          {skip ? 'FAST' : 'ANIM'}
        </button>
      </div>

      <div className="relative z-[5] flex-none border-b border-dark3 bg-panel px-3 pb-2 pt-[10px]">
        <div className="mb-[7px]">
          <PoolMeter
            value={currentPool(state)}
            max={poolMax}
            batchId={batchId}
            trailing={
              <div className="flex flex-col items-end gap-[3px]">
                <span className="font-mono text-[9px] leading-none tracking-[0.2em] text-fg2">
                  GOLD
                </span>
                <span className="font-pixel text-[22px] leading-[0.85] text-amber">
                  {state.gold}g
                </span>
              </div>
            }
          />
        </div>

        {(state.relics.length > 0 || state.consumables.length > 0) && (
          <div className="flex flex-wrap gap-[4px]">
            {state.relics.map((r) => (
              <RelicChip
                key={r.instanceId}
                code={r.code}
                suppressed={suppressed.has(r.instanceId)}
                fired={fired.get(r.code) ?? null}
                batchId={batchId}
                onTap={() => setDrawerOpen(true)}
              />
            ))}
            {state.consumables.map((c) => (
              <RelicChip key={c.instanceId} code={c.code} onTap={() => setDrawerOpen(true)} />
            ))}
          </div>
        )}
      </div>

      {drawerOpen && <RelicDrawer state={state} onClose={() => setDrawerOpen(false)} />}
    </>
  );
}
