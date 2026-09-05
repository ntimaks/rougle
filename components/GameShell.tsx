'use client';

import { useEffect, useState } from 'react';
import { loadRun } from '@/lib/persistence/local';
import { useGame } from '@/lib/store/useGame';
import { DebugView } from '@/components/screens/DebugView';
import { TitleCard } from '@/components/screens/TitleCard';

/**
 * The ONLY client boundary. `'use client'` lives here and nowhere below it.
 *
 * There is no SSR win available — the whole app is stateful client interaction
 * — so the goal is one reviewable line rather than a scattering of directives.
 *
 * The hydration pattern matters: the saved run must never be read during
 * render. Server HTML has no save and client HTML does, and the mismatch
 * presents as save corruption rather than as a hydration warning anyone would
 * connect to it (technical brief §1.4).
 */
export function GameShell() {
  const [hydrated, setHydrated] = useState(false);
  const { state, hydrate } = useGame();

  useEffect(() => {
    hydrate(loadRun());
    setHydrated(true);

    // The 6- and 7-letter lists are ~600KB and Act III is the only thing that
    // needs them, so they are not in the initial bundle. Kicked off here rather
    // than awaited: the fetch resolves in about a second and Act III is twenty
    // minutes away, so blocking first paint on it buys nothing. Moving the load
    // to the actual Act III boundary is ticket C-02.
    void import('@/lib/engine/words/all');
  }, [hydrate]);

  // Identical server and client: static markup only.
  if (!hydrated) return <BootSplash />;
  return state ? <PhaseSwitch /> : <TitleCard />;
}

function BootSplash() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[430px] items-center justify-center border-x border-line-soft">
      <p className="text-[10px] tracking-[0.24em] text-fg3">LOADING RUN…</p>
    </main>
  );
}

/**
 * Game phase is never a route. A URL like /word would not be linkable,
 * refreshable or back-safe, so the phase is a switch (technical brief §1.4).
 *
 * Phase 1 ships one screen: the unstyled debug view (E-14). S.01–S.12 are
 * Phase 2 tickets against the screen map, and building them before Gate 2 has
 * been answered would be building on an unvalidated economy.
 */
function PhaseSwitch() {
  return <DebugView />;
}
