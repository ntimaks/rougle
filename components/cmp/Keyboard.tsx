'use client';

import type { TileState } from '@/lib/engine';

/**
 * CMP.03 — key and keyboard. Five states, 46px floor.
 *
 * Letter state is DERIVED from the guess history, never stored — the engine
 * hands it over in the same payload as the board, and this component only
 * paints it (design handoff, State rule 2).
 *
 * ELIMINATED still accepts input. LOCKED (the Sieve) does not, and it must be
 * genuinely unfocusable so a physical keyboard cannot bypass it — `disabled`
 * rather than a pointer-events trick, which a Tab key walks straight through.
 */
const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'] as const;

const KEY_STATE: Record<string, string> = {
  UNTRIED: 'bg-dark2 text-fg0 border-line-strong',
  YELLOW: 'bg-amber text-ink border-ink',
  GREEN: 'bg-accent text-ink border-ink',
  GREY: 'bg-sunken text-absent-fg border-dark2',
  UNKNOWN: 'bg-dark2 text-fg2 border-line-strong',
  HIDDEN: 'bg-dark2 text-fg0 border-line-strong',
};

export function Keyboard({
  letterStates,
  locked,
  onKey,
  onEnter,
  onBackspace,
  canSubmit,
}: {
  letterStates: Record<string, TileState>;
  locked: readonly string[];
  onKey: (letter: string) => void;
  onEnter: () => void;
  onBackspace: () => void;
  canSubmit: boolean;
}) {
  const lockedSet = new Set(locked);

  return (
    <div className="flex flex-none flex-col gap-[5px] border-t border-dark3 bg-panel px-2 pb-3 pt-2">
      {ROWS.map((row, r) => (
        <div
          key={row}
          className="flex justify-center gap-[4px]"
          // The middle row insets on both sides, which is what makes the
          // stagger read as a keyboard rather than a grid.
          style={r === 1 ? { paddingLeft: 14, paddingRight: 14 } : undefined}
        >
          {r === 2 && (
            <Key flex={1.9} label="ENTER" onTap={onEnter} disabled={!canSubmit} wide />
          )}
          {[...row].map((letter) => (
            <Key
              key={letter}
              label={letter}
              onTap={() => onKey(letter)}
              disabled={lockedSet.has(letter)}
              locked={lockedSet.has(letter)}
              tone={KEY_STATE[letterStates[letter] ?? 'UNTRIED']!}
            />
          ))}
          {r === 2 && <Key flex={1.6} label="⌫" onTap={onBackspace} wide />}
        </div>
      ))}
    </div>
  );
}

function Key({
  label,
  onTap,
  disabled = false,
  locked = false,
  tone = KEY_STATE['UNTRIED']!,
  flex = 1,
  wide = false,
}: {
  label: string;
  onTap: () => void;
  disabled?: boolean;
  locked?: boolean;
  tone?: string;
  flex?: number;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      // Unfocusable when locked: relics.json RL.02 requires that a physical
      // keyboard cannot reach a key the Sieve has taken.
      tabIndex={locked ? -1 : undefined}
      aria-label={locked ? `${label}, locked` : label}
      style={{ flex }}
      className={`relative flex min-h-[46px] min-w-0 items-center justify-center border px-[2px] font-mono font-bold transition-transform duration-[60ms] ease-linear active:translate-x-[1px] active:translate-y-[1px] ${
        wide ? 'text-[10px] tracking-[0.12em]' : 'text-[13px]'
      } ${locked ? 'cursor-not-allowed bg-sunken text-absent-fg border-dark2' : tone} ${
        disabled && !locked ? 'opacity-40' : ''
      }`}
    >
      {label}
      {/* The Sieve's strike-through rule: a locked key is struck, not just dim. */}
      {locked && <span className="absolute left-[2px] right-[2px] h-px bg-fg3" aria-hidden />}
    </button>
  );
}
