import { ECONOMY, type EconomyConfig } from '../../lib/engine/economy/config';
import { basePayout } from '../../lib/engine/economy/bankroll';

/**
 * The §6.5 relic value budget, checked. MECHANICS.md §6.4, §6.5.
 *
 * v2.0 set relic power by feel and never checked it against §2.3, so there was
 * nothing for "too strong" to mean. The budget makes it a number: what a relic
 * of each rarity is allowed to be worth, in bankroll per word, against a
 * measured bleed of about 1.5.
 *
 * Only the relics that move BANKROLL or PAYOUT can be valued here — those are
 * arithmetic over the guess distribution. INFO, ROUTE and GREED relics change
 * guesses per word or gold instead, which needs the engine. They are listed as
 * unmeasured rather than omitted, so the gap is visible.
 */
export interface Budget {
  COMMON: number;
  UNCOMMON: number;
  RARE: number;
  BOSS: number;
  /**
   * The per-relic ceiling, as a fraction of the bleed.
   *
   * Review set it at half the bleed with tiers of 0.25/0.4/0.7/0.9. Those are a
   * per-RELIC budget, and §6.2 gives the player FIVE slots, so they do not
   * constrain the thing §11.5 actually measures. Under them a board of two
   * uncommons, two rares and a boss totals 3.10 against a 1.8 bleed — +1.3 a
   * word, which `v2-001.md` measured as unloseable. The tiers had to come down
   * until a strong board lands in band rather than over it.
   */
  ceilingFraction: number;
  slots: number;
  boardMultiple: number;
  /**
   * The bleed the budget is stated against: §2.3's own arithmetic at its own
   * stated human baseline of 3.9 guesses/word, `6 - 2 x 3.9 = -1.8`.
   *
   * Deliberately the SPEC's number rather than a measured sample. The measured
   * bleed moves with the sample (1500 real solves read -1.55, because the
   * calibrated solver plays 5-letter words at 3.77 rather than 3.9), and a
   * budget that moves every time someone re-runs the harness is not a budget.
   * It also makes the two rules consistent: half of 1.8 is exactly 0.9, the
   * boss allowance. Against a measured 1.55 the ceiling would be 0.78 and no
   * boss relic could ever reach its own tier.
   */
  bleed: number;
}

export const BUDGET: Readonly<Budget> = Object.freeze({
  COMMON: 0.2,
  UNCOMMON: 0.3,
  RARE: 0.4,
  BOSS: 0.5,
  ceilingFraction: 0.5 / 1.8, // the boss tier, as a fraction of the bleed
  bleed: 1.8,
  /** §6.2 — a legal board is five relics. */
  slots: 5,
  /** A full board may total no more than this multiple of the bleed. */
  boardMultiple: 1.2,
});

/**
 * The hard ceiling any relic must sit under, whatever its rarity — the boss
 * allowance, 0.50, which is 28% of the bleed rather than the 50% review
 * proposed. Five slots is what forced it down: see `ceilingFraction`.
 */
export const CEILING = BUDGET.bleed * BUDGET.ceilingFraction;

/** §6.5 — what five relics may be worth together. */
export const BOARD_CEILING = BUDGET.bleed * BUDGET.boardMultiple;

/** What a board of these rarities totals, for the §6.5 board check. */
export function boardValue(rarities: readonly Rarity[]): number {
  return rarities.reduce((a, r) => a + BUDGET[r], 0);
}

export type Rarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'BOSS';

export interface Valuation {
  code: string;
  name: string;
  rarity: Rarity;
  /** Bankroll per word this is worth over a 20-word run. */
  value: number;
  budget: number;
  /** An MK.II. Judged against the ceiling only — see §6.5. */
  isUpgrade: boolean;
  /** Over the rarity's allowance. Expected of an upgrade, not of a base relic. */
  overBudget: boolean;
  overCeiling: boolean;
  note: string;
}

/** §3.2 — twenty words a run, §3.1 allows at most 1+2+3 = 6 elites, 3 bosses. */
const WORDS = 20;
const ELITES = 6;
const BOSSES = 3;

/**
 * The measured 5-letter guess distribution, as shares: 1500 real solves at the
 * calibrated human handicap, mean 3.80.
 *
 * Kept as a fixed reference so a valuation is deterministic and a test does not
 * have to run the solver. A flat distribution will not do — every relic here is
 * gated on a guess-count threshold, so "every word takes four" makes some fire
 * always and others never, and values every one of them wrongly.
 */
const SHARES: ReadonlyArray<[guesses: number, share: number]> = Object.freeze([
  [2, 0.077],
  [3, 0.357],
  [4, 0.369],
  [5, 0.131],
  [6, 0.043],
  [7, 0.013],
  [8, 0.006],
  [9, 0.002],
  [10, 0.002],
]);

/**
 * A 1000-word sequence matching those shares, interleaved rather than sorted so
 * that streak-dependent relics see a realistic run of fast and slow solves
 * instead of one enormous block of them.
 */
export const REFERENCE_GUESSES: readonly number[] = (() => {
  const pool: number[] = [];
  for (const [g, share] of SHARES) for (let i = 0; i < Math.round(share * 1000); i++) pool.push(g);
  // Deterministic shuffle: a fixed 32-bit LCG, so this is stable across runs.
  let seed = 0x9e3779b9;
  for (let i = pool.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return Object.freeze(pool);
})();

export interface ValueInputs {
  /** Per-word guess counts, in order, for streak-dependent relics. */
  guesses: readonly number[];
  cfg: Readonly<EconomyConfig>;
}

/** Mean bankroll per word a payout bonus is worth, Clamp A applied. */
function payoutValue(
  guesses: readonly number[],
  bonus: (used: number, streak: number) => number,
  streaky: boolean,
  cfg: Readonly<EconomyConfig>,
): number {
  let streak = 0;
  let total = 0;
  for (const used of guesses) {
    const b = bonus(used, streaky ? streak + 1 : 0);
    if (streaky) streak = used <= 3 ? streak + 1 : 0;
    const plain = basePayout(5, used, cfg);
    const gross = plain + b;
    total += Math.min(gross, used + cfg.maxNetGainPerWord) - plain;
  }
  return total / Math.max(1, guesses.length);
}

export function valuations({
  guesses = REFERENCE_GUESSES,
  cfg = ECONOMY,
}: Partial<ValueInputs> = {}): Valuation[] {
  const pv = (b: (u: number, s: number) => number, streaky = false) =>
    payoutValue(guesses, b, streaky, cfg);

  const rows: Array<Omit<Valuation, 'budget' | 'overBudget' | 'overCeiling'>> = [
    {
      code: 'RL.11',
      name: 'FLYWHEEL',
      rarity: 'COMMON',
      isUpgrade: false,
      value: pv((u) => (u <= 2 ? 2 : 0)),
      note: '+2 at <=2 guesses. A <=3 trigger is 0.43 — boss-tier — whatever the bonus.',
    },
    {
      code: 'RL.11+',
      name: 'FLYWHEEL MK.II',
      rarity: 'COMMON',
      isUpgrade: true,
      value: pv((u) => (u <= 2 ? 3 : 0)),
      note: '+3 at <=2',
    },
    {
      code: 'RL.12',
      name: 'HOT STREAK',
      rarity: 'UNCOMMON',
      isUpgrade: false,
      value: pv((u, s) => (u <= 2 ? Math.min(s, 3) : 0), true),
      note: 'consecutive <=2 solves, capped at +3 (was uncapped, on a <=3 trigger)',
    },
    {
      code: 'RL.12+',
      name: 'HOT STREAK MK.II',
      rarity: 'UNCOMMON',
      isUpgrade: true,
      value: pv((u, s) => (u <= 2 ? Math.min(s, 5) : 0), true),
      note: 'cap +5, and a slow solve halves the streak rather than clearing it',
    },
    {
      code: 'RL.13',
      name: 'OPENING GAMBIT',
      rarity: 'UNCOMMON',
      isUpgrade: false,
      value: pv((u) =>
        u <= 2 ? basePayout(5, Math.max(1, u - 1), cfg) - basePayout(5, u, cfg) : 0,
      ),
      note: 'as if one fewer guess, gated on solving in <=2',
    },
    {
      code: 'RL.13+',
      name: 'OPENING GAMBIT MK.II',
      rarity: 'UNCOMMON',
      isUpgrade: true,
      value: pv((u) =>
        u <= 3 ? basePayout(5, Math.max(1, u - 1), cfg) - basePayout(5, u, cfg) : 0,
      ),
      note: 'the gate moves to <=3',
    },
    {
      code: 'RL.15',
      name: 'BLOODHOUND',
      rarity: 'UNCOMMON',
      isUpgrade: false,
      value: (1 * ELITES) / WORDS,
      note: `+1 bankroll x ${ELITES} elites, less the elite gold it forfeits`,
    },
    {
      code: 'RL.15+',
      name: 'BLOODHOUND MK.II',
      rarity: 'UNCOMMON',
      isUpgrade: true,
      value: (1 * (ELITES + BOSSES)) / WORDS,
      note: 'bosses count as well; +2 an elite would be 0.60, over the ceiling',
    },
    {
      code: 'RL.19',
      name: 'THE MOTH',
      rarity: 'UNCOMMON',
      isUpgrade: false,
      value: (1 * Math.floor(WORDS / 4)) / WORDS,
      note: '+1 on every fourth word (was +2 EVERY word, worth 2.50)',
    },
    {
      code: 'RL.19+',
      name: 'THE MOTH MK.II',
      rarity: 'UNCOMMON',
      isUpgrade: true,
      value: (1 * Math.floor(WORDS / 3)) / WORDS,
      note: 'gorging every third word',
    },
    {
      code: 'CH.02',
      name: 'THE GAMBLER (innate)',
      rarity: 'BOSS',
      isUpgrade: false,
      value: pv((u) => (u <= 3 ? 1 : 0)),
      note: 'held all run, so judged at the boss allowance',
    },
    {
      code: 'RL.31',
      name: 'ROSETTA SLAB',
      rarity: 'BOSS',
      isUpgrade: false,
      value: -1,
      note: 'payout -1 every word; the free green is an INFO effect, unmeasured',
    },
  ];

  return rows.map((r) => {
    const budget = BUDGET[r.rarity];
    return {
      ...r,
      budget,
      overBudget: r.value > budget,
      overCeiling: r.value > CEILING,
    };
  });
}

/** §2.3's bleed on the measured distribution: mean net bankroll per word. */
export function meanNet(
  guesses: readonly number[],
  cfg: Readonly<EconomyConfig> = ECONOMY,
): number {
  return guesses.reduce((a, u) => a + basePayout(5, u, cfg) - u, 0) / Math.max(1, guesses.length);
}

/** Relics this model cannot value, and why. Listed so the gap stays visible. */
export const UNMEASURED: ReadonlyArray<{ code: string; name: string; why: string }> = Object.freeze([
  { code: 'RL.01', name: 'LEXICON', why: 'lowers guesses/word — needs the engine' },
  { code: 'RL.02', name: 'THE SIEVE', why: 'lowers guesses/word — needs the engine' },
  { code: 'RL.03', name: 'PALIMPSEST', why: 'lowers guesses/word — needs the engine' },
  { code: 'RL.04', name: 'RANGEFINDER', why: 'changes the information a row carries' },
  { code: 'RL.06', name: 'CARTOGRAPHER', why: 'routing' },
  { code: 'RL.07', name: 'THE AUDITOR', why: 'player-activated, costs gold' },
  { code: 'RL.09', name: 'THE ANVIL', why: 'routing plus a flat -2 start' },
  { code: 'RL.14', name: 'THE GUILLOTINE', why: 'gold, not bankroll' },
  { code: 'RL.20', name: 'BLINDFOLD', why: 'player-activated wager' },
  { code: 'RL.21', name: 'ALL IN', why: 'player-activated wager' },
  { code: 'RL.22', name: 'POLYGLOT', why: 'gold, not bankroll' },
  { code: 'RL.23', name: 'THE TIN CUP', why: 'gold, not bankroll' },
  { code: 'RL.26', name: 'THE LANTERN', why: 'lowers guesses/word — needs the engine' },
  { code: 'RL.28', name: 'SHAVED COIN', why: 'changes the information a row carries' },
  { code: 'RL.29', name: 'THE MASK', why: 'modifier immunity — needs the engine' },
  { code: 'RL.30', name: 'OUROBOROS', why: 'one-shot revival, not per-word' },
]);
