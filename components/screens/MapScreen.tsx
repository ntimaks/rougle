'use client';

import { BOSSES, MODIFIERS, type GameState, type MapNode } from '@/lib/engine';
import { useGame } from '@/lib/store/useGame';

/**
 * S.03 — the act map. R-01/R-03.
 *
 * The act branches now, so this is a route you CHOOSE rather than one you read.
 * Every row of the DAG is drawn; the row you are standing in front of is
 * selectable and the rest are context, because "the player picks the path, not
 * just the next step" only means anything if the rest of the path is visible
 * while picking.
 *
 * Modifiers stay hidden on unreached nodes unless RL.06 Cartographer is held —
 * that relic buys exactly this, and showing them for free would spend it.
 */
const KIND_GLYPH: Record<string, string> = {
  WORD: '◇',
  ELITE: '◆',
  SHOP: '▲',
  FORGE: '■',
  EVENT: '✦',
  BOSS: '●',
};

const KIND_HUE: Record<string, string> = {
  WORD: 'text-fg1',
  ELITE: 'text-amber',
  SHOP: 'text-blue',
  FORGE: 'text-fg2',
  EVENT: 'text-magenta',
  BOSS: 'text-red',
};

/** What the node costs or offers, in the fewest words that are still true. */
function subtitleFor(node: MapNode, revealed: boolean): string | null {
  if (node.kind === 'SHOP') return 'BUY';
  if (node.kind === 'FORGE') return 'UPGRADE · OR BUY GUESSES';
  if (node.kind === 'EVENT') return 'A CHOICE';
  if (!revealed || node.modifiers.length === 0) return null;
  return node.modifiers.map((m) => MODIFIERS.find((d) => d.id === m)?.label ?? m).join(' · ');
}

export function MapScreen({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch);
  const choices = new Set(state.map.available);
  const currentRow = state.map.rows.findIndex((row) => row.some((id) => choices.has(id)));

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-none border-b border-dark3 px-4 pb-[11px] pt-[14px]">
        <span className="font-mono text-[9px] leading-none tracking-[0.2em] text-fg2">
          ACT {['I', 'II', 'III'][state.actIndex]} · {BOSSES[state.actIndex].name} AHEAD
        </span>
        <h2 className="mt-[7px] font-display text-[24px] font-bold uppercase leading-none tracking-[-0.02em]">
          {choices.size > 1 ? 'Choose a way' : 'The road'}
        </h2>
      </div>

      <div className="flex flex-1 flex-col gap-[10px] overflow-y-auto px-4 py-3">
        {state.map.rows.map((row, rowIndex) => {
          const isChoice = rowIndex === currentRow;
          const passed = currentRow === -1 ? true : rowIndex < currentRow;
          return (
            <div key={rowIndex} className="flex flex-col gap-[4px]">
              <span className="font-mono text-[8px] leading-none tracking-[0.2em] text-fg3">
                {row[0] === state.map.bossId ? 'BOSS' : `ROW ${rowIndex + 1}`}
              </span>
              <div className="flex gap-[5px]">
                {row.map((id) => {
                  const node = state.map.nodes[id]!;
                  const selectable = choices.has(id);
                  // Cartographer, or a node already behind you.
                  const revealed = state.map.modifiersRevealed || node.visited || passed;
                  const subtitle = subtitleFor(node, revealed);
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={!selectable}
                      onClick={() => dispatch({ type: 'SELECT_NODE', nodeId: id })}
                      aria-label={`${node.kind}${subtitle ? `, ${subtitle}` : ''}`}
                      className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-[3px] border px-1 py-2 transition-[transform,box-shadow] duration-[120ms] ease-linear ${
                        selectable
                          ? 'border-fg0 shadow-[3px_3px_0_0_var(--line-strong)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none'
                          : node.visited
                            ? 'border-dark2 opacity-40'
                            : 'cursor-default border-dark3 opacity-70'
                      }`}
                    >
                      <span
                        className={`text-[15px] leading-none ${selectable || node.visited ? KIND_HUE[node.kind] : 'text-fg3'}`}
                        aria-hidden
                      >
                        {node.visited ? '·' : KIND_GLYPH[node.kind]}
                      </span>
                      <span className="font-mono text-[8px] leading-none tracking-[0.12em] text-fg2">
                        {node.kind}
                      </span>
                      {subtitle && (
                        <span className="max-w-full truncate font-mono text-[7px] leading-none tracking-[0.1em] text-amber">
                          {subtitle}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {isChoice && (
                <span className="font-mono text-[8px] leading-none tracking-[0.14em] text-accent">
                  ↑ {choices.size > 1 ? 'PICK ONE' : 'GO'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
