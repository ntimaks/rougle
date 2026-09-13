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
 * What the ENGINE implements — the same document again.
 *
 * This pointed at `docs/archive/MECHANICS-v1.3.md` through the migration,
 * because the spec was v2.0 while the reducer was still the per-act pool, and
 * a test asserting v1.3 behaviour against a v2.0 document would have had to be
 * deleted or skipped. §2 has landed, so it is one spec again.
 *
 * The alias stays rather than being inlined: it is the seam a future migration
 * uses, and it costs one line.
 */
export const LIVE_SPEC = SPEC;

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
