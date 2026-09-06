import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EFFECT_VERBS, EVENTS, EVENT_DEFS, eventsForAct, verbsIn } from './events';
import { MODIFIERS } from './modifiers';
import { RARITIES } from './registry';

/**
 * R-022 / §6.8. The same validation contract the relic registry gets, for the
 * same reason: content in a JSON file drifts from the code that reads it unless
 * something fails loudly.
 *
 * Several of these encode §6.8's *content* rules rather than its schema — an
 * event that hides its odds or offers no way out is a design bug that no type
 * can catch, and it is much cheaper to catch here than in a playtest.
 */

describe('events.json schema', () => {
  it('codes are unique', () => {
    const codes = EVENT_DEFS.map((e) => e.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('every effect verb is in the closed vocabulary', () => {
    for (const e of EVENT_DEFS) {
      for (const o of e.options) {
        for (const verb of verbsIn(o.effect)) {
          expect(EFFECT_VERBS, `${e.code}/${o.key} uses "${verb}"`).toContain(verb);
        }
      }
    }
  });

  it('every acts entry is a real 1-indexed act', () => {
    for (const e of EVENT_DEFS) {
      expect(e.acts.length, `${e.code} is drawable in no act`).toBeGreaterThan(0);
      for (const a of e.acts) expect([1, 2, 3], `${e.code}`).toContain(a);
    }
  });

  it('option keys are unique within an event', () => {
    for (const e of EVENT_DEFS) {
      const keys = e.options.map((o) => o.key);
      expect(new Set(keys).size, `${e.code}`).toBe(keys.length);
    }
  });

  it('every granted rarity is a real rarity', () => {
    for (const e of EVENT_DEFS) {
      for (const o of e.options) {
        for (const effect of o.effect) {
          if ('relic_grant' in effect) {
            expect(RARITIES, `${e.code}/${o.key}`).toContain(effect.relic_grant.rarity);
          }
        }
      }
    }
  });

  it('every applied modifier is a real modifier, or the NONE sentinel', () => {
    const ids = new Set([...MODIFIERS.map((m) => m.id), 'NONE']);
    for (const e of EVENT_DEFS) {
      for (const o of e.options) {
        for (const effect of o.effect) {
          if ('modifier_apply' in effect) {
            expect(
              ids.has(effect.modifier_apply.modifier),
              `${e.code}/${o.key} applies "${effect.modifier_apply.modifier}"`,
            ).toBe(true);
          }
        }
      }
    }
  });

  it('next_n_words always carries an n', () => {
    for (const e of EVENT_DEFS) {
      for (const o of e.options) {
        for (const effect of o.effect) {
          if ('modifier_apply' in effect && effect.modifier_apply.scope === 'next_n_words') {
            expect(effect.modifier_apply.n, `${e.code}/${o.key}`).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});

describe('§6.8 content rules', () => {
  it('every event offers 2 or 3 options', () => {
    for (const e of EVENT_DEFS) {
      expect(e.options.length, `${e.code}`).toBeGreaterThanOrEqual(2);
      expect(e.options.length, `${e.code}`).toBeLessThanOrEqual(3);
    }
  });

  it('at least one option is non-destructive — though not necessarily free', () => {
    // §6.8 is explicit that EV.06 charging 40g to refuse is the point of EV.06.
    // Non-destructive means it does not take a relic or drain the pool.
    for (const e of EVENT_DEFS) {
      const safe = e.options.filter((o) =>
        o.effect.every(
          (x) =>
            !('relic_destroy' in x) &&
            !('map_skip' in x) &&
            !('pool_delta' in x && x.pool_delta < 0) &&
            !('word_challenge' in x),
        ),
      );
      expect(safe.length, `${e.code} has no way out`).toBeGreaterThanOrEqual(1);
    }
  });

  it('every option states its stake, and a risky one states the downside', () => {
    for (const e of EVENT_DEFS) {
      for (const o of e.options) {
        expect(o.stake.length, `${e.code}/${o.key} has no stake line`).toBeGreaterThan(0);
        const gambles = o.effect.some(
          (x) => 'word_challenge' in x && x.word_challenge.on_failure.length > 0,
        );
        if (gambles) {
          // "An event never hides its odds": the failure branch must be printed.
          expect(o.stake, `${e.code}/${o.key} hides its failure branch`).toMatch(/FAIL|LOSE|→/);
        }
      }
    }
  });

  it('an option that spends gold declares the requirement that gates it', () => {
    for (const e of EVENT_DEFS) {
      for (const o of e.options) {
        const spend = o.effect.find((x) => 'gold_delta' in x && x.gold_delta < 0) as
          | { gold_delta: number }
          | undefined;
        if (!spend) continue;
        const cost = -spend.gold_delta;
        // Small costs can be met by anyone; the gate matters when it can bind.
        if (cost < 50) continue;
        expect(o.requires?.gold_min, `${e.code}/${o.key} spends ${cost}g ungated`).toBe(cost);
      }
    }
  });

  it('an option that destroys a relic outright requires holding more than one', () => {
    // Only DIRECT destroys. A destroy on the failure branch of a wager is a
    // different thing: the player accepted a stated risk, and gating the whole
    // option would stop someone with one relic taking a bet they understand.
    // It must no-op safely at zero relics instead — asserted below.
    for (const e of EVENT_DEFS) {
      for (const o of e.options) {
        if (!o.effect.some((x) => 'relic_destroy' in x)) continue;
        expect(o.requires?.relics_min, `${e.code}/${o.key} can empty a build`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('a contingent destroy states its risk and never gates the option', () => {
    for (const e of EVENT_DEFS) {
      for (const o of e.options) {
        const contingent = o.effect.some(
          (x) =>
            'word_challenge' in x &&
            x.word_challenge.on_failure.some((f) => 'relic_destroy' in f),
        );
        if (!contingent) continue;
        expect(o.stake, `${e.code}/${o.key} does not print what failure costs`).toMatch(/FAIL/);
        // The engine must tolerate resolving this with nothing to take.
        expect(o.requires?.relics_min, `${e.code}/${o.key} gates a stated bet`).toBeUndefined();
      }
    }
  });

  it('events trade between currencies, not gold alone', () => {
    // "An event that only moves gold is a shop with worse copy."
    for (const e of EVENT_DEFS) {
      const verbs = new Set(e.options.flatMap((o) => verbsIn(o.effect)));
      verbs.delete('gold_delta');
      expect(verbs.size, `${e.code} only moves gold`).toBeGreaterThan(0);
    }
  });
});

describe('§6.8 draw rules', () => {
  it('drawing without replacement empties the pool', () => {
    const seen: string[] = [];
    let available = eventsForAct(0, seen);
    while (available.length > 0) {
      seen.push(available[0]!.code);
      available = eventsForAct(0, seen);
    }
    expect(seen.length).toBeGreaterThan(0);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('every act has enough events for a run that sees several', () => {
    // §6.8 expects 2–5 events per run. An act with fewer than that eligible
    // would repeat within one run, which the draw rule forbids.
    for (const act of [0, 1, 2] as const) {
      expect(eventsForAct(act, []).length, `act ${act + 1}`).toBeGreaterThanOrEqual(5);
    }
  });

  it("EV.09 is Act III only, as its balance note requires", () => {
    expect(EVENTS['EV.09']!.acts).toEqual([3]);
  });

  it('EV.01 is preserved verbatim from the design (R-022)', () => {
    const e = EVENTS['EV.01']!;
    expect(e.name).toBe('THE WAGER');
    expect(e.options.map((o) => o.label)).toEqual([
      'SIGN THE LEDGER',
      'PAY THE CLERK 40g',
      'WALK AWAY',
    ]);
  });
});

describe('events.json and MECHANICS.md agree', () => {
  it('§6.8 names the right event count', () => {
    const mechanics = readFileSync(resolve(__dirname, '../../../MECHANICS.md'), 'utf8');
    expect(mechanics).toContain(`\`EV.01\`–\`EV.${String(EVENT_DEFS.length).padStart(2, '0')}\``);
  });
});
