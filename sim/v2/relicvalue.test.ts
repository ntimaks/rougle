import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../../lib/engine/economy/config';
import { basePayout } from '../../lib/engine/economy/bankroll';
import { LOADOUTS, valueOf, type Loadout } from './relicvalue';

const flywheel = LOADOUTS.find((l) => l.label.startsWith('RL.11 Flywheel'))!;
const gambler = LOADOUTS.find((l) => l.label.startsWith('CH.02'))!;
const streak = LOADOUTS.find((l) => l.label.startsWith('RL.12'))!;
const all = LOADOUTS.find((l) => l.label.startsWith('all four'))!;
const nothing = LOADOUTS[0]!;

describe('§2.5 Clamp B in the relic model', () => {
  it('holding four payout relics pays the best one, never the sum', () => {
    // Every word solved in exactly three, so Flywheel (+2), the Gambler (+3)
    // and Opening Gambit (+1) all fire and Hot Streak's counter climbs.
    const fast = Array.from({ length: 10 }, () => 3);
    const combined = valueOf(all, fast);
    const summed =
      valueOf(flywheel, fast).meanBonus +
      valueOf(gambler, fast).meanBonus +
      valueOf(streak, fast).meanBonus +
      1;
    expect(combined.meanBonus).toBeLessThan(summed);
    // Clamp B is a per-word MAX, so the combined value dominates every single
    // relic but is worth far less than the four added up. Holding all four here
    // is worth 5.8 a word against Hot Streak's 5.5 alone: the other three are
    // buying 0.3, and only because the Gambler's flat +3 floors a short streak.
    for (const one of [flywheel, gambler, streak]) {
      expect(combined.meanBonus).toBeGreaterThanOrEqual(valueOf(one, fast).meanBonus);
    }
    expect(combined.meanBonus - valueOf(streak, fast).meanBonus).toBeLessThan(1);
  });

  it('a bonus that never fires is worth exactly nothing', () => {
    const slow = Array.from({ length: 10 }, () => 5);
    expect(valueOf(flywheel, slow).meanBonus).toBe(0);
    expect(valueOf(flywheel, slow).netPerWord).toBe(valueOf(nothing, slow).netPerWord);
  });
});

describe('§6.5 scaling — RL.12 Hot Streak', () => {
  it('pays its counter and resets on a slow solve', () => {
    // Three fast solves pay 1 + 2 + 3, then a slow one pays nothing and clears.
    expect(valueOf(streak, [3, 3, 3]).meanBonus * 3).toBe(6);
    expect(valueOf(streak, [3, 3, 5, 3]).meanBonus * 4).toBe(1 + 2 + 1);
    expect(valueOf(streak, [3, 3, 5]).finalStreak).toBe(0);
    expect(valueOf(streak, [3, 3]).finalStreak).toBe(2);
  });
});

describe('§2.5 Clamp A in the relic model', () => {
  it('caps what a word adds at +5 even with a big streak running', () => {
    const fast = Array.from({ length: 12 }, () => 2);
    const v = valueOf(streak, fast);
    // Every word nets at most +5, so the mean cannot exceed it either.
    expect(v.netPerWord).toBeLessThanOrEqual(ECONOMY.maxNetGainPerWord);
    // And the last word is genuinely clamped: base 4 plus a streak of 12 is 16.
    expect(basePayout(5, 2) + 12).toBeGreaterThan(2 + ECONOMY.maxNetGainPerWord);
  });
});

describe('the loadout table is honest about what it models', () => {
  it('every loadout is a pure function of (guesses, streak)', () => {
    const seq = [3, 4, 2, 5, 3, 3, 6, 3];
    for (const l of LOADOUTS as Loadout[]) {
      expect(JSON.stringify(valueOf(l, seq))).toBe(JSON.stringify(valueOf(l, seq)));
    }
  });
});
