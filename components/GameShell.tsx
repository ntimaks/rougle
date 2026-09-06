'use client';

import { useEffect, useState } from 'react';
import type { GameState } from '@/lib/engine';
import { loadRun } from '@/lib/persistence/local';
import { useGame } from '@/lib/store/useGame';
import { Chrome } from '@/components/Chrome';
import { ActEndScreen } from '@/components/screens/ActEndScreen';
import { DebugView } from '@/components/screens/DebugView';
import { EmergencyScreen } from '@/components/screens/EmergencyScreen';
import { MapScreen } from '@/components/screens/MapScreen';
import { ShopScreen } from '@/components/screens/ShopScreen';
import { ForgeScreen } from '@/components/screens/ForgeScreen';
import { EventScreen } from '@/components/screens/EventScreen';
import { OutcomeScreen } from '@/components/screens/OutcomeScreen';
import { RewardScreen } from '@/components/screens/RewardScreen';
import { TitleCard } from '@/components/screens/TitleCard';
import { WordScreen } from '@/components/screens/WordScreen';

/**
 * The ONLY client boundary. `'use client'` lives here and nowhere below it.
 *
 * There is no SSR win available — the whole app is stateful client interaction
 * — so the goal is one reviewable line.
 *
 * The hydration pattern matters: the saved run must never be read during
 * render. Server HTML has no save and client HTML does, and the mismatch
 * presents as save corruption rather than as a hydration warning anyone would
 * connect to it (technical brief §1.4).
 */
export function GameShell() {
  const [hydrated, setHydrated] = useState(false);
  const [debug, setDebug] = useState(false);
  const { state, hydrate } = useGame();

  useEffect(() => {
    hydrate(loadRun());
    setDebug(new URLSearchParams(window.location.search).has('debug'));
    setHydrated(true);

    // The 6- and 7-letter lists are ~600KB and Act III is the only thing that
    // needs them, so they are not in the initial bundle. Kicked off here rather
    // than awaited: the fetch resolves in about a second and Act III is twenty
    // minutes away, so blocking first paint on it buys nothing. Moving the load
    // to the actual Act III boundary is ticket C-02.
    void import('@/lib/engine/words/all');
  }, [hydrate]);

  // Identical server and client: static markup only.
  if (!hydrated) return <Column><BootSplash /></Column>;
  if (!state) return <Column><TitleCard /></Column>;
  return (
    <Column>
      <PhaseSwitch state={state} debug={debug} />
    </Column>
  );
}

/**
 * The play column. 430px, centred, never stretched — a 900px tile row destroys
 * the row-scan read the whole puzzle depends on (component sheet §5). Desktop
 * is the adaptation, not the design.
 */
function Column({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen justify-center bg-ground">
      <main className="relative flex w-full max-w-[430px] flex-col overflow-hidden border-x border-line-soft">
        {children}
      </main>
    </div>
  );
}

function BootSplash() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="font-mono text-[10px] tracking-[0.24em] text-fg3">LOADING RUN…</p>
    </div>
  );
}

/**
 * Game phase is never a route. A URL like /word would not be linkable,
 * refreshable or back-safe, so the phase is a switch (technical brief §1.4).
 */
function PhaseSwitch({ state, debug }: { state: GameState; debug: boolean }) {
  const batchId = useGame((s) => s.batchId);
  const error = useGame((s) => s.error);

  if (debug) return <DebugView />;

  const terminal = state.phase === 'DEATH' || state.phase === 'VICTORY';

  return (
    <>
      {!terminal && <Chrome state={state} batchId={batchId} />}

      {(() => {
        switch (state.phase) {
          case 'WORD':
            return <WordScreen state={state} batchId={batchId} />;
          case 'SHOP':
            return <ShopScreen state={state} />;
          case 'FORGE':
            return <ForgeScreen state={state} />;
          case 'EVENT':
            return <EventScreen state={state} />;
          case 'MAP':
            return <MapScreen state={state} />;
          case 'REWARD':
            return <RewardScreen state={state} />;
          case 'EMERGENCY':
            return <EmergencyScreen state={state} />;
          case 'ACT_END':
            return <ActEndScreen state={state} />;
          case 'DEATH':
          case 'VICTORY':
            return <OutcomeScreen state={state} />;
          default:
            return <DebugView />;
        }
      })()}

      {error && (
        <p className="flex-none border-t border-red bg-panel px-3 py-2 font-mono text-[10px] text-red" role="alert">
          {error.message}
        </p>
      )}
    </>
  );
}
