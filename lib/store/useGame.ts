'use client';

import { create } from 'zustand';
import {
  initialState,
  reduce,
  type Action,
  type EngineError,
  type GameEvent,
  type GameState,
} from '@/lib/engine';
import { clearRun, saveRun } from '@/lib/persistence/local';

/**
 * A thin shim. It holds NO rules: every change goes through `reduce`, and this
 * store's only jobs are keeping the current state, exposing the event batch for
 * the UI to animate, and persisting.
 *
 * If a rule ever appears in this file it is in the wrong place.
 */
interface GameStore {
  state: GameState | null;
  /**
   * The events from the most recent reduce, drained as a unit.
   *
   * `batchId` is what makes the drain atomic in practice: components key their
   * animations off it, so everything in one batch restarts on the same frame.
   * That is what the design's frame-ordering requirement actually needs — Tin
   * Cup's +5g and the pool decrement are in one batch, so the two counters move
   * together instead of competing for attention (component sheet §4).
   */
  events: GameEvent[];
  batchId: number;
  error: EngineError | null;
  /** V-08. The harness wants it and so do impatient players. */
  skipAnimations: boolean;

  dispatch: (action: Action) => void;
  hydrate: (state: GameState | null) => void;
  setSkipAnimations: (skip: boolean) => void;
  abandon: () => void;
}

export const useGame = create<GameStore>((set, get) => ({
  state: null,
  events: [],
  batchId: 0,
  error: null,
  skipAnimations: false,

  dispatch: (action) => {
    const current = get().state ?? initialState('AAAAAAAA', 'CH.01');
    const result = reduce(current, action);
    set((prev) => ({
      state: result.state,
      events: result.events,
      batchId: prev.batchId + 1,
      error: result.error ?? null,
    }));
    if (result.state.phase === 'DEATH' || result.state.phase === 'VICTORY') clearRun();
    else saveRun(result.state);
  },

  hydrate: (state) => set({ state, events: [], error: null }),
  setSkipAnimations: (skipAnimations) => set({ skipAnimations }),
  abandon: () => {
    clearRun();
    set({ state: null, events: [], error: null });
  },
}));

/** Did anything of this kind happen in the current batch? */
export function useEventOfType<K extends GameEvent['type']>(
  type: K,
): Extract<GameEvent, { type: K }> | undefined {
  return useGame((s) => s.events.find((e) => e.type === type)) as
    | Extract<GameEvent, { type: K }>
    | undefined;
}
