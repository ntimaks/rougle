import { draw, wordList, type WordLength } from '../../lib/engine';
import '../../lib/engine/words/all';
import { ECONOMY, type EconomyConfig } from '../../lib/engine/economy/config';
import { basePayout } from '../../lib/engine/economy/bankroll';
import { solveClean } from '../baseline';
import { DEFAULT_SOLVER, type SolverConfig } from '../solver';

/**
 * The v2.0 bleed model. MECHANICS.md §2.3, §11.2, §14 Phase 2.
 *
 * §14 makes Phase 2 a GATE: "does the bankroll actually bite, and does buying a
 * relic feel like relief? If either answer is no, stop. Nothing downstream fixes
 * it." Answering that after building the UI is the expensive order. Most of it
 * is answerable now, because §2.3's payout depends on exactly one unknown — how
 * many guesses a word actually takes — and the solver measures that against the
 * real word lists today.
 *
 * So this plays the v2.0 RUN STRUCTURE with the v2.0 ECONOMY and NO RELICS, on
 * real solved words, and reports where the bankroll goes. It is not the engine
 * and does not pretend to be: no modifiers, no map, no events, no relic effects.
 * That makes every number here an UPPER bound on how well a relic-less run does,
 * which is the right direction for a floor.
 */

/** §3.2 — 12 solve nodes plus bosses of 2, 1 and 5 words. Twenty words. */
interface WordSlot {
  act: 0 | 1 | 2;
  length: WordLength;
  kind: 'WORD' | 'ELITE' | 'BOSS';
  /** §4 — a shop opens after every solve node, elites included. Not after bosses. */
  shopAfter: boolean;
  /**
   * True only on the LAST word of a boss. §3.3 pays a boss 120g and +4 bankroll
   * for CLEARING it, and §8 says the same — once, not once per word. The Twins
   * is 2 words and the Gauntlet is 5, so paying per word invents 20 bankroll and
   * 600 gold a run, which was enough on its own to make a relic-less run win
   * 97% of the time and read as "the economy does not bite".
   */
  paysReward: boolean;
  label: string;
}

/**
 * §3.1 caps elites at 1 / 2 / 3 per act, and §3.3 pays them nearly double. A
 * run that takes every elite it is allowed is the richest legal run, so this
 * models that: the most gold a relic-less player could possibly have.
 */
export function runStructure(
  longWords: boolean,
  elites: readonly number[] = [1, 2, 3],
): WordSlot[] {
  const slots: WordSlot[] = [];
  const bosses: Array<{ label: string; words: number }> = [
    { label: 'THE TWINS', words: 2 },
    { label: 'THE CIPHER', words: 1 },
    { label: 'THE GAUNTLET', words: 5 },
  ];
  for (const act of [0, 1, 2] as const) {
    for (let n = 0; n < 4; n++) {
      const isElite = n >= 4 - elites[act]!;
      slots.push({
        paysReward: true,
        act,
        // §7 — Long Word is Act II+, Longer Word is Act III. Modifier frequency
        // is unspecified in v2.0, so `longWords` brackets it: off is the
        // cheapest possible run, on is every eligible word at the longer length.
        length: longWords && act >= 1 ? ((act === 2 ? 7 : 6) as WordLength) : 5,
        kind: isElite ? 'ELITE' : 'WORD',
        shopAfter: true,
        label: `act ${act + 1} node ${n + 1}`,
      });
    }
    const boss = bosses[act]!;
    for (let w = 0; w < boss.words; w++) {
      slots.push({
        act,
        length: 5,
        kind: 'BOSS',
        shopAfter: false,
        paysReward: w === boss.words - 1,
        label: boss.label,
      });
    }
  }
  return slots;
}

export interface BleedOptions {
  /** §9 — the character's starting bankroll. */
  start: number;
  /**
   * Whether the player spends gold on §4.1 guess refills. This is the single
   * biggest structural question in the v2.0 economy and it is why the model
   * exists: 12 shops × 3 refills × 25g is 36 bankroll for 900g, and §2.3's
   * bleed over 20 words is about the same number.
   */
  buyRefills: boolean;
  longWords: boolean;
  /**
   * Elites per act. §3.1 caps them at 1/2/3 and §3.3 pays them 70g against a
   * word's 40g, so [1,2,3] is the richest legal run and [0,0,0] the poorest.
   * Bracketing matters: gold is what the refill valve runs on.
   */
  elites: readonly number[];
  /** Scales §3.3's node gold, to ask how much of the economy the refill valve is. */
  goldScale: number;
  solver: SolverConfig;
  cfg: Readonly<EconomyConfig>;
}

export interface BleedResult {
  survived: boolean;
  /** Index into the word sequence where the bankroll ran out, or -1. */
  diedAtWord: number;
  /** §11.2 — the first word at which no line of play still reaches the end. */
  doomedAtWord: number;
  /** Words played between doomed and dead. §11.2's gating metric, in words. */
  doomedToDead: number;
  bankrollByWord: number[];
  guessesByWord: number[];
  goldEarned: number;
  goldSpent: number;
  refillsBought: number;
  /**
   * Refills bought at each shop in order. The total alone cannot see a broken
   * per-shop limit — the §2.1 cap and running out of gold hold it under 36
   * anyway — so the bound §4.1 actually states needs the per-shop numbers.
   */
  refillsByShop: number[];
  emergenciesBought: number;
  /** Total bankroll a relic-less run ends up short by. The relic budget. */
  deficit: number;
}

const GOLD = { WORD: 40, ELITE: 70, BOSS: 120 } as const;
const REFILLS_PER_SHOP = 3;

/**
 * §11.2 — "doomed" means no reachable line of play reaches the next boss.
 *
 * Modelled as the optimistic bound: assume every remaining word falls in TWO
 * guesses, the best a player can realistically hope for, and that every future
 * shop refill and emergency rung is affordable. If the bankroll still cannot
 * survive that, the run is arithmetically over however well it is played.
 * Anything looser would report runs as doomed that a hot streak could save.
 */
function stillReachable(
  bankroll: number,
  gold: number,
  remaining: readonly WordSlot[],
  emergenciesUsed: number,
  cfg: Readonly<EconomyConfig>,
): boolean {
  let br = bankroll;
  let g = gold;
  let rungs = emergenciesUsed;
  for (const slot of remaining) {
    const best = 2;
    br += basePayout(slot.length, best, cfg) - best;
    if (slot.paysReward) {
      if (slot.kind === 'BOSS') br += cfg.bossBankroll;
      g += GOLD[slot.kind];
    }
    if (slot.shopAfter) {
      while (g >= cfg.refillCost && br < cfg.bankrollCap) {
        g -= cfg.refillCost;
        br += 1;
      }
    }
    while (br <= 0) {
      const cost = cfg.emergencyCosts[rungs];
      if (cost === undefined || g < cost) return false;
      g -= cost;
      rungs += 1;
      br += cfg.emergencyGrant;
    }
  }
  return true;
}

export function playBleed(seed: string, opts: BleedOptions): BleedResult {
  const { cfg } = opts;
  const slots = runStructure(opts.longWords, opts.elites);
  const solutions = (len: WordLength) => wordList(len).solutions;

  let bankroll = opts.start;
  let gold = 0;
  let goldEarned = 0;
  let goldSpent = 0;
  let refills = 0;
  const refillsByShop: number[] = [];
  let emergencies = 0;
  const bankrollByWord: number[] = [];
  const guessesByWord: number[] = [];
  let doomedAt = -1;
  let diedAt = -1;

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!;

    if (doomedAt < 0 && !stillReachable(bankroll, gold, slots.slice(i), emergencies, cfg)) {
      doomedAt = i;
    }

    const pool = solutions(slot.length);
    const solution = pool[Math.floor(draw(seed, `v2:word:${i}`, 0) * pool.length)]!;
    const used = solveClean(solution, slot.length, opts.solver, `${seed}:${i}`);
    guessesByWord.push(used);

    // §2.1 — every guess decrements. The word is only reached if the bankroll
    // covers it; running out mid-word is what the ladder is for.
    let spent = 0;
    while (spent < used) {
      if (bankroll <= 0) {
        const cost = cfg.emergencyCosts[emergencies];
        if (cost === undefined || gold < cost) {
          diedAt = i;
          bankrollByWord.push(0);
          break;
        }
        gold -= cost;
        goldSpent += cost;
        emergencies += 1;
        bankroll += cfg.emergencyGrant;
      }
      bankroll -= 1;
      spent += 1;
    }
    if (diedAt >= 0) break;

    // §2.3 — the payout, and §2.1's cap with overflow to gold.
    const payout =
      basePayout(slot.length, used, cfg) +
      (slot.kind === 'BOSS' && slot.paysReward ? cfg.bossBankroll : 0);
    const room = Math.max(0, cfg.bankrollCap - bankroll);
    const kept = Math.min(payout, room);
    bankroll += kept;
    gold += (payout - kept) * cfg.overflowGoldPerGuess;
    goldEarned += (payout - kept) * cfg.overflowGoldPerGuess;

    if (slot.paysReward) {
      const paid = Math.round(GOLD[slot.kind] * opts.goldScale);
      gold += paid;
      goldEarned += paid;
    }

    if (slot.shopAfter && opts.buyRefills) {
      let bought = 0;
      while (bought < REFILLS_PER_SHOP && gold >= cfg.refillCost && bankroll < cfg.bankrollCap) {
        gold -= cfg.refillCost;
        goldSpent += cfg.refillCost;
        bankroll += 1;
        bought += 1;
        refills += 1;
      }
      refillsByShop.push(bought);
    }
    bankrollByWord.push(bankroll);
  }

  const survived = diedAt < 0;
  return {
    survived,
    diedAtWord: diedAt,
    doomedAtWord: doomedAt,
    doomedToDead: doomedAt >= 0 && diedAt >= 0 ? diedAt - doomedAt : 0,
    bankrollByWord,
    guessesByWord,
    goldEarned,
    goldSpent,
    refillsBought: refills,
    refillsByShop,
    emergenciesBought: emergencies,
    // What relics would have had to supply. Zero for a run that finished.
    deficit: survived ? 0 : slots.length - diedAt,
  };
}

export const DEFAULT_BLEED: Omit<BleedOptions, 'start'> = {
  buyRefills: true,
  longWords: false,
  elites: [1, 2, 3],
  goldScale: 1,
  solver: DEFAULT_SOLVER,
  cfg: ECONOMY,
};
