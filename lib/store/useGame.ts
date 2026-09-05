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
 * store's only jobs are keeping the current state, queueing the event batch for
 * the UI to animate, and persisting.
 *
 * If a rule ever appears in this file it is in the wrong place.
 */
interface GameStore {
  state: GameState | null;
  /** The most recent batch, drained as a unit so co-ordinated frames land together. */
  events: GameEvent[];
  error: EngineError | null;
  dispatch: (action: Action) => void;
  hydrate: (state: GameState | null) => void;
  drainEvents: () => void;
  abandon: () => void;
}

export const useGame = create<GameStore>((set, get) => ({
  state: null,
  events: [],
  error: null,

  dispatch: (action) => {
    const current = get().state ?? initialState('AAAAAAAA', 'CH.01');
    const result = reduce(current, action);
    set({ state: result.state, events: result.events, error: result.error ?? null });
    if (result.state.phase === 'DEATH' || result.state.phase === 'VICTORY') clearRun();
    else saveRun(result.state);
  },

  hydrate: (state) => set({ state, events: [], error: null }),
  drainEvents: () => set({ events: [] }),
  abandon: () => {
    clearRun();
    set({ state: null, events: [], error: null });
  },
}));
