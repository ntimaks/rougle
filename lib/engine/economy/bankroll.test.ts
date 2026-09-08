import { describe, expect, it } from 'vitest';
import { SPEC, num, tableAfter } from '../../../test/spec';
import { ECONOMY, withEconomy, type WordLength } from './config';
import {
  applyPayout,
  basePayout,
  breakEven,
  buyEmergency,
  emergencyCost,
  grant,
  largestBonus,
  payoutFor,
  spendGuess,
  type BankrollState,
} from './bankroll';

const at = (bankroll: number, gold = 0, emergencyPurchases = 0): BankrollState => ({
  bankroll,
  gold,
  emergencyPurchases,
});

describe('§2.3 — the payout table', () => {
  // The spec states the net column for a 5-letter word outright. Read it out of
  // MECHANICS.md rather than retyping it: this is the one table where a
  // transcription slip would be invisible and would change the whole game.
  const rows = tableAfter('| Solved in | Payout | **Net** |');

  it('reads five rows out of the spec', () => {
    expect(rows).toHaveLength(5);
  });

  it.each(rows)('solving a 5-letter word in %s pays %s, net %s', (guesses, payout, net) => {
    const used = Number(guesses);
    const expectedPayout = num(payout);
    const expectedNet = num(net);
    expect(basePayout(5, used)).toBe(expectedPayout);
    expect(basePayout(5, used) - used).toBe(expectedNet);
  });

  it('never charges for a slow solve — the guesses already did that', () => {
    for (const used of [7, 9, 20]) expect(basePayout(5, used)).toBe(0);
  });

  it('break-even is three guesses on a five, and net is base − 2 × guesses', () => {
    expect(breakEven(5)).toBe(3);
    expect(breakEven(6)).toBe(3.5);
    expect(breakEven(7)).toBe(4);
    for (const len of [5, 6, 7] as WordLength[]) {
      for (const used of [1, 2, 3, 4]) {
        expect(basePayout(len, used) - used).toBe(ECONOMY.payoutBase[len] - 2 * used);
      }
    }
  });

  it('bleeds ~1.8 a word at the human baseline of 3.9 — the claim in §2.3', () => {
    // Fractional guesses are not playable; this asserts the ARITHMETIC the
    // design rests on, which is the sentence "every relic exists to close that
    // gap". If this stops holding, that sentence is no longer true.
    const netAt = (g: number) => ECONOMY.payoutBase[5] - 2 * g;
    expect(netAt(3.9)).toBeCloseTo(-1.8, 10);
    expect(netAt(3.0)).toBe(0);
  });
});

describe('§2.5 — the clamps', () => {
  it('Clamp B takes the largest bonus and never sums', () => {
    const bonuses = [
      { amount: 3, source: 'CH.02' },
      { amount: 2, source: 'RL.11' },
    ];
    expect(largestBonus(bonuses)).toEqual({ amount: 3, source: 'CH.02' });
    // The spec's own worked example: a Gambler holding Flywheel who solves in
    // three gets +3, not +5.
    expect(payoutFor(5, 3, bonuses).payout).toBe(basePayout(5, 3) + 3);
  });

  it('Clamp B ignores zero and negative bonuses', () => {
    expect(largestBonus([{ amount: 0, source: 'x' }, { amount: -4, source: 'y' }])).toBeNull();
  });

  it('Clamp A caps what a word ADDS to the bankroll at +5', () => {
    // Two guesses on a five pays 4 for a net of +2. A +9 bonus would make it
    // +11 net; the clamp holds the net at +5, so the payout lands at 7.
    const out = payoutFor(5, 2, [{ amount: 9, source: 'test' }]);
    expect(out.clamped).toBe(true);
    expect(out.payout - 2).toBe(ECONOMY.maxNetGainPerWord);
  });

  it('Clamp A binds on exactly one unassisted solve: a seven in one guess', () => {
    // Worth knowing, because §2.5 introduces Clamp A as a rule about relics
    // stacking. It is not only that. A 7-letter word pays base 8, so a
    // hole-in-one nets +7 with no relic involved at all and the clamp holds it
    // to +5. Every other unassisted solve at every length is under the ceiling,
    // so this is the whole of the clamp's reach on unaided play — deliberate
    // as far as the spec goes ("NO word may add more than 5"), but it means the
    // luckiest possible guess in the game is the one case the clamp punishes.
    const bound: string[] = [];
    for (const len of [5, 6, 7] as WordLength[]) {
      for (let used = 1; used <= 8; used++) {
        if (payoutFor(len, used).clamped) bound.push(`${len}/${used}`);
      }
    }
    expect(bound).toEqual(['7/1']);
    expect(payoutFor(7, 1).payout - 1).toBe(ECONOMY.maxNetGainPerWord);
  });
});

describe('§2.1 — the bankroll', () => {
  it('a guess decrements by one and stops at zero', () => {
    expect(spendGuess(at(12)).state.bankroll).toBe(11);
    expect(spendGuess(at(1)).state.bankroll).toBe(0);
    const floored = spendGuess(at(0));
    expect(floored.state.bankroll).toBe(0);
    expect(floored.events).toHaveLength(0);
  });

  it('caps at 24 and converts the overflow to gold at 10g each', () => {
    const out = grant(at(23, 100), 4, 'test');
    expect(out.state.bankroll).toBe(ECONOMY.bankrollCap);
    // 1 of the 4 fits; the other 3 pay 30g.
    expect(out.state.gold).toBe(100 + 3 * ECONOMY.overflowGoldPerGuess);
    expect(out.events.map((e) => e.type)).toEqual(['BANKROLL_GRANTED', 'OVERFLOW_TO_GOLD']);
  });

  it('converts the whole grant when already at the cap', () => {
    const out = grant(at(ECONOMY.bankrollCap, 0), 2, 'test');
    expect(out.state.bankroll).toBe(ECONOMY.bankrollCap);
    expect(out.state.gold).toBe(2 * ECONOMY.overflowGoldPerGuess);
    expect(out.events.map((e) => e.type)).toEqual(['OVERFLOW_TO_GOLD']);
  });

  it('a payout goes through the cap, so a full bankroll still pays', () => {
    const out = applyPayout(at(ECONOMY.bankrollCap, 0), 5, 2);
    expect(out.payout).toBe(4);
    expect(out.state.gold).toBe(40);
  });
});

describe('§2.4 — the emergency ladder', () => {
  it('escalates across the RUN and runs out after four', () => {
    const rungs = ECONOMY.emergencyCosts;
    rungs.forEach((cost, i) => expect(emergencyCost(at(0, 999, i))).toBe(cost));
    expect(emergencyCost(at(0, 999, rungs.length))).toBeNull();
  });

  it('every rung grants the same +3', () => {
    for (let i = 0; i < ECONOMY.emergencyCosts.length; i++) {
      const out = buyEmergency(at(0, 9999, i))!;
      expect(out.state.bankroll).toBe(ECONOMY.emergencyGrant);
      expect(out.state.emergencyPurchases).toBe(i + 1);
    }
  });

  it('charges the rung and does not consume one it could not pay for', () => {
    const priced = buyEmergency(at(0, ECONOMY.emergencyCosts[0]!))!;
    expect(priced.state.gold).toBe(0);
    expect(priced.state.emergencyPurchases).toBe(1);
    expect(buyEmergency(at(0, ECONOMY.emergencyCosts[0]! - 1))).toBeNull();
    expect(buyEmergency(at(0, 9999, ECONOMY.emergencyCosts.length))).toBeNull();
  });
});

describe('the config is overridable and never mutated', () => {
  it('withEconomy returns a new frozen config', () => {
    const patched = withEconomy({ bankrollCap: 30 });
    expect(patched.bankrollCap).toBe(30);
    expect(ECONOMY.bankrollCap).toBe(24);
    expect(Object.isFrozen(patched)).toBe(true);
    expect(grant(at(28, 0), 4, 'test', patched).state.bankroll).toBe(30);
  });
});

describe('config.ts matches MECHANICS.md §2', () => {
  it('the §2.3 base column', () => {
    const rows = tableAfter('| Word length | base | Break-even |');
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      const len = num(row[0]!) as WordLength;
      expect(ECONOMY.payoutBase[len]).toBe(num(row[1]!));
      expect(breakEven(len)).toBe(num(row[2]!));
    }
  });

  it('the §2.4 ladder, its grants and its length', () => {
    const rows = tableAfter('| Purchase | Cost | Grants |');
    const priced = rows.filter((r) => /\d/.test(r[1] ?? ''));
    expect(priced.map((r) => num(r[1]!))).toEqual([...ECONOMY.emergencyCosts]);
    for (const r of priced) expect(r[2]).toBe(`+${ECONOMY.emergencyGrant} bankroll`);
  });

  it('the §2.1 start, cap and overflow rate', () => {
    expect(SPEC).toContain(`Starts at **${ECONOMY.bankrollStart}**`);
    expect(SPEC).toContain(`Hard cap **${ECONOMY.bankrollCap}**`);
    expect(SPEC).toContain(`converts to gold at ${ECONOMY.overflowGoldPerGuess}g each`);
  });

  it('§2.5 Clamp A', () => {
    expect(SPEC).toContain(`Net gain per word ≤ +${ECONOMY.maxNetGainPerWord}`);
  });
});
