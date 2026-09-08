import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONFIG } from '../lib/engine';
import { playRun, sweepSeed } from './runner';
import { cleanBaseline } from './baseline';
import { DEFAULT_SOLVER, resetSolverCaches, type SolverConfig } from './solver';
import { buildReport } from './report';

/**
 * H-01/H-02 acceptance, and the Gate 1 determinism check at the run level.
 *
 * Gate 1: "does the harness play seeded runs headlessly with a stable
 * guesses-per-word number?" If it moves between identical runs, determinism is
 * broken and every balance number after that is invalid.
 */

const calibration = JSON.parse(
  readFileSync(resolve(__dirname, 'calibration.json'), 'utf8'),
) as { solver: SolverConfig; target: number; measured: number; wordsPerProbe?: number };

describe('Gate 1 — determinism', () => {
  it('the same seed plays the same run', () => {
    const a = playRun('GATE0001', 'CH.01', calibration.solver);
    const b = playRun('GATE0001', 'CH.01', calibration.solver);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  const sweep = (n: number, cfg = CONFIG) =>
    Array.from({ length: n }, (_, i) => playRun(sweepSeed('gate', i), 'CH.01', calibration.solver, cfg));

  it('a sweep is stable across repeats', () => {
    // Whole results, not just two fields: the leak this guards against moved
    // gold and death causes long before it moved a guess count. 40 runs rather
    // than a handful, because the solver's caches collide by chance and a
    // sample too small to collide reports a determinism the harness lacks.
    expect(sweep(40).map((r) => JSON.stringify(r))).toEqual(sweep(40).map((r) => JSON.stringify(r)));
  });

  it('a run does not depend on the runs executed before it', () => {
    // The one that catches a solver cache keyed on too little. A run replayed
    // on its own must match the same run inside a batch — if it does not, the
    // bot is carrying something from an unrelated run and a sweep measures the
    // order its configs happened to execute. §13 I-30.
    const batch = sweep(40);
    for (const i of [0, 7, 23, 39]) {
      const alone = playRun(sweepSeed('gate', i), 'CH.01', calibration.solver);
      expect(JSON.stringify(alone)).toBe(JSON.stringify(batch[i]));
    }
  });

  it('the solver caches are memoization, not state', () => {
    // The decisive one. A cache keyed on less than its answer depends on can
    // stay consistent for a whole process and only diverge once something
    // evicts — `narrowCache` needed 20k entries, about 150 runs, so a sweep of
    // 40 saw nothing and a sweep of 600 measured the order its configs ran in.
    // Clearing between runs makes every such key fail at once, at any size.
    const warm = sweep(25);
    const cold = Array.from({ length: 25 }, (_, i) => {
      resetSolverCaches();
      return playRun(sweepSeed('gate', i), 'CH.01', calibration.solver);
    });
    expect(cold.map((r) => JSON.stringify(r))).toEqual(warm.map((r) => JSON.stringify(r)));
  });

  it('different seeds produce different runs', () => {
    const a = playRun(sweepSeed('gate', 1), 'CH.01', calibration.solver);
    const b = playRun(sweepSeed('gate', 2), 'CH.01', calibration.solver);
    expect(a.guessesPerWord).not.toEqual(b.guessesPerWord);
  });
});

describe('H-01 — the solver', () => {
  it('solves clean 5-letter words at or below 3.5 with no handicap', () => {
    expect(cleanBaseline(300, DEFAULT_SOLVER, 5)).toBeLessThanOrEqual(3.5);
  });

  it('the committed calibration still reproduces its measurement', () => {
    // At the sample size the calibration actually used. This probed 400 for a
    // long time, which is where the estimator's own noise is about ±0.05 —
    // wide enough that the calibration could stop 0.06 short of its target and
    // this test would still pass. `wordsPerProbe` is recorded in the file so
    // the check and the calibration cannot drift apart again.
    const n = calibration.wordsPerProbe ?? 400;
    const measured = cleanBaseline(n, calibration.solver, 5);
    expect(measured).toBeCloseTo(calibration.measured, 1);
    expect(Math.abs(measured - calibration.target)).toBeLessThan(0.06);
  });

  it('never returns an illegal guess length', () => {
    const result = playRun('LEGALITY', 'CH.01', calibration.solver);
    expect(result.guessesSpent).toBeGreaterThan(0);
  });
});

describe('runs terminate and stay inside the rules', () => {
  it('every run ends in a win or a named death cause', () => {
    for (let i = 0; i < 40; i++) {
      const r = playRun(sweepSeed('terminate', i), 'CH.01', calibration.solver);
      if (r.won) expect(r.deathCause).toBeNull();
      else expect(r.deathCause).toBeTruthy();
      expect(r.turns).toBeLessThan(4000);
    }
  });

  it('a winning run solves all twenty words', () => {
    const wins = Array.from({ length: 40 }, (_, i) =>
      playRun(sweepSeed('terminate', i), 'CH.01', calibration.solver),
    ).filter((r) => r.won);
    expect(wins.length).toBeGreaterThan(0);
    // 12 solve nodes + 3 boss encounters, the Gauntlet counting as five words
    // but resolving as one node.
    for (const w of wins) expect(w.guessesPerWord.length).toBe(19);
  });

  it('gold never goes negative', () => {
    for (let i = 0; i < 20; i++) {
      expect(playRun(sweepSeed('gold', i), 'CH.01', calibration.solver).finalGold).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('the report', () => {
  it('reports every §10.3 metric and names what is still missing', () => {
    const results = Array.from({ length: 30 }, (_, i) =>
      playRun(sweepSeed('report', i), 'CH.01', calibration.solver),
    );
    const report = buildReport(results, calibration.solver);
    expect(report.runs).toBe(30);
    expect(report.winRate).toBeGreaterThanOrEqual(0);
    expect(report.meanGuessesPerWord).toBeGreaterThan(1);
    expect(report.deathsByAct).toHaveLength(3);
    expect(report.unimplemented.length).toBeGreaterThan(0);
    // Absent unless the second sweep was actually run, so a report that did not
    // measure the no-relic target cannot quietly print a 0% and pass it.
    expect(report.noRelicWinRate).toBeNull();
    expect(report.noRelicDeathsByAct).toBeNull();
  });

  it('reports §10.3\'s no-relic target when given the second sweep', () => {
    const seeds = Array.from({ length: 20 }, (_, i) => sweepSeed('report', i));
    const withRelics = seeds.map((s) => playRun(s, 'CH.01', calibration.solver));
    const without = seeds.map((s) =>
      playRun(s, 'CH.01', calibration.solver, CONFIG, { noRelics: true }),
    );
    const report = buildReport(withRelics, calibration.solver, without);
    expect(report.noRelicWinRate).toBeLessThan(report.winRate);
    expect(report.noRelicDeathsByAct).toHaveLength(3);
    const total = report.noRelicDeathsByAct!.reduce((a, b) => a + b, 0);
    expect(total + report.noRelicWinRate!).toBeCloseTo(1, 5);
  });
});
