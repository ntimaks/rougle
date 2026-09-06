import { REGISTRY } from '../content/registry';
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
 */
type Migration = (state: GameState) => GameState;

/**
 * Indexed by the version being migrated FROM: `MIGRATIONS[1]` takes a v1 save
 * to v2. A gap in the table is a bug, not a no-op, so `migrate` throws on one
 * rather than handing the game a save it does not understand.
 */
const MIGRATIONS: Record<number, Migration> = {
  // v1 → v2: R-035 gave ForgeState a drawn `candidates` list. A save written
  // while standing in a forge has no such field, and the reducer refuses every
  // upgrade not in it — so a run saved at a forge would come back with the node
  // silently dead. Backfill from what the player holds: the pre-R-035 forge
  // offered everything upgradeable, which is exactly this list.
  1: (s) => ({
    ...s,
    forge: s.forge
      ? {
          ...s.forge,
          candidates:
            s.forge.candidates ??
            s.relics.filter((r) => !r.upgraded && REGISTRY[r.code]?.upgrade).map((r) => r.instanceId),
        }
      : null,
  }),

  // v2 → v3: R-036 gave each preset tile the `solutionIndex` it is true of.
  // Every tile written before it was drawn from `solutions[0]`, so 0 is not a
  // guess — it is what the old code did.
  2: (s) => ({
    ...s,
    word: s.word
      ? {
          ...s.word,
          presetTiles: s.word.presetTiles.map((p) => ({ ...p, solutionIndex: p.solutionIndex ?? 0 })),
        }
      : null,
  }),
};

export function migrate(state: GameState): GameState {
  let next = state;
  if (next.version > SAVE_VERSION) {
    throw new SaveError(`Save version ${next.version} is newer than ${SAVE_VERSION}.`);
  }
  while (next.version < SAVE_VERSION) {
    const step = MIGRATIONS[next.version];
    if (!step) throw new SaveError(`No migration from save version ${next.version}.`);
    next = { ...step(next), version: next.version + 1 };
  }
  return next;
}
