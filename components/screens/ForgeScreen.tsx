'use client';

import { useState } from 'react';
import { FORGE_GOLD_PER_GUESS, REGISTRY, canDispatch, type Action, type GameState } from '@/lib/engine';
import { Button } from '@/components/cmp/Button';
import { RARITY_TEXT, glyphFor } from '@/components/cmp/rarity';
import { useGame } from '@/lib/store/useGame';

/**
 * S.07 — the forge. R-08, §6.7, R-035.
 *
 * One operation, two branches: upgrade one of the relics this forge drew, or
 * buy guesses. Both branches are shown together, because the point of the node
 * is that an upgrade and three guesses cost the same single operation — a forge
 * that made you pick a mode first would hide the trade.
 *
 * But showing both is not the same as committing on contact. This screen used
 * to fire `FORGE_UPGRADE` on the relic's own click while branch B was
 * select-then-confirm, so one screen ran two different interaction grammars and
 * the irreversible one was the one with no confirm step. Reported from
 * playtest: "I wanted to upgrade the relic and I ended up doing nothing."
 * Selecting is free and reversible here; exactly one button spends anything.
 */
type Choice = { kind: 'relic'; instanceId: string } | { kind: 'guesses'; n: number } | null;

export function ForgeScreen({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch);
  const [choice, setChoice] = useState<Choice>(null);
  const forge = state.forge;
  const operations = forge?.operationsLeft ?? 0;

  // The offer, not the collection (R-035). Instance ids are resolved against
  // what is held so a relic that left the run cannot render as a ghost row.
  const offered = (forge?.candidates ?? [])
    .map((id) => state.relics.find((r) => r.instanceId === id))
    .filter((r) => r !== undefined);

  const action: Action | null =
    choice === null
      ? null
      : choice.kind === 'relic'
        ? { type: 'FORGE_UPGRADE', instanceId: choice.instanceId }
        : { type: 'FORGE_CONVERT', guesses: choice.n };
  const blocked = action ? canDispatch(state, action) : null;

  const commit = () => {
    if (!action || blocked) return;
    dispatch(action);
    setChoice(null);
  };

  const label = () => {
    if (blocked) return blocked.message;
    if (choice === null) return 'CHOOSE AN OPERATION';
    if (choice.kind === 'guesses') return `POUR ${choice.n} INTO THE POOL`;
    const held = offered.find((r) => r.instanceId === choice.instanceId);
    return held ? `FORGE ${REGISTRY[held.code]!.name.toUpperCase()}` : 'FORGE';
  };

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
            A · UPGRADE ONE OF THESE
          </span>
          {offered.length === 0 && (
            <p className="font-mono text-[9px] leading-[1.6] text-fg3">
              This forge drew nothing it can work on.
            </p>
          )}
          {offered.map((held) => {
            const def = REGISTRY[held.code]!;
            const picked = choice?.kind === 'relic' && choice.instanceId === held.instanceId;
            return (
              <button
                key={held.instanceId}
                type="button"
                aria-pressed={picked}
                disabled={held.upgraded}
                onClick={() => setChoice({ kind: 'relic', instanceId: held.instanceId })}
                className={`flex w-full items-start gap-[9px] border px-[10px] py-[9px] text-left ${
                  held.upgraded
                    ? 'border-accent bg-sunken opacity-70'
                    : picked
                      ? 'border-accent shadow-[3px_3px_0_0_var(--term-fg)]'
                      : 'border-line-strong'
                }`}
              >
                <span className={`mt-[1px] text-[13px] leading-none ${RARITY_TEXT[def.rarity]}`} aria-hidden>
                  {glyphFor(def)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-[4px]">
                  <span className="font-mono text-[11px] font-bold leading-none tracking-[0.1em]">
                    {held.upgraded ? def.upgrade!.name : def.name}
                  </span>
                  {/*
                    The upgrade's own words, so the trade is legible before it
                    is made — labelled MK.II, because unlabelled it reads as the
                    relic's CURRENT rule and the row then makes no case for
                    itself.
                  */}
                  <span className="font-mono text-[9px] leading-[1.5] text-accent">
                    {!held.upgraded && <span className="text-fg2">MK.II · </span>}
                    {def.upgrade!.rule}
                  </span>
                </span>
                {/*
                  A spent operation has to be visible. It was not: the screen
                  after an upgrade differed from the screen before it by a
                  heading and some opacity, which is why the report was
                  "I ended up doing nothing" from a player who had in fact
                  upgraded a relic.
                */}
                <span
                  className={`ml-auto flex-none font-mono text-[9px] font-bold leading-none tracking-[0.12em] ${
                    held.upgraded ? 'text-accent' : picked ? 'text-accent' : 'text-fg2'
                  }`}
                >
                  {held.upgraded ? 'FORGED' : picked ? 'CHOSEN' : ''}
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
              {[1, 2, 3, 5].map((n) => {
                const picked = choice?.kind === 'guesses' && choice.n === n;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={picked}
                    onClick={() => setChoice({ kind: 'guesses', n })}
                    className={`flex-1 border py-2 font-mono text-[12px] font-bold leading-none ${
                      picked ? 'border-accent text-accent' : 'border-line-soft text-fg2'
                    }`}
                  >
                    +{n}
                  </button>
                );
              })}
            </div>
            <span className="w-[52px] flex-none text-right font-mono text-[11px] font-bold leading-none text-fg2">
              {choice?.kind === 'guesses' ? `${choice.n * FORGE_GOLD_PER_GUESS}g` : ''}
            </span>
          </div>
        </section>
      </div>

      {/* The only control on this screen that spends anything. */}
      <div className="flex-none border-t border-dark3 bg-panel px-4 pb-[14px] pt-3">
        <button
          type="button"
          disabled={action === null || blocked !== null}
          onClick={commit}
          className={`mb-[9px] min-h-[42px] w-full border font-mono text-[11px] font-bold leading-none tracking-[0.12em] ${
            action === null || blocked
              ? 'border-line-strong text-fg3'
              : 'border-accent text-accent shadow-[3px_3px_0_0_var(--term-fg)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none'
          }`}
        >
          {label()}
        </button>
        <Button primary arrow onClick={() => dispatch({ type: 'LEAVE_NODE' })}>
          {operations > 0 ? 'LEAVE UNUSED' : 'LEAVE'}
        </Button>
      </div>
    </div>
  );
}
