'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BOSSES, basePayout, canDispatch, projectBoard, type GameState } from '@/lib/engine';
import { Grid } from '@/components/cmp/Grid';
import { Keyboard } from '@/components/cmp/Keyboard';
import { ChallengeBanner } from '@/components/cmp/ChallengeBanner';
import { ModifierBanner } from '@/components/cmp/ModifierBanner';
import { StampedLetters } from '@/components/cmp/StampedLetters';
import { CRITICAL_AT } from '@/components/cmp/BankrollMeter';
import { useGame } from '@/lib/store/useGame';
import { useMotion } from '@/lib/store/useMotion';

/**
 * S.04 — word solve. The core screen, and the one Gate 2 is asked about.
 *
 * It renders `projectBoard` output and scores nothing. Everything adversarial —
 * corruption, withheld identity, deferral, decay — arrives already resolved.
 */
export function WordScreen({ state, batchId }: { state: GameState; batchId: number }) {
  const dispatch = useGame((s) => s.dispatch);
  const events = useGame((s) => s.events);
  const { animate } = useMotion();
  const [typed, setTyped] = useState('');

  const word = state.word!;
  const view = useMemo(() => projectBoard(state, word), [state, word]);
  const pool = state.bankroll;
  const critical = pool <= CRITICAL_AT;

  const guessError = canDispatch(state, { type: 'SUBMIT_GUESS', guess: typed });
  const canSubmit = typed.length === word.length && guessError === null;

  const submit = useCallback(() => {
    if (!canSubmit) return;
    dispatch({ type: 'SUBMIT_GUESS', guess: typed });
    setTyped('');
  }, [canSubmit, dispatch, typed]);

  const type = useCallback(
    (letter: string) => setTyped((t) => (t.length < word.length ? t + letter : t)),
    [word.length],
  );

  // A physical keyboard is primary on pointer:fine. It routes through the same
  // predicate as the on-screen one, so it cannot bypass a Sieve lock.
  useEffect(() => {
    const locked = new Set(view.locked);
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter') return submit();
      if (e.key === 'Backspace') return setTyped((t) => t.slice(0, -1));
      const letter = e.key.toUpperCase();
      if (/^[A-Z]$/.test(letter) && !locked.has(letter)) type(letter);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submit, type, view.locked]);

  const spent = word.guessesSpent;
  const node = state.map.nodes[word.nodeId]!;
  const isBoss = node.kind === 'BOSS';
  const guessCost = events.some((e) => e.type === 'GUESS_SUBMITTED');
  // §2.3 — what solving RIGHT NOW would pay, so the player can read the trade
  // before committing another guess. This is the whole loop on one line.
  const nextPayout = basePayout(word.length, word.history.length + 1);
  const payout = events.find(
    (e): e is Extract<typeof e, { type: 'BANKROLL_CHANGED' }> =>
      e.type === 'BANKROLL_CHANGED' && e.kind === 'PAYOUT',
  );

  return (
    <div
      className="flex flex-1 flex-col overflow-hidden"
      style={critical && animate ? { animation: 'rg-flicker 5s steps(1,end) infinite' } : undefined}
    >
      {/* Above the modifiers: a stake outranks a difficulty. */}
      {state.pendingChallenge && (
        <ChallengeBanner challenge={state.pendingChallenge} guessesUsed={word.history.length} />
      )}
      <ModifierBanner
        modifiers={word.modifiers}
        badge={isBoss ? 'BOSS' : node.kind === 'ELITE' ? 'ELITE' : null}
        note={isBoss ? BOSSES[node.actIndex].rule : null}
      />

      <StampedLetters word={word} />

      <div className="flex flex-none items-center gap-2 border-b border-line-soft px-3 py-2">
        <span className="font-mono text-[9px] leading-none tracking-[0.18em] text-fg2">
          {isBoss ? BOSSES[node.actIndex].name : `NODE ${node.row + 1}`}
        </span>
        <span className="font-mono text-[9px] leading-none tracking-[0.14em] text-fg3">
          {/* The design's copy really does start with a double slash. */}
          {'//'} SPENT {spent} · NEXT SOLVE PAYS {nextPayout}
        </span>
        {word.solutions.length > 1 && (
          <span className="ml-auto font-mono text-[9px] leading-none tracking-[0.14em] text-red">
            {word.solved.filter(Boolean).length}/{word.solutions.length} SOLVED
          </span>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <Grid
          rows={view.rows}
          length={word.length}
          typed={typed}
          solutionCount={word.solutions.length}
          latestBatchId={batchId}
        />

        {/*
          GUESS COST FLOAT — fires on onGuessSubmit regardless of whether a
          refund follows. Rule C: the pool visibly ticks down even when a relic
          hands the guess straight back, because the cost is real either way.
        */}
        {guessCost && animate && (
          <div
            key={batchId}
            className="pointer-events-none absolute right-[18px] top-[6px] font-mono text-[15px] font-bold leading-none text-red"
            style={{ animation: 'rg-cost 560ms cubic-bezier(0.2,0.8,0.2,1) both' }}
            aria-hidden
          >
            −1 GUESS
          </div>
        )}
        {payout && (
          <div
            key={`payout-${batchId}`}
            className="pointer-events-none absolute right-[18px] top-[26px] font-mono text-[13px] font-bold leading-none text-accent"
            style={animate ? { animation: 'rg-cost 560ms cubic-bezier(0.2,0.8,0.2,1) both' } : undefined}
          >
            +{payout.delta} PAID OUT
          </div>
        )}
      </div>

      {typed.length === word.length && guessError && (
        <p className="flex-none px-3 pb-1 font-mono text-[10px] text-red" role="status">
          {guessError.message}
        </p>
      )}

      <Keyboard
        letterStates={view.keyboard}
        locked={view.locked}
        onKey={type}
        onEnter={submit}
        onBackspace={() => setTyped((t) => t.slice(0, -1))}
        canSubmit={canSubmit}
      />
    </div>
  );
}
