'use client';

import { useMemo, useState } from 'react';
import {
  ALPHABET,
  CONFIG,
  REGISTRY,
  canDispatch,
  currentPool,
  emergencyCost,
  projectBoard,
  type GameState,
} from '@/lib/engine';
import { TILE, tileVisual } from '@/components/cmp/tileStyles';
import { useGame } from '@/lib/store/useGame';

/**
 * E-14 — the debug view. State dump, guess input, feedback render, pool readout.
 *
 * Deliberately unstyled beyond legibility: the acceptance criterion is "a word
 * is playable end to end with zero styling", and a half-designed screen here
 * would compete with the real S.04 when it lands in Phase 2.
 *
 * It renders `projectBoard` output verbatim and scores nothing. If this view
 * ever scores anything, Liar Letter breaks (AGENTS.md non-negotiable 8).
 */
export function DebugView() {
  const { state, dispatch, error } = useGame();
  const [typed, setTyped] = useState('');

  // Hooks run before any early return: `state` is null only until GameShell
  // has hydrated, and a conditional hook would break on that first frame.
  const word = state?.word ?? null;
  const view = useMemo(
    () => (state && word ? projectBoard(state, word) : null),
    [state, word],
  );

  if (!state) return null;

  const submit = () => {
    dispatch({ type: 'SUBMIT_GUESS', guess: typed });
    setTyped('');
  };

  const locked = new Set(view?.locked ?? []);
  const guessError = word
    ? canDispatch(state, { type: 'SUBMIT_GUESS', guess: typed.toUpperCase() })
    : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col gap-3 border-x border-line-soft p-3 text-xs">
      <Chrome state={state} />

      {word && view && (
        <>
          <section className="flex flex-col gap-1" aria-label="Board">
            {view.rows.map((row, i) => (
              <div key={i} className="flex flex-col gap-1">
                {row.results.map((fb, r) => (
                  <div key={r} className="flex gap-1">
                    {fb.tiles.map((tile, t) => {
                      const visual = tileVisual(
                        tile.state,
                        tile.trustworthy,
                        tile.distance !== null,
                        true,
                      );
                      return (
                        <span
                          key={t}
                          className={`flex h-9 w-9 items-center justify-center border text-sm font-bold ${TILE[visual]}`}
                          title={`${tile.state}${tile.trustworthy ? '' : ' (untrustworthy)'}`}
                        >
                          {tile.distance !== null ? tile.distance : (tile.letter ?? '·')}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </section>

          <section aria-label="Keyboard" className="flex flex-wrap gap-1">
            {ALPHABET.map((c) => (
              <span
                key={c}
                className={`flex h-7 w-7 items-center justify-center border text-[11px] ${
                  locked.has(c) ? 'border-dark2 bg-sunken text-absent-fg line-through' : 'border-line-strong text-fg1'
                }`}
              >
                {c}
              </span>
            ))}
          </section>

          <div className="flex gap-2">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value.toUpperCase().slice(0, word.length))}
              onKeyDown={(e) => e.key === 'Enter' && !guessError && submit()}
              className="flex-1 border border-line-strong bg-transparent px-2 py-2 font-mono tracking-[0.3em] text-fg0"
              aria-label="Guess"
              placeholder={'_'.repeat(word.length)}
            />
            <button
              type="button"
              onClick={submit}
              disabled={!!guessError}
              className="min-h-[44px] border border-ink bg-accent px-4 font-bold text-ink disabled:border-line-strong disabled:bg-transparent disabled:text-fg3"
            >
              SUBMIT
            </button>
          </div>
          {typed.length === word.length && guessError && (
            <p className="text-red">{guessError.message}</p>
          )}
        </>
      )}

      {state.phase === 'MAP' && (
        <button
          type="button"
          onClick={() => dispatch({ type: 'SELECT_NODE', nodeId: state.map.available[0]! })}
          className="min-h-[44px] border border-ink bg-accent font-bold text-ink"
        >
          ENTER {state.map.available[0]}
        </button>
      )}

      {state.phase === 'REWARD' && state.pendingOffer && (
        <section className="flex flex-col gap-2" aria-label="Relic offer">
          <p className="text-fg2">CHOOSE ONE</p>
          {state.pendingOffer.codes.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => dispatch({ type: 'ACCEPT_OFFER', code })}
              className="min-h-[44px] border border-line-strong px-2 text-left text-fg0"
            >
              <strong>{REGISTRY[code]?.name ?? code}</strong>{' '}
              <span className="text-fg3">
                {REGISTRY[code]?.rarity} · {REGISTRY[code]?.archetype}
              </span>
              <br />
              <span className="text-fg2">{REGISTRY[code]?.rule}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => dispatch({ type: 'SKIP_OFFER' })}
            className="min-h-[44px] border border-line-strong text-fg2"
          >
            SKIP
          </button>
        </section>
      )}

      {state.phase === 'EMERGENCY' && (
        <section className="flex flex-col gap-2 border border-red p-2" aria-label="Emergency">
          <p className="text-red">
            POOL EXHAUSTED · EMERGENCY GUESS {emergencyCost(state, CONFIG)}g · YOU HAVE {state.gold}g
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'BUY_EMERGENCY' })}
              className="min-h-[44px] flex-1 border border-ink bg-accent font-bold text-ink"
            >
              BUY
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'DECLINE_EMERGENCY' })}
              className="min-h-[44px] flex-1 border border-line-strong text-fg2"
            >
              DECLINE
            </button>
          </div>
        </section>
      )}

      {(state.phase === 'DEATH' || state.phase === 'VICTORY') && (
        <section className="border border-line-strong p-2" aria-label="Outcome">
          <p className="text-sm font-bold text-fg0">
            {state.phase === 'VICTORY' ? 'VICTORY' : `DEATH · ${state.outcome?.cause}`}
          </p>
          <p className="text-fg2">
            SEED {state.seed} · {state.stats.wordsSolved} SOLVED · {state.stats.guessesSpent} SPENT
          </p>
        </section>
      )}

      {error && <p className="text-red">{error.code}: {error.message}</p>}

      <details className="mt-auto">
        <summary className="cursor-pointer text-fg3">STATE DUMP</summary>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-[10px] text-fg3">
          {JSON.stringify(state, null, 1)}
        </pre>
      </details>
    </main>
  );
}

function Chrome({ state }: { state: GameState }) {
  const word = state.word;
  return (
    <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-dark3 pb-2 text-[11px]">
      <span className="text-fg3">SEED {state.seed}</span>
      <span className="text-fg0">
        POOL {currentPool(state)}/{word?.poolSource === 'GAUNTLET' ? CONFIG.gauntlet.pool : state.poolMax}
      </span>
      <span className="text-amber">{state.gold}g</span>
      <span className="text-fg3">ACT {state.actIndex + 1}</span>
      <span className="text-fg3">{state.phase}</span>
      {word && word.modifiers.length > 0 && (
        <span className="text-red">{word.modifiers.join(' · ')}</span>
      )}
      {state.relics.length > 0 && (
        <span className="w-full text-fg2">
          {state.relics.map((r) => REGISTRY[r.code]?.name ?? r.code).join(' · ')}
        </span>
      )}
    </header>
  );
}
