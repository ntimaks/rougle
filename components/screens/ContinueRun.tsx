'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { GameState } from '@/lib/engine';
import { loadRun } from '@/lib/persistence/local';

/** `ACT I // NODE 04` — read off the saved run's current row, word or map. */
function nodeLabel(state: GameState): string {
  const act = ['I', 'II', 'III'][state.actIndex] ?? 'I';
  let row: number;
  if (state.word) {
    row = state.map.nodes[state.word.nodeId]?.row ?? 0;
  } else {
    const choices = new Set(state.map.available);
    const atRow = state.map.rows.findIndex((r) => r.some((id) => choices.has(id)));
    row = atRow === -1 ? 0 : atRow;
  }
  return `ACT ${act} // NODE ${String(row + 1).padStart(2, '0')}`;
}

/**
 * Never read during the server render — the save only exists on the client,
 * and reading it during render is what technical brief §1.4 calls out as the
 * hydration mismatch that presents as save corruption. Both consumers below
 * render the no-save case first and pick up the save a frame after mount,
 * same shape as `GameShell`'s own hydration.
 */
function useSavedRun(): GameState | null {
  const [state, setState] = useState<GameState | null>(null);
  useEffect(() => setState(loadRun()), []);
  return state;
}

/** S.01's second CTA — only appears once a save exists. */
export function ContinueRun() {
  const state = useSavedRun();
  if (!state) return null;

  return (
    <Link
      href="/play"
      className="flex min-h-[48px] items-center justify-between border border-fg3 px-[14px] font-mono text-[12px] font-medium leading-none tracking-[0.12em] text-fg1 no-underline transition-colors duration-[120ms] hover:border-fg0 hover:text-fg0 active:translate-x-px active:translate-y-px"
    >
      <span>CONTINUE RUN</span>
      <span className="text-fg3">[{nodeLabel(state)}]</span>
    </Link>
  );
}

/**
 * The footer's status readout — the design's `topMeta`: `NO ACTIVE RUN` with
 * nothing saved, the run's position once there is one.
 */
export function RunStatus() {
  const state = useSavedRun();
  return (
    <span className="font-mono text-[10px] leading-none text-blue">
      {state ? nodeLabel(state) : 'NO ACTIVE RUN'}
    </span>
  );
}
