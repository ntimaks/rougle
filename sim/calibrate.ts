import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanBaseline } from './baseline';
import { DEFAULT_SOLVER, type SolverConfig } from './solver';

/**
 * H-03 — calibrate the solver handicap to the human baseline.
 *
 * MECHANICS.md §10.2: a simple entropy solver plays better than a human,
 * roughly 3.4 guesses/word against a human 3.9. Tune to the HUMAN baseline, and
 * apply the offset explicitly rather than tuning until the bot's win rate looks
 * right — a win rate massaged into the target band tells you nothing about
 * whether the budgets are correct.
 *
 * This sweeps `suboptimality` (probability of taking the second-best guess)
 * until mean guesses per word on clean 5-letter words hits 3.9, then writes
 * `sim/calibration.json`. The harness reads that file, so every later sweep
 * runs at the calibrated handicap without anyone remembering to pass a flag.
 *
 *   npm run calibrate -- --runs 120
 */

const TARGET_CLEAN_FIVE = 3.9;
const TOLERANCE = 0.03;

function probe(words: number, solver: SolverConfig): number {
  return cleanBaseline(words, solver, 5);
}

/** Bisects one knob of the handicap. Both are monotone in guesses/word. */
function bisect(
  words: number,
  base: SolverConfig,
  knob: 'suboptimality' | 'vocabularyGap',
  hiBound: number,
): { value: number; mean: number } {
  let lo = 0;
  let hi = hiBound;
  let best = 0;
  let bestMean = probe(words, { ...base, [knob]: 0 });
  process.stdout.write(`  ${knob} 0.0000 -> ${bestMean.toFixed(3)}\n`);

  for (let step = 0; step < 10; step++) {
    const mid = (lo + hi) / 2;
    const mean = probe(words, { ...base, [knob]: mid });
    process.stdout.write(`  ${knob} ${mid.toFixed(4)} -> ${mean.toFixed(3)}\n`);
    if (Math.abs(mean - TARGET_CLEAN_FIVE) < Math.abs(bestMean - TARGET_CLEAN_FIVE)) {
      best = mid;
      bestMean = mean;
    }
    if (Math.abs(mean - TARGET_CLEAN_FIVE) <= TOLERANCE) return { value: mid, mean };
    if (mean < TARGET_CLEAN_FIVE) lo = mid;
    else hi = mid;
  }
  return { value: best, mean: bestMean };
}

function main(): void {
  const argv = process.argv.slice(2);
  const runsFlag = argv.indexOf('--runs');
  const words = runsFlag >= 0 ? Number(argv[runsFlag + 1]) : 400;

  process.stdout.write(`Calibrating the solver handicap to ${TARGET_CLEAN_FIVE} guesses/word\n`);
  process.stdout.write(`(${words} clean 5-letter words per probe, no relics, no modifiers)\n\n`);

  process.stdout.write('Stage 1 — suboptimality\n');
  let solver: SolverConfig = { ...DEFAULT_SOLVER };
  const stage1 = bisect(words, solver, 'suboptimality', 1);
  solver = { ...solver, suboptimality: Number(stage1.value.toFixed(4)) };
  let mean = stage1.mean;
  let note = 'suboptimality alone reached the baseline.';

  if (Math.abs(mean - TARGET_CLEAN_FIVE) > TOLERANCE) {
    // suboptimality saturates: even always playing a plausible candidate rather
    // than the optimal probe only reaches ~3.76 on this list, because §8.1's
    // curation removed the ambiguity clusters that produce the long human
    // solves the 3.9 baseline was measured against.
    process.stdout.write('\nStage 1 saturated below the baseline. Pinning it at 1.0.\n');
    process.stdout.write('Stage 2 — vocabularyGap\n');
    solver = { ...solver, suboptimality: 1 };
    const stage2 = bisect(words, solver, 'vocabularyGap', 0.6);
    solver = { ...solver, vocabularyGap: Number(stage2.value.toFixed(4)) };
    mean = stage2.mean;
    note =
      'suboptimality saturated at ~3.76 and could not reach 3.9 alone, so the ' +
      'remainder is carried by vocabularyGap. Worth knowing why: §8.1 curation ' +
      'removes the ambiguity clusters that produce the long human solves the 3.9 ' +
      'figure was measured against, so Rougle words are genuinely easier than ' +
      'Wordle words and the MECHANICS.md §2.2 budgets derived from 3.9 are ' +
      'correspondingly more generous than intended. See docs/decisions/ADR-0007.';
  }

  const payload = {
    target: TARGET_CLEAN_FIVE,
    measured: Number(mean.toFixed(3)),
    wordsPerProbe: words,
    note,
    howToUse:
      'The harness reads this file, so every sweep runs at the calibrated ' +
      'handicap. Also sweep at suboptimality 0 for the ceiling, and balance to ' +
      'the band between the two (MECHANICS.md §10.2).',
    solver,
  };
  const path = resolve('sim/calibration.json');
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `\nsuboptimality=${solver.suboptimality} vocabularyGap=${solver.vocabularyGap} ` +
      `-> ${mean.toFixed(3)} guesses/word\n`,
  );
  process.stdout.write(`written -> ${path}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
