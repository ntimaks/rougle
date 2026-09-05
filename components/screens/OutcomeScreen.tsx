'use client';

import { CHARACTER_BY_CODE, REGISTRY, type DeathCause, type GameState } from '@/lib/engine';
import { Button } from '@/components/cmp/Button';
import { StatCell } from '@/components/cmp/StatCell';
import { useGame } from '@/lib/store/useGame';
import { useMotion } from '@/lib/store/useMotion';

/**
 * S.11 death and S.12 victory. One component: they are the same receipt at
 * different temperatures, and building them apart is how the two drift.
 *
 * The seed is printed and copyable. It is the run's identity, it has been in
 * the chrome since run start, and pasting it back reproduces the run exactly —
 * which is what makes a death worth arguing with.
 *
 * The victory screen leaves a full-width strip under the stat grid unused. That
 * is deliberate: meta-progression is out of scope, and the design reserved the
 * space rather than designing something that implies an account system.
 */
/**
 * `DeathCause` is an engine enum. A player should never be shown
 * EMERGENCY_UNAFFORDABLE — it is the right word for a bug report and the wrong
 * one for the moment a run ends.
 */
const CAUSE_COPY: Record<DeathCause, string> = {
  POOL_EXHAUSTED: 'THE POOL RAN DRY',
  EMERGENCY_DECLINED: 'YOU TURNED DOWN THE WAY OUT',
  EMERGENCY_UNAFFORDABLE: 'THE WAY OUT COST MORE THAN YOU HAD',
  GAUNTLET: 'THE GAUNTLET CLOSED',
  EVENT: 'THE ROAD ENDED IT',
};

export function OutcomeScreen({ state }: { state: GameState }) {
  const abandon = useGame((s) => s.abandon);
  const { animate } = useMotion();
  const won = state.phase === 'VICTORY';
  const solved = state.stats.wordsSolved;
  const perWord = state.stats.guessesPerWord;
  const average = perWord.length
    ? (perWord.reduce((a, b) => a + b, 0) / perWord.length).toFixed(1)
    : '—';
  const relicNames = state.relics
    .filter((r) => !CHARACTER_BY_CODE[r.code])
    .map((r) => REGISTRY[r.code]?.name ?? r.code);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 py-5">
      <div
        className={`flex-none border p-4 ${won ? 'border-ink bg-accent text-ink' : 'border-red bg-panel'}`}
        style={animate ? { animation: 'rg-slam 260ms steps(3,end) both' } : undefined}
      >
        <p className={`font-mono text-[9px] leading-none tracking-[0.2em] ${won ? 'text-ink' : 'text-red'}`}>
          {won
            ? 'RUN COMPLETE'
            : `CAUSE · ${state.outcome?.cause ? CAUSE_COPY[state.outcome.cause] : 'UNKNOWN'}`}
        </p>
        <h1 className="mt-[8px] font-display text-[34px] font-bold uppercase leading-none tracking-[-0.02em]">
          {won ? 'Victory' : 'Dead'}
        </h1>
        {!won && (
          <p className="mt-3 font-mono text-[11px] leading-[1.6] text-fg2">
            Act {['I', 'II', 'III'][state.actIndex]}
            {state.stats.deathNodeId ? ` · ${state.stats.deathNodeId}` : ''}
            {state.gold > 0 && state.outcome?.cause === 'EMERGENCY_DECLINED'
              ? ` · you walked away with ${state.gold}g in hand`
              : ''}
          </p>
        )}
      </div>

      <div className="mt-4 grid flex-none grid-cols-2 gap-[6px]">
        <StatCell label="WORDS SOLVED" value={String(solved)} tone={won ? 'text-accent' : 'text-fg0'} />
        <StatCell label="AVG / WORD" value={average} tone="text-fg0" />
        <StatCell label="GUESSES SPENT" value={String(state.stats.guessesSpent)} tone="text-fg0" />
        <StatCell label="REFUNDED" value={String(state.stats.refundsGranted)} tone="text-accent" />
        <StatCell label="GOLD UNSPENT" value={`${state.gold}g`} tone="text-amber" />
        <StatCell
          label="EMERGENCY BUYS"
          value={String(state.stats.emergencyPurchases)}
          tone={state.stats.emergencyPurchases > 0 ? 'text-red' : 'text-fg0'}
        />
      </div>

      <div className="mt-4 flex-none">
        <p className="font-mono text-[8px] leading-none tracking-[0.18em] text-fg2">THE BUILD</p>
        <p className="mt-2 font-mono text-[11px] leading-[1.7] text-fg1">
          {/*
            The character's innate is a hidden registry entry — granted at run
            start, never offered, never in a drawer slot. It is named here as the
            character, not listed as a relic the player chose.
          */}
          <span className="text-fg0">{CHARACTER_BY_CODE[state.characterCode]?.name}</span>
          {relicNames.length > 0 && <span className="text-fg2"> carrying </span>}
          {relicNames.join(' · ') || <span className="text-fg3"> · nothing else</span>}
        </p>
      </div>

      {/* Reserved for meta-progression. Deliberately empty (design Q4). */}

      <div className="mt-auto flex flex-none flex-col gap-2 pt-6">
        <div className="flex items-center gap-2 border border-dark3 bg-panel px-3 py-[10px]">
          <span className="font-mono text-[8px] leading-none tracking-[0.18em] text-fg2">SEED</span>
          <span className="font-mono text-[13px] font-bold tracking-[0.2em] text-fg0">
            {state.seed}
          </span>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(state.seed)}
            className="ml-auto min-h-[32px] border border-line-strong px-2 font-mono text-[9px] tracking-[0.12em] text-fg2"
          >
            COPY
          </button>
        </div>
        <Button primary arrow onClick={abandon}>
          NEW RUN
        </Button>
      </div>
    </div>
  );
}
