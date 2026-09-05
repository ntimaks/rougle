import { BOSSES, CONFIG, PENDING_IMPLEMENTATION, REGISTRY } from '../lib/engine';
import { DECAY_CAVEAT, type SolverConfig } from './solver';
import type { RunResult } from './runner';

/**
 * The §10.3 report. MECHANICS.md is explicit that every budget in §2.2 is
 * provisional until this runs, so this is the artefact the balance work reads.
 */

export interface Report {
  runs: number;
  solver: SolverConfig;
  winRate: number;
  deathsByAct: number[];
  deathsByCause: Record<string, number>;
  /** MECHANICS.md §10.3: deaths attributable to word-list luck, not decisions. */
  wordLuckDeathRate: number;
  meanGuessesPerWord: number;
  meanGuessesPerWordByAct: number[];
  meanCleanFiveLetter: number;
  /** B-06: what each boss actually costs, in guesses. */
  meanBossGuesses: number[];
  medianWordsReached: number;
  meanEmergencyPurchases: number;
  medianEmergencyPurchases: number;
  meanFinalGold: number;
  relicPickRate: Record<string, number>;
  /** Win rate given the pair was held, minus the baseline. Flags degenerates. */
  coOccurrence: Array<{ pair: string; runs: number; winRate: number; deltaPP: number }>;
  unimplemented: string[];
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Pairs relics.json flags as degenerate, plus every pair that co-occurs enough. */
const FLAGGED_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['RL.21', 'RL.04'],
  ['RL.21', 'RL.07'],
  ['RL.30', 'RL.20'],
  ['RL.30', 'RL.21'],
];

export function buildReport(results: readonly RunResult[], solver: SolverConfig): Report {
  const wins = results.filter((r) => r.won);
  const deaths = results.filter((r) => !r.won);

  const deathsByAct = [0, 0, 0];
  const deathsByCause: Record<string, number> = {};
  for (const r of deaths) {
    deathsByAct[r.deathActIndex] = (deathsByAct[r.deathActIndex] ?? 0) + 1;
    const cause = r.deathCause ?? 'UNKNOWN';
    deathsByCause[cause] = (deathsByCause[cause] ?? 0) + 1;
  }

  /*
   * Word-list luck (MECHANICS.md §10.3, target <5% of deaths).
   *
   * A death counts as word luck when, at the guess that emptied the pool, the
   * bot still held the answer AND could not distinguish it from at least one
   * other candidate. That is the §8.1 failure mode: a position where correct
   * play still loses, because the remaining candidates differ by one letter and
   * there is no guess that separates them in the budget left.
   *
   * Deaths where the answer had already been eliminated are decision quality or
   * vocabulary, not luck. Deaths with exactly one candidate left are budget:
   * the bot knew the word and had no guess left to type it with.
   */
  const luckDeaths = deaths.filter(
    (r) => r.deathWithAnswerKnown && r.deathCandidatesRemaining >= 2,
  ).length;

  const byAct: number[][] = [[], [], []];
  for (const r of results) r.guessesPerWordByAct.forEach((xs, i) => byAct[i]!.push(...xs));
  const bossByAct: number[][] = [[], [], []];
  for (const r of results) r.bossGuessesByAct.forEach((xs, i) => bossByAct[i]!.push(...xs));

  const pickCounts: Record<string, number> = {};
  for (const r of results) for (const code of new Set(r.relicsTaken)) {
    pickCounts[code] = (pickCounts[code] ?? 0) + 1;
  }
  const relicPickRate = Object.fromEntries(
    Object.entries(pickCounts)
      .map(([code, n]) => [code, n / results.length] as const)
      .sort((a, b) => b[1] - a[1]),
  );

  const baseline = wins.length / Math.max(1, results.length);
  const coOccurrence = FLAGGED_PAIRS.map(([a, b]) => {
    const held = results.filter((r) => r.relicsTaken.includes(a) && r.relicsTaken.includes(b));
    const rate = held.length ? held.filter((r) => r.won).length / held.length : 0;
    return {
      pair: `${a}+${b}`,
      runs: held.length,
      winRate: rate,
      deltaPP: held.length ? (rate - baseline) * 100 : 0,
    };
  });

  return {
    runs: results.length,
    solver,
    winRate: baseline,
    deathsByAct,
    deathsByCause,
    wordLuckDeathRate: deaths.length ? luckDeaths / deaths.length : 0,
    meanGuessesPerWord: mean(results.flatMap((r) => r.guessesPerWord)),
    meanGuessesPerWordByAct: byAct.map(mean),
    meanCleanFiveLetter: mean(results.flatMap((r) => r.cleanFiveLetterGuesses)),
    meanBossGuesses: bossByAct.map(mean),
    medianWordsReached: median(results.map((r) => r.guessesPerWord.length)),
    meanEmergencyPurchases: mean(results.map((r) => r.emergencyPurchases)),
    medianEmergencyPurchases: median(results.map((r) => r.emergencyPurchases)),
    meanFinalGold: mean(results.map((r) => r.finalGold)),
    relicPickRate,
    coOccurrence,
    unimplemented: Object.keys(PENDING_IMPLEMENTATION),
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

function verdict(ok: boolean): string {
  return ok ? 'OK ' : 'OFF';
}

export function formatReport(report: Report): string {
  const lines: string[] = [];
  const push = (s = '') => lines.push(s);

  push(`ROUGLE BALANCE REPORT · ${report.runs} runs`);
  push(
    `solver: suboptimality=${report.solver.suboptimality} memoryDecay=${report.solver.memoryDecay} ` +
      `vocabularyGap=${report.solver.vocabularyGap} searchWidth=${report.solver.searchWidth}`,
  );
  push();
  push('MECHANICS.md §10.3 targets');
  push('  metric                          value      target        ');
  push(
    `  win rate                        ${pct(report.winRate).padEnd(10)} 25–35%        ${verdict(report.winRate >= 0.25 && report.winRate <= 0.35)}`,
  );
  push(
    `  act I death rate                ${pct(report.deathsByAct[0]! / report.runs).padEnd(10)} <15%          ${verdict(report.deathsByAct[0]! / report.runs < 0.15)}`,
  );
  push(
    `  word-luck deaths                ${pct(report.wordLuckDeathRate).padEnd(10)} <5% of deaths ${verdict(report.wordLuckDeathRate < 0.05)}`,
  );
  push(
    `  median emergency purchases      ${String(report.medianEmergencyPurchases).padEnd(10)} >0            ${verdict(report.medianEmergencyPurchases > 0)}`,
  );
  push();
  push('Guesses per word');
  push(`  overall                         ${report.meanGuessesPerWord.toFixed(2)}`);
  push(
    `  clean 5-letter (calibration)    ${report.meanCleanFiveLetter.toFixed(2)}   ` +
      `human baseline 3.9, strong solver 3.5`,
  );
  report.meanGuessesPerWordByAct.forEach((v, i) => {
    const budget = CONFIG.acts[i]!;
    push(`  act ${i + 1}                           ${v.toFixed(2)}   pool ${budget.pool}`);
  });
  push();
  push('Bosses (B-06 — what a boss actually costs, in guesses)');
  report.meanBossGuesses.forEach((v, i) => {
    // Read from the registry: the act order changed once already (R-019) and a
    // hardcoded label would have gone on quietly reporting the wrong boss.
    const boss = BOSSES[i as 0 | 1 | 2];
    const shape =
      boss.ownPool !== null
        ? `${boss.words} words, own pool ${boss.ownPool}`
        : boss.deferralDepth > 0
          ? `deferral ${boss.deferralDepth}`
          : boss.modifiers.join(' ').toLowerCase() || 'plain';
    push(`  act ${i + 1} ${`${boss.name} (${shape})`.padEnd(38)} ${v ? v.toFixed(2) : '—'}`);
  });
  push(
    '  §2.2 counts the Twins as 2 word-equivalents (7.3 guesses). §13 I-10 expects it to',
  );
  push('  cost less because information is shared — and the measurement agrees.');
  push();
  push('Deaths');
  push(`  by act    I ${report.deathsByAct[0]}  II ${report.deathsByAct[1]}  III ${report.deathsByAct[2]}`);
  for (const [cause, n] of Object.entries(report.deathsByCause).sort((a, b) => b[1] - a[1])) {
    push(`  ${cause.padEnd(24)} ${n}`);
  }
  push();
  push('Economy');
  push(`  mean emergency purchases        ${report.meanEmergencyPurchases.toFixed(2)}`);
  push(`  mean gold unspent at end        ${report.meanFinalGold.toFixed(0)}`);
  push(`  median words reached            ${report.medianWordsReached}`);
  push();
  push('Relic pick rate (offered-and-taken / runs)');
  for (const [code, rate] of Object.entries(report.relicPickRate).slice(0, 15)) {
    push(`  ${code} ${(REGISTRY[code]?.name ?? '').padEnd(16)} ${pct(rate)}`);
  }
  push();
  push('Flagged co-occurrences (relics.json balance_flag)');
  for (const c of report.coOccurrence) {
    const note = c.runs === 0 ? 'never co-occurred (one or both unimplemented)' : `${c.deltaPP >= 15 ? 'FLAG ' : ''}${c.deltaPP.toFixed(1)}pp vs baseline`;
    push(`  ${c.pair.padEnd(14)} n=${String(c.runs).padEnd(5)} ${note}`);
  }
  push();
  push('Caveats');
  push(`  · ${DECAY_CAVEAT}`);
  push(
    `  · Every act budget in MECHANICS.md §2.2 is provisional. These numbers are what`,
  );
  push('    replaces them, not a check that they were right.');
  push(
    `  · ${report.unimplemented.length} relics are not implemented yet, so build variety is`,
  );
  push(`    understated: ${report.unimplemented.join(' ')}`);
  push(
    '  · Shops, forges, events and branching routes are Phase 3. Runs here are linear,',
  );
  push('    so gold sinks and route choice are both missing from the economy.');
  push(
    '  · The solver does not fire player activations (R-015). It holds RL.07, RL.20,',
  );
  push(
    '    RL.21, RL.28 and CH.03 without using them, so their pick rates and their',
  );
  push('    contribution to the win rate are understated.');
  return lines.join('\n');
}
