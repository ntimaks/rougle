'use client';

import type { ReactNode } from 'react';

/**
 * CMP.06 — the button. Two weights, one geometry.
 *
 * The accent fill always takes a `var(--g-ink)` border, never `--ink-0`: under
 * the dark theme `--ink-0` inverts to near-white, which puts lime on paper and
 * breaks the one contrast rule the design states twice.
 *
 * Press is `translate(1px,1px)` with the shadow collapsing — no ripple, no
 * scale, no colour transition. 3px 3px hard shadow, never blurred.
 */
export function Button({
  children,
  onClick,
  disabled = false,
  primary = false,
  arrow = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  arrow?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[50px] w-full items-center justify-between px-[14px] font-mono text-[13px] font-bold leading-none tracking-[0.14em] transition-[transform,box-shadow] duration-[120ms] ease-linear active:translate-x-[3px] active:translate-y-[3px] active:shadow-none ${
        disabled
          ? 'cursor-not-allowed border border-line-strong bg-transparent text-fg3'
          : primary
            ? 'border border-ink bg-accent text-ink shadow-[3px_3px_0_0_var(--dark-fg-0)]'
            : 'border border-fg0 bg-transparent text-fg0'
      }`}
    >
      <span>{children}</span>
      {arrow && <span aria-hidden>→</span>}
    </button>
  );
}
