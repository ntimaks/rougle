'use client';

import { BOSSES, MODIFIERS, type GameState } from '@/lib/engine';
import { Button } from '@/components/cmp/Button';
import { useGame } from '@/lib/store/useGame';

/**
 * S.03 — the act map, in its Phase 2 shape: a linear act, so this is a route
 * you read rather than one you choose.
 *
 * The branching DAG is R-01 in Phase 3. Building the chooser before the
 * generator exists would mean a screen that offers a choice the engine cannot
 * honour, so this shows the act ahead and moves you along it.
 */
const KIND_GLYPH: Record<string, string> = {
  WORD: '◇',
  ELITE: '◆',
  SHOP: '▲',
  FORGE: '■',
  EVENT: '✦',
  BOSS: '●',
};

export function MapScreen({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch);
  const next = state.map.available[0];
  const rows = state.map.rows.flat();
  const currentIndex = rows.findIndex((id) => id === next);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-none border-b border-dark3 px-4 pb-[11px] pt-[14px]">
        <span className="font-mono text-[9px] leading-none tracking-[0.2em] text-fg2">
          ACT {['I', 'II', 'III'][state.actIndex]} · {BOSSES[state.actIndex].name} AHEAD
        </span>
        <h2 className="mt-[7px] font-display text-[24px] font-bold uppercase leading-none tracking-[-0.02em]">
          The road
        </h2>
      </div>

      <ol className="flex flex-1 flex-col gap-[6px] overflow-y-auto px-4 py-3">
        {rows.map((id, i) => {
          const node = state.map.nodes[id]!;
          const here = i === currentIndex;
          const done = i < currentIndex;
          return (
            <li
              key={id}
              aria-current={here ? 'step' : undefined}
              className={`flex items-center gap-[10px] border px-[10px] py-[9px] ${
                here
                  ? 'border-accent bg-strip shadow-[3px_3px_0_0_var(--dark-fg-0)]'
                  : done
                    ? 'border-dark2 bg-sunken'
                    : 'border-line-strong bg-panel'
              }`}
            >
              <span
                className={`font-mono text-[15px] ${here ? 'text-accent' : done ? 'text-absent-fg' : 'text-fg3'}`}
                aria-hidden
              >
                {KIND_GLYPH[node.kind] ?? '◇'}
              </span>
              <span
                className={`font-mono text-[11px] leading-none tracking-[0.14em] ${
                  done ? 'text-absent-fg line-through' : 'text-fg0'
                }`}
              >
                {node.kind}
              </span>
              {/* RL.06 Cartographer buys exactly this: the modifiers, in advance. */}
              {(state.map.modifiersRevealed || here || done) && node.modifiers.length > 0 && (
                <span className="ml-auto truncate font-mono text-[9px] leading-none tracking-[0.1em] text-amber">
                  {node.modifiers
                    .map((m) => MODIFIERS.find((d) => d.id === m)?.label ?? m)
                    .join(' · ')}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex-none border-t border-dark3 bg-panel px-4 pb-[14px] pt-3">
        <Button primary arrow onClick={() => next && dispatch({ type: 'SELECT_NODE', nodeId: next })}>
          {state.map.nodes[next ?? '']?.kind === 'BOSS' ? 'FACE IT' : 'ADVANCE'}
        </Button>
      </div>
    </div>
  );
}
