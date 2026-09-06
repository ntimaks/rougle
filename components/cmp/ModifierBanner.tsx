import { MODIFIERS, type ModifierId } from '@/lib/engine';

/**
 * CMP.08 — the modifier banner. Mounts BEFORE the grid, on `onWordStart`.
 *
 * Difficulty comes from modifiers, so a word's modifiers are the first thing a
 * player must be able to read — before they have spent anything on it.
 */
const NOTES: Partial<Record<ModifierId, string>> = {
  LOCKED_KEY: 'ONE LETTER UNUSABLE · NEVER A SOLUTION LETTER',
  SILENT_START: 'NO YELLOWS ON YOUR FIRST GUESS',
  LONG_WORD: 'SIX LETTERS',
  LONGER_WORD: 'SEVEN LETTERS',
  DECAY: 'GREENS REVERT AFTER ONE TURN',
  FOG: 'FEEDBACK LANDS ONE GUESS LATE',
  MIRROR: 'TWO SOLUTIONS · ONE POOL',
  LIAR_LETTER: 'ONE POSITION LIES ALL WORD',
  STACKED: 'TWO MODIFIERS',
};

/*
 * The banner's amber wash and its muted note colour are DERIVED from the amber
 * token rather than copied as literals. The prototype states them inline, and
 * those values are not in the token layer — they would be two more hex values
 * to hand-maintain and drift. Mixing the token with the ground reproduces them
 * and keeps one source of truth.
 */
export function ModifierBanner({
  modifiers,
  elite,
}: {
  modifiers: readonly ModifierId[];
  elite?: boolean;
}) {
  if (modifiers.length === 0) return null;
  const label = (id: ModifierId) => MODIFIERS.find((m) => m.id === id)?.label ?? id;

  return (
    <div
      className="flex flex-none items-stretch overflow-hidden border-b border-amber"
      style={{ background: 'color-mix(in srgb, var(--term-amber) 8%, var(--term-bg))' }}
    >
      {elite && (
        <div className="flex flex-none items-center bg-amber px-2 font-mono text-[9px] font-bold leading-none tracking-[0.14em] text-ink">
          ELITE
        </div>
      )}
      <div className="flex min-w-0 flex-1 items-center gap-2 px-[9px] py-[7px]">
        {modifiers.map((id) => (
          <span
            key={id}
            className="flex-none border border-amber px-[5px] py-[3px] font-mono text-[9px] leading-[1.3] tracking-[0.1em] text-amber"
          >
            {label(id)}
          </span>
        ))}
        <span
          className="truncate font-mono text-[9px] leading-[1.3]"
          style={{ color: 'color-mix(in srgb, var(--term-amber) 55%, var(--term-bg))' }}
        >
          {modifiers.map((id) => NOTES[id]).filter(Boolean).join(' · ')}
        </span>
      </div>
    </div>
  );
}
