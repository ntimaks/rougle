import Link from 'next/link';

/**
 * S.01 — title. Server-rendered, static; the run only exists behind /play.
 *
 * Presentation here is deliberately minimal: S.01's full treatment is a
 * Phase 2 ticket against the screen map. Copy follows R-009 — twenty words.
 */
export default function TitlePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col justify-between border-x border-line-soft px-4 py-10">
      <div>
        <p className="text-[10px] tracking-[0.2em] text-fg3">ROGUELIKE · WORDLE</p>
        <h1 className="mt-3 font-display text-5xl font-bold tracking-tight text-fg0">ROUGLE</h1>
        <p className="mt-4 max-w-[32ch] text-sm leading-relaxed text-fg2">
          Twenty words. Three acts. One pool of guesses per act, and it does not refill between
          words.
        </p>
      </div>

      <Link
        href="/play"
        className="flex min-h-[52px] items-center justify-between border border-ink bg-accent px-4 text-sm font-bold tracking-[0.14em] text-ink"
      >
        <span>BEGIN RUN</span>
        <span aria-hidden>→</span>
      </Link>
    </main>
  );
}
