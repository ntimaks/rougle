import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CHARACTERS,
  PENDING_IMPLEMENTATION,
  RARITIES,
  RELIC_DEFS,
  REGISTRY,
  impl,
  isHookName,
  isImplemented,
  isPreGuessReveal,
  activationFor,
} from './registry';
import { IMPLEMENTATIONS } from './impl';
import { HOOK_NAMES } from './types';

/**
 * E-11 — the eight validations from technical brief §6.
 *
 * This is the mechanism that stops the data and the code drifting. With 31
 * relics spread across three documents, drift is otherwise certain: someone
 * renames a hook, or adds a relic to the JSON and forgets the module, and
 * nothing notices until a run behaves strangely three weeks later.
 */

const ALL_CODES = new Set([...RELIC_DEFS.map((d) => d.code), ...CHARACTERS.map((c) => c.code)]);

describe('registry validation', () => {
  it('1. every relics.json code has exactly one implementation or a stated reason', () => {
    const missing = [...ALL_CODES].filter(
      (code) => !isImplemented(code) && !(code in PENDING_IMPLEMENTATION),
    );
    expect(missing, 'add an impl module, or an entry in PENDING_IMPLEMENTATION saying why not').toEqual([]);
  });

  it('1b. no code is both implemented and listed as pending', () => {
    const both = Object.keys(PENDING_IMPLEMENTATION).filter((code) => code in IMPLEMENTATIONS);
    expect(both, 'remove the PENDING_IMPLEMENTATION entry when the ticket closes').toEqual([]);
  });

  it('1c. every pending entry gives a reason naming a §13 item or a phase', () => {
    for (const [code, reason] of Object.entries(PENDING_IMPLEMENTATION)) {
      expect(reason, `${code} needs a real reason`).toMatch(/§13 I-\d\d|Phase \d|Ticket [A-Z]-\d\d/);
    }
  });

  it('2. every implementation module corresponds to a code in relics.json', () => {
    const orphans = Object.keys(IMPLEMENTATIONS).filter((code) => !ALL_CODES.has(code));
    expect(orphans, 'relics.json is the registry; add the code there first').toEqual([]);
  });

  it('3. every hook value is a member of HookName', () => {
    for (const d of RELIC_DEFS) {
      expect(isHookName(d.hook), `${d.code} declares hook "${d.hook}"`).toBe(true);
    }
  });

  it('3b. every handler an implementation registers is a real hook', () => {
    for (const [code, relicImpl] of Object.entries(IMPLEMENTATIONS)) {
      for (const hook of Object.keys(relicImpl.hooks ?? {})) {
        expect(HOOK_NAMES, `${code} registers "${hook}"`).toContain(hook);
      }
    }
  });

  it('4. every synergy and anti_synergy reference resolves', () => {
    for (const d of RELIC_DEFS) {
      for (const code of [...(d.synergy ?? []), ...(d.anti_synergy ?? [])]) {
        expect(REGISTRY[code], `${d.code} references ${code}`).toBeDefined();
      }
    }
  });

  it('5. every transform_order is unique among the relics that declare one', () => {
    const orders = RELIC_DEFS.filter((d) => d.transform_order !== undefined).map(
      (d) => d.transform_order!,
    );
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('5b. an implementation with a chainStep matches its JSON transform_order', () => {
    for (const d of RELIC_DEFS) {
      const relicImpl = impl(d.code);
      if (!relicImpl) continue;
      if (d.transform_order !== undefined) {
        expect(relicImpl.chainStep, `${d.code} declares transform_order ${d.transform_order}`).toBe(
          d.transform_order,
        );
      }
    }
  });

  it('6. every rarity is declared, and CONSUMABLE only appears on consumables', () => {
    for (const d of RELIC_DEFS) {
      expect(RARITIES, `${d.code}`).toContain(d.rarity);
      expect(d.rarity === 'CONSUMABLE').toBe(d.isConsumable);
    }
  });

  it('7. pre_guess_reveal matches the MECHANICS.md §6.3 affected list', () => {
    // §6.3: "Affected: Lexicon, Palimpsest, The Concordance, Rosetta Slab,
    // Hot Streak's free green, Skeleton Key."
    const expected = new Set(['RL.01', 'RL.03', 'RL.05', 'RL.31', 'RL.12', 'CN.05']);
    const flagged = new Set(RELIC_DEFS.filter((d) => d.pre_guess_reveal).map((d) => d.code));
    expect([...flagged].sort()).toEqual([...expected].sort());
  });

  it('7a. character innates that reveal are under the cap too (§13 I-20)', () => {
    // §6.3's prose lists only relics, but relics.json flags CH.01 The Linguist
    // pre_guess_reveal: true and the flag is what the cap reads. The prose is
    // the thing that is out of date.
    expect(isPreGuessReveal('CH.01')).toBe(true);
    expect(isPreGuessReveal('CH.02')).toBe(false);
    expect(isPreGuessReveal('CH.03')).toBe(false);
  });

  it('7b. §6.3\'s "not affected" list really is not flagged', () => {
    // "Not affected: Rangefinder, The Auditor, The Lantern — these resolve
    // during a word, not before it."
    for (const code of ['RL.04', 'RL.07', 'RL.26']) {
      expect(REGISTRY[code]!.pre_guess_reveal, code).toBe(false);
    }
  });

  it('8. every ruling reference resolves to a MECHANICS.md §11 entry', () => {
    const mechanics = readFileSync(resolve(__dirname, '../../../MECHANICS.md'), 'utf8');
    for (const d of RELIC_DEFS) {
      if (!d.ruling) continue;
      expect(mechanics, `${d.code} cites ${d.ruling}`).toContain(`**${d.ruling} ·`);
    }
  });

  it('9. a non-consumable on hook onUse declares an activation, and vice versa', () => {
    // R-015 opened onUse to relics. The block is what makes that legal, so the
    // two must never drift apart: an onUse relic without one would be a relic
    // nothing can fire, and an activation on another hook would never run.
    for (const d of RELIC_DEFS) {
      if (d.isConsumable) continue;
      expect(d.hook === 'onUse', `${d.code}`).toBe(d.activation !== undefined);
    }
  });

  it('10. every activation block is well formed', () => {
    const timings = ['ANY_TIME_IN_WORD', 'BEFORE_FIRST_GUESS', 'BEFORE_SUBMIT'];
    for (const code of Object.keys(IMPLEMENTATIONS)) {
      const activation = activationFor(code);
      if (!activation) continue;
      expect(timings, `${code} timing`).toContain(activation.timing);
      expect(
        activation.usesPerWord === null || activation.usesPerWord > 0,
        `${code} usesPerWord`,
      ).toBe(true);
      // An uncapped activation must cost something, or it is free and infinite.
      if (activation.usesPerWord === null) {
        expect(Object.keys(activation.cost).length, `${code} is uncapped and free`).toBeGreaterThan(0);
      }
    }
  });
});

describe('registry shape', () => {
  it('codes are opaque: gaps are expected and assert nothing', () => {
    // R-011. RL.08 and RL.17 are absent on purpose (§13 I-14) — noted here so
    // nobody "fixes" the gap.
    expect(REGISTRY['RL.08']).toBeUndefined();
    expect(REGISTRY['RL.17']).toBeUndefined();
  });

  it('every character has a pool modifier and an innate', () => {
    for (const c of CHARACTERS) {
      expect(typeof c.pool_modifier).toBe('number');
      expect(c.innate.length).toBeGreaterThan(0);
    }
  });

  it('relic state is per instance, never module-level', () => {
    // A module-level counter would break save/load and would break a harness
    // running thousands of runs in one process.
    for (const [code, relicImpl] of Object.entries(IMPLEMENTATIONS)) {
      if (!relicImpl.initialState) continue;
      const a = { ...relicImpl.initialState };
      const b = { ...relicImpl.initialState };
      a['streak'] = 99;
      expect(b['streak'], `${code} shares its initial state object`).not.toBe(99);
    }
  });
});
