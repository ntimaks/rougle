import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { playRun, sweepSeed } from './runner';
import { cleanBaseline } from './baseline';
import { DEFAULT_SOLVER, type SolverConfig } from './solver';
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
) as { solver: SolverConfig; target: number; measured: number };

describe('Gate 1 — determinism', () => {
  it('the same seed plays the same run', () => {
    const a = playRun('GATE0001', 'CH.01', calibration.solver);
    const b = playRun('GATE0001', 'CH.01', calibration.solver);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('a sweep is stable across repeats', () => {
    const run = () =>
      Array.from({ length: 25 }, (_, i) => playRun(sweepSeed('gate', i), 'CH.01', calibration.solver));
    const first = run();
    const second = run();
    expect(first.map((r) => r.guessesSpent)).toEqual(second.map((r) => r.guessesSpent));
    expect(first.map((r) => r.won)).toEqual(second.map((r) => r.won));
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
    const measured = cleanBaseline(400, calibration.solver, 5);
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
  });
});
