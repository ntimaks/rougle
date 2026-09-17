import { describe, expect, it } from 'vitest';
import { SPEC, num, tableAfter } from '../../../test/spec';
import { CONFIG } from './config';

/**
 * MECHANICS.md is normative, and `config.ts` is the only place its numbers are
 * allowed to live in code. This asserts the two agree, by reading the spec.
 *
 * Written after a tuning pass left the Gauntlet's on-screen rule text saying
 * "ITS OWN POOL OF 14" while the pool was 10. Every number below is one a
 * balance snapshot is expected to move; the point is not to freeze them but to
 * make moving one in code without writing it down fail here.
 *
 * These read `MECHANICS.md` itself again. Through the migration they read the
 * archived v1.3 document, because the spec had moved and the engine had not.
 */
const gold = (cell: string): number => {
  const m = cell.match(/(\d+)g/);
  expect(m, `no gold figure in "${cell}"`).not.toBeNull();
  return Number(m![1]);
};

describe('config.ts matches MECHANICS.md v2.0', () => {
  it('§2.1 — the bankroll starts at 12 and caps at 24', () => {
    expect(SPEC).toContain(`Starts at **${CONFIG.economy.bankrollStart}**`);
    expect(SPEC).toContain(`Hard cap **${CONFIG.economy.bankrollCap}**`);
    expect(SPEC).toContain(
      `converts to gold at ${CONFIG.economy.overflowGoldPerGuess}g each`,
    );
  });

  it('§2.3 — the payout base is flat across every length', () => {
    const rows = tableAfter('| Word length | base | Break-even |');
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      const length = num(row[0]!) as 5 | 6 | 7;
      expect(num(row[1]!), `base at ${length} letters`).toBe(CONFIG.economy.payoutBase[length]);
    }
    // R-047 is the ruling that made it flat, so a future edit that reintroduces
    // a per-length base has to break something rather than just read oddly.
    const bases = rows.map((r) => num(r[1]!));
    expect(new Set(bases).size, 'the base is no longer flat').toBe(1);
  });

  it('§2.3 — the net table is base − 2 × guesses, as the spec computes it', () => {
    const rows = tableAfter('| Solved in | Payout | **Net** |');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const guesses = num(row[0]!);
      const payout = num(row[1]!);
      const net = num(row[2]!);
      expect(payout, `payout at ${guesses}`).toBe(
        Math.max(0, CONFIG.economy.payoutBase[5] - guesses),
      );
      expect(net, `net at ${guesses}`).toBe(payout - guesses);
    }
  });

  it('§2.4 — the emergency ladder, and that it closes', () => {
    const rows = tableAfter('| Purchase | Cost | Grants |');
    const priced = rows.filter((r) => /\d/.test(r[1] ?? ''));
    expect(priced.map((r) => gold(r[1]!))).toEqual([...CONFIG.economy.emergencyCosts]);
    for (const row of priced) {
      expect(num(row[2]!), 'every rung grants the same').toBe(CONFIG.economy.emergencyGrant);
    }
    expect(rows[priced.length]?.[1]).toBe('Unavailable');
  });

  it('§3.3 — node rewards', () => {
    const rows = tableAfter('| Node | Gold | Other |');
    const by = (name: string) => rows.find((r) => r[0] === name)?.[1] ?? '';
    expect(gold(by('Word'))).toBe(CONFIG.rewards.word);
    expect(gold(by('Elite'))).toBe(CONFIG.rewards.elite);
    expect(gold(by('Boss'))).toBe(CONFIG.rewards.boss);
    const bossOther = rows.find((r) => r[0] === 'Boss')?.[2] ?? '';
    expect(num(bossOther)).toBe(CONFIG.economy.bossBankroll);
  });

  it('§6.6 — the rarity table, per act', () => {
    const rows = tableAfter('| | Act I | Act II | Act III |');
    // Rows read `| COMMON | 60% | 42% | 26% |`. BOSS's cells are em dashes: its
    // being 0 in code is the rule, not an omission, so it is asserted below.
    const stated = Object.fromEntries(
      rows.map((r) => [r[0]?.replace(/\*/g, ''), r.slice(1, 4).map((c) => c.replace(/[*%]/g, ''))]),
    );
    for (const rarity of ['COMMON', 'UNCOMMON', 'RARE'] as const) {
      expect(stated[rarity], `§6.6 has no ${rarity} row`).toBeDefined();
      ([0, 1, 2] as const).forEach((act) => {
        expect(Number(stated[rarity]![act]) / 100, `act ${act + 1} ${rarity}`).toBeCloseTo(
          CONFIG.rarityWeights[act][rarity],
          5,
        );
      });
    }
    ([0, 1, 2] as const).forEach((act) => {
      expect(CONFIG.rarityWeights[act].BOSS, `act ${act + 1} BOSS comes from §3.3`).toBe(0);
      expect(CONFIG.rarityWeights[act].CONSUMABLE, `act ${act + 1} CONSUMABLE`).toBe(0);
      const sum = (['COMMON', 'UNCOMMON', 'RARE'] as const).reduce(
        (a, r) => a + CONFIG.rarityWeights[act][r],
        0,
      );
      expect(sum, `act ${act + 1} shares do not total 1`).toBeCloseTo(1, 5);
    });
    // The curve §6.6 claims: rares get commoner and commons rarer, act on act.
    expect(CONFIG.rarityWeights[0].RARE).toBeLessThan(CONFIG.rarityWeights[1].RARE);
    expect(CONFIG.rarityWeights[1].RARE).toBeLessThan(CONFIG.rarityWeights[2].RARE);
    expect(CONFIG.rarityWeights[0].COMMON).toBeGreaterThan(CONFIG.rarityWeights[1].COMMON);
    expect(CONFIG.rarityWeights[1].COMMON).toBeGreaterThan(CONFIG.rarityWeights[2].COMMON);
  });

  it('§4.2 — the price table', () => {
    const rows = tableAfter('| Item | Price |');
    const named: Record<string, keyof typeof CONFIG.prices> = {
      'Common relic': 'COMMON',
      'Uncommon relic': 'UNCOMMON',
      'Rare relic': 'RARE',
      'Boss relic': 'BOSS',
      Consumable: 'CONSUMABLE',
    };
    for (const [label, rarity] of Object.entries(named)) {
      const row = rows.find((r) => r[0] === label);
      expect(row, `§4.2 has no ${label} row`).toBeDefined();
      expect(gold(row![1]!), label).toBe(CONFIG.prices[rarity]);
    }
  });

  it('§4.1/§4.2 — the refill ladder is the same six numbers in both places', () => {
    const written = CONFIG.economy.refillCosts.join(' / ');
    expect(SPEC, '§4.1 states the ladder').toContain(`${written}g`);
    expect(SPEC, '§4.1 states the run cap').toContain(
      `**${['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'][CONFIG.economy.refillCosts.length]} in a run, hard cap.**`,
    );
  });

  it('§4.2 — one refill per shop', () => {
    expect(SPEC).toContain(`**one per shop**`);
    expect(CONFIG.economy.refillsPerShop).toBe(1);
  });

  it('§4.2 — the reroll price and the sell fraction', () => {
    const rows = tableAfter('| Item | Price |');
    const by = (name: string) => rows.find((r) => r[0]?.startsWith(name))?.[1] ?? '';
    expect(by('Reroll')).toContain(`${CONFIG.rerollBase}g`);
    expect(by('Reroll')).toContain(`+${CONFIG.rerollStep}g`);
    expect(by('Sell')).toContain(`${CONFIG.sellFraction * 100}%`);
  });

  it('§3.1 — six map nodes, four solve nodes, and the elite ceiling per act', () => {
    expect(SPEC).toContain('**6 map nodes, then a boss.**');
    for (const act of CONFIG.acts) {
      expect(act.mapNodes).toBe(6);
      expect(act.solveNodes).toBe(4);
    }
    expect(SPEC).toContain(
      `Act I contains at most ${CONFIG.acts[0].maxElites} elite; ` +
        `Act II at most ${CONFIG.acts[1].maxElites}; Act III at most ${CONFIG.acts[2].maxElites}`,
    );
  });

  it('§3.1 — the node weights, with no shop among them', () => {
    const rows = tableAfter('| Node | Weight |');
    const stated = Object.fromEntries(
      rows.map((r) => [r[0]!.toUpperCase(), num(r[1]!) / 100]),
    );
    expect(stated).toEqual({ ...CONFIG.nodeWeights });
    expect(SPEC).toContain('Shop is no longer a node type');
  });

  it('§3.2 — twelve solve nodes and three bosses make twenty words', () => {
    const solveNodes = CONFIG.acts.reduce((n, a) => n + a.solveNodes, 0);
    expect(solveNodes).toBe(12);
    expect(SPEC).toContain(`${solveNodes} solve nodes plus three bosses`);
    // 2 + 1 + 5 boss words. The Gauntlet is the only one config carries.
    expect(CONFIG.gauntlet.words).toBe(5);
    expect(SPEC).toContain('**20 words**');
  });

  it('§6.2 — five relic slots and two consumable slots', () => {
    expect(SPEC).toContain(`**${CONFIG.relicSlots} relic slots.** Hard cap`);
    expect(SPEC).toContain(`**${CONFIG.consumableSlots} consumable slots.** Separate`);
  });

  it('§6.6 — the archetype floor is the one in the formula', () => {
    expect(SPEC).toContain(`P(archetype) = ${CONFIG.shopArchetypeFloor} +`);
  });

  it('§2.5 — Clamp A is the number the config caps a word at', () => {
    expect(SPEC).toContain(`Net gain per word ≤ +${CONFIG.economy.maxNetGainPerWord}`);
  });
});
