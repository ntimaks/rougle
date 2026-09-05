'use client';

import { deserialize, serialize, type GameState } from '@/lib/engine';

/**
 * The only file in the project that names `localStorage` (AGENTS.md
 * non-negotiable 1, technical brief §2.6). Everything it does is a thin wrapper
 * around the pure functions in `core/serialize.ts`.
 *
 * Never call these during render. The server has no save and the client does,
 * so reading one while rendering produces a hydration mismatch that presents
 * as save corruption — `GameShell` reads it in an effect instead.
 */

const RUN_KEY = 'rg:run';
const SAVE_DEBOUNCE_MS = 250;

export function loadRun(): GameState | null {
  try {
    return deserialize(window.localStorage.getItem(RUN_KEY));
  } catch {
    return null;
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Debounced 250 ms. Spamming submit must not mean a write per keystroke. */
export function saveRun(state: GameState): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      window.localStorage.setItem(RUN_KEY, serialize(state));
    } catch {
      // Quota, private mode, disabled storage: the run continues in memory.
    }
  }, SAVE_DEBOUNCE_MS);
}

export function clearRun(): void {
  if (timer) clearTimeout(timer);
  try {
    window.localStorage.removeItem(RUN_KEY);
  } catch {
    // Nothing to do; the next load will simply find no save.
  }
}
