import { draw, wordList, type WordLength } from '../../lib/engine';
import '../../lib/engine/words/all';
import { ECONOMY } from '../../lib/engine/economy/config';
import { basePayout, largestBonus } from '../../lib/engine/economy/bankroll';
import { solveClean } from '../baseline';
import type { SolverConfig } from '../solver';

/**
 * What a payout relic is actually worth. MECHANICS.md §2.5 Clamp B, §6.4, §6.5.
 *
 * §14's gate has two halves and `bleed.ts` only answers the first. This is the
 * second: "does buying a relic feel like relief?" The §2.3 payout is the only
 * thing most of the TEMPO archetype touches, and every one of them is gated on
 * solving in three or fewer — so their entire value is one number the solver
 * can measure, P(solve <= 3), and Clamp B means holding several of them is
 * worth no more than holding the best one.
 */

export interface GuessDistribution {
  counts: number[];
  total: number;
  mean: number;
  /** The number every §2.3 payout relic in the registry is gated on. */
  fastShare: number;
}

/** Real solves on the real list, unbiased by where a run happens to die. */
export function guessDistribution(
  words: number,
  solver: SolverConfig,
  length: WordLength = 5,
  seed = 'RELICVAL',
): GuessDistribution {
  const pool = wordList(length).solutions;
  const counts: number[] = [];
  let total = 0;
  let fast = 0;
  for (let i = 0; i < words; i++) {
    const solution = pool[Math.floor(draw(seed, 'word', i) * pool.length)]!;
    const used = solveClean(solution, length, solver, `${seed}:${i}`);
    counts[used] = (counts[used] ?? 0) + 1;
    total += used;
    if (used <= 3) fast++;
  }
  return { counts, total: words, mean: total / words, fastShare: fast / words };
}

export interface Loadout {
  label: string;
  /** Bonus for this word, given guesses used and the streak so far. */
  bonus: (used: number, streak: number) => number;
  /** Whether this word advances or resets RL.12's counter. */
  streaky?: boolean;
}

/**
 * The registry's payout relics, as §2.3 sees them.
 *
 * `RL.13` Opening Gambit is modelled as a flat +1: its rule is "if your first
 * guess held four or more unique letters, the payout is calculated as though
 * you used one fewer guess", and the solver's opener is a five-unique-letter
 * word essentially always, so the condition is not a condition in practice.
 */
export const LOADOUTS: Loadout[] = [
  { label: 'nothing', bonus: () => 0 },
  { label: 'RL.11 Flywheel (+2 at <=3)', bonus: (u) => (u <= 3 ? 2 : 0) },
  { label: 'RL.11 MK.II (+2 at <=4)', bonus: (u) => (u <= 4 ? 2 : 0) },
  { label: 'CH.02 Gambler (+3 at <=3)', bonus: (u) => (u <= 3 ? 3 : 0) },
  { label: 'RL.12 Hot Streak (+streak)', bonus: (u, s) => (u <= 3 ? s : 0), streaky: true },
  { label: 'RL.13 Opening Gambit (+1)', bonus: () => 1 },
  {
    label: 'all four, Clamp B applied',
    bonus: (u, s) =>
      largestBonus([
        { amount: u <= 3 ? 2 : 0, source: 'RL.11' },
        { amount: u <= 3 ? 3 : 0, source: 'CH.02' },
        { amount: u <= 3 ? s : 0, source: 'RL.12' },
        { amount: 1, source: 'RL.13' },
      ])?.amount ?? 0,
    streaky: true,
  },
];

export interface LoadoutValue {
  label: string;
  /** Mean bankroll a word nets, payout and bonus less the guesses spent. */
  netPerWord: number;
  meanBonus: number;
  /** Share of words where the relic paid anything at all. */
  hitRate: number;
  /** RL.12's counter at the end, if it is in the loadout. */
  finalStreak: number;
}

export function valueOf(
  loadout: Loadout,
  guesses: readonly number[],
  length: WordLength = 5,
): LoadoutValue {
  let streak = 0;
  let bonusTotal = 0;
  let netTotal = 0;
  let hits = 0;
  for (const used of guesses) {
    const bonus = loadout.bonus(used, loadout.streaky ? streak + 1 : 0);
    if (loadout.streaky) streak = used <= 3 ? streak + 1 : 0;
    if (bonus > 0) hits++;
    bonusTotal += bonus;
    // Clamp A on the word's net, exactly as the reducer applies it.
    const gross = basePayout(length, used) + bonus;
    const payout = Math.min(gross, used + ECONOMY.maxNetGainPerWord);
    netTotal += payout - used;
  }
  const n = Math.max(1, guesses.length);
  return {
    label: loadout.label,
    netPerWord: netTotal / n,
    meanBonus: bonusTotal / n,
    hitRate: hits / n,
    finalStreak: streak,
  };
}

/** The per-word guess counts behind a distribution, for streak order. */
export function guessSequence(
  words: number,
  solver: SolverConfig,
  length: WordLength = 5,
  seed = 'RELICVAL',
): number[] {
  const pool = wordList(length).solutions;
  return Array.from({ length: words }, (_, i) => {
    const solution = pool[Math.floor(draw(seed, 'word', i) * pool.length)]!;
    return solveClean(solution, length, solver, `${seed}:${i}`);
  });
}
