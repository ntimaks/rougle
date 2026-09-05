import { SAVE_VERSION, type GameState } from './state';

/**
 * Pure save/load. Strings in, strings out, no browser globals — the only file
 * that names `localStorage` is `lib/persistence/local.ts` (technical brief §2.6).
 *
 * `GameState` is plain JSON by construction, so serialisation is
 * `JSON.stringify` and the interesting work is all migration.
 */

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export class SaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveError';
  }
}

/**
 * Returns null for anything unreadable. A corrupt save is discarded, never
 * fatal: losing a run is bad, but a save that bricks the title screen is worse.
 */
export function deserialize(raw: string | null): GameState | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isStateShaped(parsed)) return null;
  try {
    return migrate(parsed);
  } catch {
    return null;
  }
}

function isStateShaped(value: unknown): value is GameState {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Partial<GameState>;
  return (
    typeof s.version === 'number' &&
    typeof s.seed === 'string' &&
    typeof s.pool === 'number' &&
    typeof s.phase === 'string' &&
    Array.isArray(s.relics)
  );
}

/**
 * Version migrations. Each step takes the previous shape to the next; they run
 * in order, so a save two versions old walks through both.
 *
 * There is nothing to migrate yet. The function exists now rather than later
 * because the first save format ships with Phase 2, and retrofitting migration
 * onto saves already in players' browsers is not possible.
 */
export function migrate(state: GameState): GameState {
  const next = state;
  if (next.version > SAVE_VERSION) {
    throw new SaveError(`Save version ${next.version} is newer than ${SAVE_VERSION}.`);
  }
  // while (next.version < SAVE_VERSION) { ... next = { ...next, version: next.version + 1 } }
  return next;
}
