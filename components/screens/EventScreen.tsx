'use client';

import { EVENTS, canDispatch, optionAvailable, type GameState } from '@/lib/engine';
import { useGame } from '@/lib/store/useGame';

/**
 * S.08 — events. §6.8.
 *
 * The one rule this screen exists to honour: an event never hides its odds. The
 * `stake` line states the full consequence of an option including its failure
 * branch, and it is printed at the same weight as the label — not as fine print
 * under it. A decision under stated risk is the whole genre; a decision under
 * concealed risk is a different, worse game.
 *
 * An option whose `requires` is unmet renders DISABLED with the requirement
 * shown, never hidden. You should see the door you cannot afford.
 */
export function EventScreen({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch);
  const def = state.event ? EVENTS[state.event.code] : undefined;
  if (!def) return null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-none items-baseline gap-2 border-b border-dark3 px-4 pb-[11px] pt-[14px]">
        <div className="flex flex-col">
          <span className="font-mono text-[9px] leading-none tracking-[0.2em] text-magenta">
            EVENT · {def.code}
          </span>
          <h2 className="mt-[7px] font-display text-[24px] font-bold uppercase leading-none tracking-[-0.02em]">
            {def.name}
          </h2>
        </div>
        <span className="ml-auto font-mono text-[13px] font-bold leading-none text-accent">
          {state.gold}g
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        <p className="font-mono text-[11px] leading-[1.65] text-fg1">{def.prose}</p>

        <ul className="flex flex-col gap-[6px]">
          {def.options.map((option) => {
            const met = optionAvailable(state, option.requires);
            const blocked = canDispatch(state, { type: 'CHOOSE_EVENT_OPTION', key: option.key });
            const requirement = option.requires?.gold_min
              ? `NEEDS ${option.requires.gold_min}g`
              : option.requires?.relics_min
                ? `NEEDS ${option.requires.relics_min} RELICS`
                : null;
            return (
              <li key={option.key}>
                <button
                  type="button"
                  disabled={blocked !== null}
                  onClick={() => dispatch({ type: 'CHOOSE_EVENT_OPTION', key: option.key })}
                  className={`flex w-full items-start gap-[9px] border px-[10px] py-[10px] text-left transition-[transform,box-shadow] duration-[120ms] ease-linear ${
                    met
                      ? 'border-line-strong shadow-[3px_3px_0_0_var(--line-strong)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none'
                      : 'border-dark2 opacity-55'
                  }`}
                >
                  <span
                    className={`mt-[1px] flex-none font-mono text-[11px] font-bold leading-none ${
                      met ? 'text-magenta' : 'text-fg3'
                    }`}
                    aria-hidden
                  >
                    {option.key}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-[4px]">
                    <span className="font-mono text-[11px] font-bold leading-none tracking-[0.08em]">
                      {option.label}
                    </span>
                    {/* The full consequence, failure branch included. Never fine print. */}
                    <span className={`font-mono text-[9px] leading-[1.5] ${met ? 'text-amber' : 'text-fg3'}`}>
                      {option.stake}
                    </span>
                    {!met && requirement && (
                      <span className="font-mono text-[8px] leading-none tracking-[0.14em] text-red">
                        {requirement}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
