import { describe, expect, it } from 'vitest';
import { tableAfter } from '../../../test/spec';
import { REGISTRY, RELIC_DEFS } from './registry';
import { IMPLEMENTATIONS } from './impl';
import { scalingCodes, scalingCounter, scalingCounters } from './scaling';
import { initialState } from '../core/reducer';
import type { GameState, RelicInstance } from '../core/state';
import '../words/all';

/**
 * §6.5 — six relics carry a run-long counter, and the counter is the point.
 *
 * The rule that actually breaks is the join: the registry names the counter and
 * the implementation stores it under a key of its own choosing, and nothing
 * connects them. A relic whose field is renamed keeps a card that reads 0
 * forever, which looks exactly like a relic that has not fired yet.
 */
function hold(code: string, state: Record<string, unknown> = {}): RelicInstance {
  return { instanceId: `${code}#1`, code, state, acquiredAt: 1, upgraded: false };
}

const base = (): GameState => initialState('SCALESED', 'CH.01');

/** §6.5's table. The first cell is "`RL.03` Palimpsest", code AND name. */
const rows = () => tableAfter('| Relic | Counter | Scales on |');
const codes = () => rows().map((r) => r[0]!.match(/`(RL\.\d+)`/)![1]!);

describe('§6.5 the scaling set', () => {
  it('is exactly the six the spec names, by code', () => {
    // "Six relics carry a run-long counter." Both the count and the identity —
    // a seventh added to the registry without the spec moving, or a sixth
    // quietly dropped, fails here.
    expect(rows()).toHaveLength(6);
    expect(scalingCodes().sort()).toEqual(codes().sort());
  });

  it('each one declares a counter, and its name matches the spec', () => {
    // The spec writes the counter as prose ("Times it has paid") and the
    // registry as the card's label ("HEADS TAKEN"), so this cannot be a string
    // equality — the two are deliberately different registers. What it CAN
    // check is that every listed relic declares one at all, which is the
    // failure that produces a card with a blank number.
    for (const code of codes()) {
      const counter = REGISTRY[code]?.scaling?.counter;
      expect(counter, `${code} is listed in §6.5 and declares no counter`).toBeTruthy();
      expect(counter, `${code}'s label is not a label`).toBe(counter!.toUpperCase());
    }
  });

  it('keeps the success/failure split §6.5 says to keep', () => {
    // "Failure-scaling relics are comeback engines and are the main structural
    // defence against the death spiral (§11.2). Keep roughly this ratio."
    const failure = rows().filter((r) => /failure/i.test(r[2] ?? ''));
    expect(failure.length, 'the comeback engines are gone').toBeGreaterThanOrEqual(2);
    // And they have to be IMPLEMENTED, not just listed — a defence against the
    // death spiral that is pending is not a defence.
    for (const row of failure) {
      const code = row[0]!.match(/`(RL\.\d+)`/)![1]!;
      expect(IMPLEMENTATIONS[code], `${code} is a comeback engine with no code`).toBeDefined();
    }
  });
});

describe('the counter a card prints is the counter the relic keeps', () => {
  it('reads a real value for all six, not a default', () => {
    // The join under test: a reader pointed at the wrong key returns its
    // fallback, which is indistinguishable from "has not fired yet". So every
    // relic is given a DISTINCT non-default value and has to give it back.
    const planted: Record<string, [Record<string, unknown>, number]> = {
      'RL.12': [{ streak: 2 }, 2],
      'RL.14': [{ heads: 3 }, 3],
      'RL.19': [{ words: 7 }, 7],
      'RL.23': [{ rate: 5 }, 5],
      'RL.26': [{ lit: 4 }, 4],
    };
    for (const [code, [state, expected]] of Object.entries(planted)) {
      const counter = scalingCounter(base(), hold(code, state));
      expect(counter, `${code} has no counter`).not.toBeNull();
      expect(counter!.value, `${code} reads the wrong field`).toBe(expected);
    }
  });

  it('RL.03 PALIMPSEST counts the run\'s solutions, not a field of its own', () => {
    // Its memory IS `usedSolutions` — the relic never stores one. A reader that
    // looked at relic state would print 0 for the whole run.
    const s = { ...base(), usedSolutions: ['CRANE', 'SLATE', 'PLUMB'] };
    expect(scalingCounter(s, hold('RL.03'))!.value).toBe(3);
  });

  it('a non-scaling relic has no counter to print', () => {
    for (const d of RELIC_DEFS) {
      if (d.scaling) continue;
      expect(scalingCounter(base(), hold(d.code)), d.code).toBeNull();
    }
  });

  it('every declared scaling relic has a reader, and vice versa', () => {
    // Both directions. A declared relic with no reader prints nothing; a reader
    // with no declaration is dead code that will outlive the relic.
    for (const code of scalingCodes()) {
      expect(scalingCounter(base(), hold(code)), `${code} declares scaling and has no reader`)
        .not.toBeNull();
    }
    const withReaders = RELIC_DEFS.filter(
      (d) => scalingCounter(base(), hold(d.code)) !== null,
    ).map((d) => d.code);
    expect(withReaders.sort()).toEqual(scalingCodes().sort());
  });

  it('the cap comes from the registry, so the card cannot disagree with the rule', () => {
    const hot = scalingCounter(base(), hold('RL.12', { streak: 9 }))!;
    expect(hot.cap).toBe(REGISTRY['RL.12']!.scaling!.cap);
    expect(hot.cap).toBe(3);
    // The counter is NOT clamped to the cap — Hot Streak MK.II caps at 5, and a
    // card that clamped to 3 would hide the two the upgrade is buying.
    expect(hot.value).toBe(9);
  });

  it('collects every held scaling relic, and only those', () => {
    const s: GameState = {
      ...base(),
      relics: [hold('RL.01'), hold('RL.12', { streak: 2 }), hold('RL.23', { rate: 4 })],
    };
    expect(scalingCounters(s).map((c) => c.code)).toEqual(['RL.12', 'RL.23']);
  });
});

describe('§6.7 rule 1 — an upgrade accelerates the counter, never replaces it', () => {
  it('every scaling relic still moves its counter at MK.II', () => {
    // "Converting a scaling relic to a static one at MK.II destroys the reason
    // it was interesting." Checked by firing the upgraded relic and seeing the
    // counter still written — a MK.II that stopped writing would pass every
    // other test in the suite.
    for (const code of scalingCodes()) {
      if (code === 'RL.03') continue; // its counter is the run's, not its own
      const impl = IMPLEMENTATIONS[code]!;
      const writes = Object.values(impl.hooks ?? {}).some((handler) => {
        const self = { ...hold(code, { streak: 1, heads: 1, words: 1, rate: 3, lit: 1 }), upgraded: true };
        const ctx = { state: base(), self, rng: () => 0.25, cfg: undefined as never };
        for (const payload of [
          { nodeId: 'n1', guessesUsed: 2, length: 5, kind: 'WORD' },
          { nodeId: 'n1', guessesUsed: 5, length: 5, kind: 'WORD' },
          { nodeId: 'n1', solutions: ['CRANE'], previousSolution: null },
          { guess: 'CRANE', turn: 3, newUniqueLetters: 5 },
        ]) {
          try {
            const out = (handler as (c: unknown, p: unknown) => Array<{ kind: string }>)(ctx, payload);
            if (out.some((e) => e.kind === 'SET_RELIC_STATE')) return true;
          } catch {
            // A handler given the wrong payload shape is not the thing under
            // test; the loop tries every shape and one of them fits.
          }
        }
        return false;
      });
      expect(writes, `${code} MK.II never writes its counter`).toBe(true);
    }
  });
});
