import { describe, expect, it } from 'vitest';
import { SPEC, tableAfter } from '../../../test/spec';
import {
  CHARACTERS,
  PENDING_IMPLEMENTATION,
  RARITIES,
  RELIC_DEFS,
  REGISTRY,
  impl,
  isHookName,
  isImplemented,
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

  it('7. the information cap is gone, and so is the field that fed it', () => {
    // §6.2: "At 5 slots the v1.1 information cap becomes unnecessary and is
    // removed." `pre_guess_reveal` existed only to feed it, and a registry
    // field nothing reads is drift with a delay on it — so it went too.
    expect(SPEC).toContain('the v1.1 information cap becomes unnecessary and is removed');
    for (const d of RELIC_DEFS) {
      expect(d, `${d.code} still carries pre_guess_reveal`).not.toHaveProperty(
        'pre_guess_reveal',
      );
    }
  });

  it('8. every ruling reference resolves to a MECHANICS.md §12 entry', () => {
    // §12.1 restates the two pre-v1.3 rulings the registry still cites, so a
    // citation resolving is a real check again rather than one pointed at an
    // archived document.
    const mechanics = SPEC;
    for (const d of RELIC_DEFS) {
      if (!d.ruling) continue;
      expect(mechanics, `${d.code} cites ${d.ruling}`).toContain(`**${d.ruling} ·`);
    }
  });

  it('8b. `rule` is player-facing copy, not engine instructions', () => {
    // relics.json's own note: `rule` is normative AND it is what the relic card
    // prints. A dotted identifier in it means implementation detail has leaked
    // into the thing a player reads mid-run; `engine_note` is where that goes.
    for (const d of RELIC_DEFS) {
      expect(d.rule, `${d.code} rule reads like code`).not.toMatch(/\b[A-Z][a-zA-Z]*\.[a-z]/);
      expect(d.rule, `${d.code} rule addresses the implementer`).not.toMatch(
        /\bmust be\b|===|\bnull\b/,
      );
    }
  });

  it('9. an activation and an onUse handler imply each other (R-050)', () => {
    // Checked against the IMPLEMENTATION, not against the JSON's `hook`.
    // `USE_ITEM` dispatches through `resolveUse`, which reads the impl and never
    // reads the JSON hook at all — so this is the invariant that can actually
    // break. v1.3 also required `hook: "onUse"` in the JSON and the two agreed
    // by construction; v2.0's registry gives an activated relic the hook its
    // effect RESOLVES on, and the weaker of the two checks was the one being
    // made. An activation with no handler is a relic nothing can fire; a
    // handler with no activation is one nothing may legally fire.
    for (const d of RELIC_DEFS) {
      if (d.isConsumable) continue;
      const fireable = IMPLEMENTATIONS[d.code]?.hooks?.onUse !== undefined;
      expect(fireable, `${d.code}`).toBe(d.activation !== undefined);
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
  it('codes are opaque: the registry is a lookup, not a range', () => {
    // R-011. This used to pin RL.08 and RL.17 as absent (technical brief §13
    // I-14). R-020 filled both, which is exactly what I-14 said was allowed —
    // "new relics fill gaps arbitrarily". So the test now asserts the rule
    // rather than the two codes that happened to be missing when it was
    // written, since the version that named them would have to be edited every
    // time the rule was correctly followed.
    expect(REGISTRY['RL.99']).toBeUndefined();
    expect(REGISTRY['']).toBeUndefined();
  });

  it('code order carries no meaning, which is why sorting uses the fields', () => {
    // The concrete hazard R-011 is guarding against: if codes happened to group
    // by archetype, someone would sort by code and it would look fine until the
    // next relic was minted into a gap.
    const byCode = [...RELIC_DEFS].sort((a, b) => a.code.localeCompare(b.code));
    const runs = byCode.filter((d, i) => i > 0 && d.archetype !== byCode[i - 1]!.archetype).length;
    expect(runs, 'codes group by archetype — sorting by code would look correct').toBeGreaterThan(4);
  });

  it('every character has a starting bankroll and an innate', () => {
    for (const c of CHARACTERS) {
      // §9 states a starting bankroll outright rather than a modifier to add to
      // three act pools, which is what v1.3's `pool_modifier` was.
      expect(typeof c.bankroll_start).toBe('number');
      expect(c.bankroll_start).toBeGreaterThan(0);
      expect(c.innate.length).toBeGreaterThan(0);
    }
  });

  it('§9 — the characters start where the spec says they do', () => {
    const rows = tableAfter('| Character | Start | Innate |');
    expect(rows).toHaveLength(CHARACTERS.length);
    for (const row of rows) {
      const name = row[0]!.toUpperCase();
      const held = CHARACTERS.find((c) => c.name === name);
      expect(held, `${name} is not in the registry`).toBeDefined();
      expect(Number(row[1]), `${name}'s start`).toBe(held!.bankroll_start);
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

/**
 * R-021 — every relic carries exactly one MK.II tier, and the three hard rules
 * in §6.7 hold. These are the constraints a Forge cannot enforce at runtime: by
 * the time a player is standing at the node, an upgrade that breaks one of them
 * is already printed on a card.
 */
describe('§6.7 forge upgrades', () => {
  it('every relic has exactly one upgrade, and no consumable has any', () => {
    for (const d of RELIC_DEFS) {
      if (d.isConsumable) {
        expect(d.upgrade, `${d.code} is a consumable and cannot be upgraded`).toBeUndefined();
      } else {
        expect(d.upgrade, `${d.code} has no MK.II`).toBeDefined();
      }
    }
  });

  it('rule 1 — an upgrade stays on the axis it declares', () => {
    // v1.3 checked here that no upgrade introduced a pre-guess reveal, because
    // §6.3 capped them at two and an upgrade that added one could push a player
    // over a cap they could not have anticipated. §6.2 removed the cap, so the
    // hazard is gone; what is left is that `axis` is auditable data and has to
    // describe the rule it sits next to.
    const axes = ['magnitude', 'duration', 'reach', 'reliability', 'cost'];
    const seen = new Map<string, number>();
    for (const d of RELIC_DEFS) {
      if (!d.upgrade) continue;
      expect(axes, `${d.code} MK.II axis`).toContain(d.upgrade.axis);
      seen.set(d.upgrade.axis, (seen.get(d.upgrade.axis) ?? 0) + 1);
    }
    // §6.7 records the axis "so the distribution can be audited rather than
    // drifting toward 'a number goes up' thirty-one times". Assert it has not.
    expect(seen.size, 'the upgrade set uses one or two axes').toBeGreaterThanOrEqual(4);
    expect(
      (seen.get('magnitude') ?? 0) / RELIC_DEFS.filter((d) => d.upgrade).length,
    ).toBeLessThan(0.6);
  });

  it('rule 3 — boss relics upgrade on cost or reach, never raw magnitude', () => {
    // R-051 names ONE exception and the test reads it from the document rather
    // than hardcoding a list, so a second boss relic drifting to `magnitude`
    // still fails here.
    const excused = [...SPEC.matchAll(/\*\*R-051 · `(RL\.\d+)`/g)].map((m) => m[1]);
    expect(excused, 'R-051 no longer names its exception').toHaveLength(1);
    for (const d of RELIC_DEFS) {
      if (d.rarity !== 'BOSS' || !d.upgrade) continue;
      if (excused.includes(d.code)) {
        expect(d.upgrade.axis, `${d.code} is excused but no longer magnitude`).toBe('magnitude');
        continue;
      }
      expect(['cost', 'reach'], `${d.code} MK.II is ${d.upgrade.axis}`).toContain(d.upgrade.axis);
    }
  });

  it('an upgrade never changes hook, archetype, rarity or code', () => {
    // Structural: the upgrade block simply has no field for any of them. This
    // asserts nobody adds one.
    for (const d of RELIC_DEFS) {
      if (!d.upgrade) continue;
      for (const forbidden of ['hook', 'archetype', 'rarity', 'code']) {
        expect(forbidden in d.upgrade, `${d.code} MK.II declares ${forbidden}`).toBe(false);
      }
    }
  });

  it('the MK.II name derives from the relic name, so the card stays the same object', () => {
    for (const d of RELIC_DEFS) {
      if (!d.upgrade) continue;
      expect(d.upgrade.name, `${d.code}`).toBe(`${d.name} MK.II`);
    }
  });

  it('upgrade rule is player-facing copy, like `rule` (test 8b)', () => {
    for (const d of RELIC_DEFS) {
      if (!d.upgrade) continue;
      expect(d.upgrade.rule, `${d.code} MK.II reads like code`).not.toMatch(/\b[A-Z][a-zA-Z]*\.[a-z]/);
    }
  });

  it('the axis distribution is recorded, not asserted', () => {
    // §6.7 says magnitude should be the plurality and warns that all-magnitude
    // would make forge choices samey. Pinning exact counts would fail on every
    // new relic, so this asserts the shape: magnitude leads, but not alone.
    const axes = RELIC_DEFS.filter((d) => d.upgrade).map((d) => d.upgrade!.axis);
    const counts = new Map<string, number>();
    for (const a of axes) counts.set(a, (counts.get(a) ?? 0) + 1);
    expect(counts.get('magnitude') ?? 0, 'magnitude should lead').toBeGreaterThan(0);
    expect(counts.size, 'more than one axis in use').toBeGreaterThanOrEqual(4);
    expect((counts.get('magnitude') ?? 0) / axes.length, 'all-magnitude is the failure mode')
      .toBeLessThan(0.7);
  });
});
