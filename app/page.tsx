import Link from 'next/link';
import { ContinueRun, RunStatus } from '@/components/screens/ContinueRun';

/**
 * S.01 — title / run start. Explains the core constraint before the player
 * commits, then hands off to S.02 (character select) at `/play`.
 *
 * Server-rendered, static; the run itself only exists behind `/play`. Copy
 * uses "bankroll", never "pool" — AGENTS.md non-negotiable 10: v2.0 replaced
 * the per-act pool with a run-long bankroll and the two terms are not
 * interchangeable, including in UI copy. Word count follows MECHANICS.md
 * §3.1 ("Copy must say twenty").
 */
export default function TitlePage() {
  return (
    <div className="flex min-h-screen justify-center bg-ground">
      <main className="relative flex w-full max-w-[430px] flex-col border-x border-line-soft">
        <div className="flex flex-1 flex-col justify-center px-5 py-7">
          <div className="mb-[14px] flex items-center gap-2">
            <span
              className="h-[7px] w-[7px] flex-none rounded-full bg-accent"
              style={{ animation: 'rg-pulse 1.4s steps(1,end) infinite' }}
              aria-hidden
            />
            <span className="font-mono text-[9px] leading-none tracking-[0.2em] text-fg2">
              BUILD 0.1.0 // PROTOTYPE
            </span>
          </div>

          <h1 className="m-0 font-display text-[68px] font-bold uppercase leading-[0.88] tracking-[-0.03em] text-fg0">
            Rougle
          </h1>
          <div className="my-4 h-px bg-fg0" />

          <p className="m-0 font-mono text-[13px] leading-[1.5] text-fg1">
            Twenty words across three acts, against one bankroll that never refills.
          </p>
          <p className="mt-1 font-mono text-[13px] leading-[1.5] text-fg3">
            Overspend on one word and you starve the next.
          </p>

          <div className="mt-[22px] border border-dark3 bg-ground px-3 py-[11px]">
            <p className="m-0 font-pixel text-[15px] leading-[1.5] text-accent">
              &gt; ONE BANKROLL FOR THE WHOLE RUN. NO REFILLS.
            </p>
            <p className="m-0 font-pixel text-[15px] leading-[1.5] text-accent">
              &gt; ZERO WITH A WORD UNSOLVED ENDS THE RUN.
              <span className="inline-block" style={{ animation: 'rg-caret 1s steps(1,end) infinite' }}>
                █
              </span>
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-[10px]">
            <Link
              href="/play"
              className="flex min-h-[52px] items-center justify-between border border-ink bg-accent px-[14px] font-mono text-[14px] font-bold leading-none tracking-[0.14em] text-ink no-underline shadow-[3px_3px_0_0_var(--dark-fg-0)] transition-[transform,box-shadow] duration-[120ms] ease-linear hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_var(--dark-fg-0)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
            >
              <span>BEGIN RUN</span>
              <span aria-hidden>→</span>
            </Link>
            <ContinueRun />
          </div>
        </div>

        <div className="flex flex-none flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-dark3 px-5 pb-3 pt-[9px]">
          <span className="flex-none font-mono text-[9px] leading-[1.4] tracking-[0.16em] text-fg3">STATUS</span>
          <RunStatus />
          <span className="ml-auto flex-none font-mono text-[9px] leading-[1.4] tracking-[0.16em] text-fg3">
            [LOG] DAILY MODE — NOT IN V1
          </span>
        </div>
      </main>
    </div>
  );
}
