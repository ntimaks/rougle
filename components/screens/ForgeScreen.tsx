'use client';

import { useState } from 'react';
import { FORGE_GOLD_PER_GUESS, REGISTRY, canDispatch, type GameState } from '@/lib/engine';
import { Button } from '@/components/cmp/Button';
import { RARITY_TEXT, glyphFor } from '@/components/cmp/rarity';
import { useGame } from '@/lib/store/useGame';

/**
 * S.07 — the forge. R-08, §6.7.
 *
 * One operation, two branches: upgrade a held relic to MK.II, or buy guesses.
 * The design's heading is ONE OPERATION and that is the whole tension, so the
 * count is stated at the top rather than discovered by the second click.
 *
 * Both branches are shown together. A forge that made you choose a mode first
 * would hide the trade — the point is that a relic upgrade and three guesses
 * cost the same single operation.
 */
export function ForgeScreen({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch);
  const [guesses, setGuesses] = useState(1);
  const forge = state.forge;
  const operations = forge?.operationsLeft ?? 0;
  const upgradeable = state.relics.filter((r) => REGISTRY[r.code]?.upgrade);
  const convertBlocked = canDispatch(state, { type: 'FORGE_CONVERT', guesses });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-none items-baseline gap-2 border-b border-dark3 px-4 pb-[11px] pt-[14px]">
        <div className="flex flex-col">
          <span className="font-mono text-[9px] leading-none tracking-[0.2em] text-fg2">FORGE</span>
          <h2 className="mt-[7px] font-display text-[24px] font-bold uppercase leading-none tracking-[-0.02em]">
            {operations === 1 ? 'One operation' : `${operations} operations`}
          </h2>
        </div>
        <span className="ml-auto font-mono text-[13px] font-bold leading-none text-accent">
          {state.gold}g
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        <section className="flex flex-col gap-[6px]">
          <span className="font-mono text-[9px] leading-none tracking-[0.18em] text-fg2">
            A · UPGRADE A RELIC
          </span>
          {upgradeable.length === 0 && (
            <p className="font-mono text-[9px] leading-[1.6] text-fg3">
              Nothing you hold has an MK.II yet.
            </p>
          )}
          {upgradeable.map((held) => {
            const def = REGISTRY[held.code]!;
            const blocked = canDispatch(state, { type: 'FORGE_UPGRADE', instanceId: held.instanceId });
            return (
              <button
                key={held.instanceId}
                type="button"
                disabled={blocked !== null}
                onClick={() => dispatch({ type: 'FORGE_UPGRADE', instanceId: held.instanceId })}
                className={`flex w-full items-start gap-[9px] border px-[10px] py-[9px] text-left ${
                  held.upgraded
                    ? 'border-accent bg-sunken opacity-70'
                    : blocked
                      ? 'border-dark2 opacity-60'
                      : 'border-line-strong shadow-[3px_3px_0_0_var(--line-strong)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none'
                }`}
              >
                <span className={`mt-[1px] text-[13px] leading-none ${RARITY_TEXT[def.rarity]}`} aria-hidden>
                  {glyphFor(def)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-[4px]">
                  <span className="font-mono text-[11px] font-bold leading-none tracking-[0.1em]">
                    {held.upgraded ? def.upgrade!.name : def.name}
                  </span>
                  {/* The upgrade's own words, so the trade is legible before it is made. */}
                  <span className="font-mono text-[9px] leading-[1.5] text-accent">
                    {def.upgrade!.rule}
                  </span>
                </span>
                <span className="ml-auto flex-none font-mono text-[9px] font-bold leading-none tracking-[0.12em] text-fg2">
                  {held.upgraded ? 'MK.II' : 'FORGE'}
                </span>
              </button>
            );
          })}
        </section>

        <section className="flex flex-col gap-[6px] border-t border-line-soft pt-3">
          <span className="font-mono text-[9px] leading-none tracking-[0.18em] text-fg2">
            B · BUY GUESSES · {FORGE_GOLD_PER_GUESS}g EACH
          </span>
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-[5px]">
              {[1, 2, 3, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setGuesses(n)}
                  className={`flex-1 border py-2 font-mono text-[12px] font-bold leading-none ${
                    guesses === n ? 'border-accent text-accent' : 'border-line-soft text-fg2'
                  }`}
                >
                  +{n}
                </button>
              ))}
            </div>
            <span className="w-[52px] flex-none text-right font-mono text-[11px] font-bold leading-none text-accent">
              {guesses * FORGE_GOLD_PER_GUESS}g
            </span>
          </div>
          <button
            type="button"
            disabled={convertBlocked !== null}
            onClick={() => dispatch({ type: 'FORGE_CONVERT', guesses })}
            className={`min-h-[38px] border font-mono text-[11px] font-bold leading-none tracking-[0.12em] ${
              convertBlocked ? 'border-line-strong text-fg3' : 'border-fg0 text-fg0'
            }`}
          >
            {convertBlocked ? convertBlocked.message : `POUR ${guesses} INTO THE POOL`}
          </button>
        </section>
      </div>

      <div className="flex-none border-t border-dark3 bg-panel px-4 pb-[14px] pt-3">
        <Button primary arrow onClick={() => dispatch({ type: 'LEAVE_NODE' })}>
          {operations > 0 ? 'LEAVE UNUSED' : 'LEAVE'}
        </Button>
      </div>
    </div>
  );
}
