import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Reading MECHANICS.md from the tests.
 *
 * MECHANICS.md §0 makes the document normative for rules, and the numbers in it
 * are the ones a balance pass moves. Asserting against the spec text rather than
 * against retyped literals is what makes "the code and the doc disagree" a test
 * failure instead of something someone notices six snapshots later — which is
 * exactly how the Gauntlet's rule text came to read "ITS OWN POOL OF 14" while
 * the pool was 10.
 *
 * Not a `.test.ts`, so vitest does not collect it as a suite.
 */
export const SPEC = readFileSync(resolve(__dirname, '../MECHANICS.md'), 'utf8');

/**
 * What the ENGINE currently implements, which during the v1.3 → v2.0 migration
 * is not what `MECHANICS.md` says. The spec is v2.0; the reducer is still the
 * per-act pool. Tests over v1.3 behaviour assert against the archived v1.3
 * document, so they keep meaning something instead of being deleted or skipped
 * while the migration runs.
 *
 * One line to flip when §2 lands: point this at `../MECHANICS.md` and the whole
 * suite is asserting against one spec again.
 */
export const LIVE_SPEC = readFileSync(
  resolve(__dirname, '../docs/archive/MECHANICS-v1.3.md'),
  'utf8',
);

/**
 * The rows of the first markdown table following `heading`, header and rule
 * row dropped, each row split into trimmed cells.
 *
 * Stops at the first non-table line. An earlier version sliced from the heading
 * and filtered every remaining line in the file, which quietly pulled rows out
 * of unrelated tables further down and made the assertions meaningless in the
 * one direction that matters — they still passed.
 */
export function tableAfter(heading: string, text: string = SPEC): string[][] {
  const start = text.indexOf(heading);
  if (start < 0) throw new Error(`spec is missing "${heading}"`);
  const rows: string[][] = [];
  for (const line of text.slice(start).split('\n')) {
    if (!line.startsWith('|')) {
      if (rows.length > 0) break;
      continue;
    }
    if (/^\|\s*:?-+:?\s*\|/.test(line)) continue; // the |---|---| rule
    rows.push(line.split('|').slice(1, -1).map((c) => c.trim()));
  }
  return rows.slice(1); // drop the header
}

/** First integer in a cell, sign-aware, tolerating the spec's en-dash minus. */
export function num(cell: string): number {
  const m = cell.replace(/−/g, '-').match(/-?\d+(?:\.\d+)?/);
  if (!m) throw new Error(`no number in "${cell}"`);
  return Number(m[0]);
}
