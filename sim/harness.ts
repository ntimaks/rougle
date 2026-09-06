import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONFIG, type CharacterCode } from '../lib/engine';
import { playRun, sweepSeed, type RunOptions, type RunResult } from './runner';
import { buildReport, formatReport } from './report';
import { DEFAULT_SOLVER, type SolverConfig } from './solver';

/**
 * The headless harness. MECHANICS.md §10.1, technical brief §9.
 *
 * Built in Phase 1, not Phase 5: every number in §2.2 is a derived estimate
 * until this replaces it with a measurement.
 *
 *   npm run sim -- --runs 1000
 *   npm run sim -- --runs 1000 --character CH.02 --snapshot 001
 *   npm run sim -- --runs 1000 --no-relics --no-reveals
 *
 * This is also the CI canary for the engine boundary (ticket S-05). It runs
 * under plain `tsx` with no Next build; if it fails on module resolution,
 * something imported a Next module into `lib/engine` and every balance number
 * after that commit is suspect.
 */

interface Args {
  runs: number;
  character: CharacterCode;
  label: string;
  snapshot: string | null;
  noRelics: boolean;
  /**
   * Turn off the §2.5 reveal policy. `runner` has always honoured this, but no
   * flag reached it, so `--no-reveals` was silently ignored and every "with vs
   * without reveals" comparison anyone ran was the same sweep twice.
   */
  noReveals: boolean;
  quiet: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    runs: Number(get('--runs') ?? 50),
    character: (get('--character') ?? 'CH.01') as CharacterCode,
    label: get('--label') ?? 'sweep',
    snapshot: get('--snapshot') ?? null,
    noRelics: argv.includes('--no-relics'),
    noReveals: argv.includes('--no-reveals'),
    quiet: argv.includes('--quiet'),
  };
}

function loadCalibration(): SolverConfig {
  const path = resolve('sim/calibration.json');
  if (!existsSync(path)) return DEFAULT_SOLVER;
  try {
    const saved = JSON.parse(readFileSync(path, 'utf8')) as { solver?: Partial<SolverConfig> };
    return { ...DEFAULT_SOLVER, ...(saved.solver ?? {}) };
  } catch {
    return DEFAULT_SOLVER;
  }
}

export function sweep(
  runs: number,
  character: CharacterCode,
  solver: SolverConfig,
  label: string,
  options: RunOptions = {},
): RunResult[] {
  const out: RunResult[] = [];
  for (let i = 0; i < runs; i++) {
    out.push(playRun(sweepSeed(label, i), character, solver, CONFIG, options));
  }
  return out;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const solver = loadCalibration();

  const started = Date.now();
  const results = sweep(args.runs, args.character, solver, args.label, {
    noRelics: args.noRelics,
    noReveals: args.noReveals,
  });
  const elapsed = Date.now() - started;

  const report = buildReport(results, solver);
  if (!args.quiet) {
    process.stdout.write(`${formatReport(report)}\n`);
    process.stdout.write(
      `\n${args.runs} runs in ${(elapsed / 1000).toFixed(1)}s ` +
        `(${(elapsed / args.runs).toFixed(0)}ms/run)\n`,
    );
  }

  if (args.snapshot) {
    const path = resolve(`docs/balance/${args.snapshot}.json`);
    writeFileSync(path, `${JSON.stringify({ ...report, elapsedMs: elapsed }, null, 2)}\n`, 'utf8');
    process.stdout.write(`snapshot → ${path}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
