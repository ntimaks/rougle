'use client';

import { useState } from 'react';
import {
  CHARACTER_BY_CODE,
  REGISTRY,
  activationFor,
  checkActivation,
  usesThisWord,
  type GameState,
  type RelicInstance,
} from '@/lib/engine';
import { RARITY_TEXT, glyphFor } from './rarity';
import { useGame } from '@/lib/store/useGame';
import { useMotion } from '@/lib/store/useMotion';

/**
 * CMP.13 — the relic drawer, and the only place an activation can be fired.
 *
 * MECHANICS.md §6.5 and §6.6: consumables and activated relics are both used
 * from here, at any point where input is accepted. Without this screen the five
 * relics R-015 unblocked are worse than unimplemented — a player can be offered
 * The Auditor, take it, and never have a way to ask it anything.
 *
 * When an activation is illegal the button says WHY, from the engine's own
 * check. "Once per word" and "you cannot pay" are rules the player is entitled
 * to see rather than infer from a dead control.
 */
export function RelicDrawer({
  state,
  onClose,
}: {
  state: GameState;
  onClose: () => void;
}) {
  const dispatch = useGame((s) => s.dispatch);
  const { animate } = useMotion();
  const [pending, setPending] = useState<string | null>(null);

  const holders: RelicInstance[] = [
    ...state.relics,
    ...state.consumables.map((c) => ({ ...c, state: {} })),
  ].sort((a, b) => a.acquiredAt - b.acquiredAt);

  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-end" role="dialog" aria-label="Relics">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[var(--g-scrim)]"
      />
      <div
        className="relative max-h-[78%] overflow-y-auto border-t border-fg0 bg-panel"
        style={animate ? { animation: 'rg-rise 180ms cubic-bezier(0.2,0.8,0.2,1) both' } : undefined}
      >
        <div className="sticky top-0 flex items-center gap-2 border-b border-dark3 bg-strip px-3 py-[9px]">
          <span className="font-mono text-[10px] font-bold leading-none tracking-[0.16em] text-fg0">
            RELICS
          </span>
          <span className="font-mono text-[9px] leading-none tracking-[0.14em] text-fg3">
            {state.relics.length} HELD · {state.consumables.length}/3 CONSUMABLE
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto min-h-[32px] px-2 font-mono text-[10px] tracking-[0.14em] text-fg2"
          >
            CLOSE
          </button>
        </div>

        <ul className="flex flex-col">
          {holders.map((holder) => {
            const def = REGISTRY[holder.code];
            const character = CHARACTER_BY_CODE[holder.code];
            const activation = activationFor(holder.code);
            const check = activation ? checkActivation(state, holder) : null;
            const usable = activation !== null && activation !== undefined;
            const uses = state.word ? usesThisWord(holder, state.word.nodeId) : 0;

            return (
              <li key={holder.instanceId} className="border-b border-line-soft px-3 py-[10px]">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-[13px] ${def ? RARITY_TEXT[def.rarity] : 'text-accent'}`} aria-hidden>
                    {glyphFor(def)}
                  </span>
                  <span className="font-mono text-[11px] font-bold leading-none tracking-[0.1em] text-fg0">
                    {def?.name ?? character?.name ?? holder.code}
                  </span>
                  {character && (
                    <span className="border border-line-strong px-[4px] py-[2px] font-mono text-[8px] leading-none tracking-[0.12em] text-fg3">
                      INNATE
                    </span>
                  )}
                  {activation?.usesPerWord != null && state.word && (
                    <span className="ml-auto font-mono text-[8px] leading-none tracking-[0.12em] text-fg3">
                      {activation.usesPerWord - uses} LEFT THIS WORD
                    </span>
                  )}
                </div>

                <p className="mt-[6px] font-mono text-[10px] leading-[1.55] text-fg2">
                  {def?.rule ?? character?.innate}
                </p>

                {usable && (
                  <ActivationControl
                    holder={holder}
                    inputKind={activation?.input ?? null}
                    cost={activation?.cost ?? {}}
                    error={check?.error?.message ?? null}
                    open={pending === holder.instanceId}
                    onOpen={() => setPending(holder.instanceId)}
                    onFire={(payload) => {
                      dispatch({ type: 'USE_ITEM', instanceId: holder.instanceId, payload });
                      setPending(null);
                      onClose();
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function ActivationControl({
  holder,
  inputKind,
  cost,
  error,
  open,
  onOpen,
  onFire,
}: {
  holder: RelicInstance;
  inputKind: 'UNTRIED_LETTER' | 'WAGER' | null;
  cost: { gold?: number; guesses?: number };
  error: string | null;
  open: boolean;
  onOpen: () => void;
  onFire: (payload: Record<string, unknown>) => void;
}) {
  const [letter, setLetter] = useState('');
  const [wager, setWager] = useState(1);

  const price = [
    cost.gold ? `${cost.gold}g` : null,
    cost.guesses ? `${cost.guesses} guess` : null,
  ]
    .filter(Boolean)
    .join(' + ');

  if (error) {
    return (
      <p className="mt-[8px] font-mono text-[9px] leading-none tracking-[0.1em] text-fg3">
        {error}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={inputKind ? onOpen : () => onFire({})}
        className="mt-[8px] min-h-[36px] border border-fg0 px-3 font-mono text-[10px] font-bold leading-none tracking-[0.14em] text-fg0 active:translate-x-[1px] active:translate-y-[1px]"
      >
        USE{price ? ` · ${price}` : ''}
      </button>
    );
  }

  if (inputKind === 'UNTRIED_LETTER') {
    return (
      <div className="mt-[8px]">
        <p className="font-mono text-[9px] leading-none tracking-[0.14em] text-fg2">NAME A LETTER</p>
        <div className="mt-[6px] flex flex-wrap gap-[3px]">
          {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setLetter(c)}
              className={`h-[28px] w-[28px] border font-mono text-[11px] ${
                letter === c ? 'border-ink bg-accent text-ink' : 'border-line-strong text-fg1'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!letter}
          onClick={() => onFire({ letter })}
          className="mt-[8px] min-h-[36px] border border-ink bg-accent px-3 font-mono text-[10px] font-bold tracking-[0.14em] text-ink disabled:border-line-strong disabled:bg-transparent disabled:text-fg3"
        >
          ASK {letter || '—'} · {price}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-[8px]">
      <p className="font-mono text-[9px] leading-none tracking-[0.14em] text-fg2">
        WAGER GUESSES · SOLVE WITHIN IT OR LOSE THEM
      </p>
      <div className="mt-[6px] flex items-center gap-2">
        <button
          type="button"
          onClick={() => setWager((n) => Math.max(1, n - 1))}
          className="h-[36px] w-[36px] border border-line-strong font-mono text-fg0"
        >
          −
        </button>
        <span className="font-pixel text-[26px] leading-none text-fg0">{wager}</span>
        <button
          type="button"
          onClick={() => setWager((n) => n + 1)}
          className="h-[36px] w-[36px] border border-line-strong font-mono text-fg0"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => onFire({ wager })}
          className="ml-auto min-h-[36px] border border-ink bg-accent px-3 font-mono text-[10px] font-bold tracking-[0.14em] text-ink"
        >
          WAGER {wager}
        </button>
      </div>
      <span className="sr-only">{holder.code}</span>
    </div>
  );
}
