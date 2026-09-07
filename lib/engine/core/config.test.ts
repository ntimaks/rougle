import { describe, expect, it } from 'vitest';
import { LIVE_SPEC, tableAfter as tableIn } from '../../../test/spec';
import { CONFIG } from './config';

/**
 * MECHANICS.md is normative, and `config.ts` is the only place its numbers are
 * allowed to live in code. This asserts the two agree, by reading the spec.
 *
 * Written after a tuning pass left the Gauntlet's on-screen rule text saying
 * "ITS OWN POOL OF 14" while the pool was 10. Every number below is one a
 * balance snapshot is expected to move; the point is not to freeze them but to
 * make moving one in code without writing it down fail here.
 */
/**
 * Asserted against the ARCHIVED v1.3 spec, not `MECHANICS.md`, for as long as
 * the engine implements v1.3 and the document is v2.0. See `test/spec.ts`.
 */
const SPEC = LIVE_SPEC;
const tableAfter = (heading: string) => tableIn(heading, LIVE_SPEC);

const gold = (cell: string): number => {
  const m = cell.match(/(\d+)g/);
  expect(m, `no gold figure in "${cell}"`).not.toBeNull();
  return Number(m![1]);
};

describe('config.ts matches the spec the engine implements (v1.3)', () => {
  it('§2.2 — the act pools', () => {
    const rows = tableAfter('| Act | Pool | Solve nodes | Boss |');
    expect(rows).toHaveLength(3);
    rows.forEach((row, i) => {
      expect(Number(row[1]), `act ${row[0]} pool`).toBe(CONFIG.acts[i]!.pool);
      expect(Number(row[2]?.replace(/\D/g, '')), `act ${row[0]} solve nodes`).toBe(
        CONFIG.acts[i]!.solveNodes,
      );
    });
  });

  it('§2.3 — the emergency ladder', () => {
    const rows = tableAfter('| Purchase | Cost |');
    const priced = rows.filter((r) => /\d/.test(r[1] ?? ''));
    expect(priced.map((r) => gold(r[1]!))).toEqual([...CONFIG.emergencyCosts]);
    // The row after the last price must close the ladder, so the table's length
    // is the cap and a fourth purchase is off the end rather than free.
    expect(rows[priced.length]?.[1]).toBe('Unavailable');
  });

  it('§2.5 — the reveal ladder', () => {
    const rows = tableAfter('| Reveal | Cost |');
    const priced = rows.filter((r) => /\d/.test(r[1] ?? ''));
    expect(priced.map((r) => gold(r[1]!))).toEqual([...CONFIG.revealCosts]);
    expect(rows[priced.length]?.[1]).toBe('Unavailable');
  });

  it('§3.3 — node rewards', () => {
    const rows = tableAfter('| Node | Reward |');
    const by = (name: string) => rows.find((r) => r[0] === name)?.[1] ?? '';
    expect(gold(by('Word'))).toBe(CONFIG.rewards.wordGoldInstead);
    expect(gold(by('Elite'))).toBe(CONFIG.rewards.elite);
    expect(gold(by('Boss'))).toBe(CONFIG.rewards.boss);
  });

  it('§2.2 and §7.3 — the Gauntlet pool, in all three places it is written', () => {
    const stated = [...SPEC.matchAll(/(?:fixed,?\s+separate|separate)\s+pool\s+of\s+(\d+)/gi)].map(
      (m) => Number(m[1]),
    );
    expect(stated.length, 'MECHANICS.md no longer states the Gauntlet pool').toBeGreaterThan(0);
    for (const n of stated) expect(n).toBe(CONFIG.gauntlet.pool);
  });

  it('§2.1 — leftover guesses convert at the stated rate', () => {
    expect(SPEC).toContain(`base rate **${CONFIG.goldPerLeftoverGuess}g each**`);
  });
});
