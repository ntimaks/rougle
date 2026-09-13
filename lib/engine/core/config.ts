import type { Rarity } from '../content/types';

/**
 * Every tunable that appears in MECHANICS.md. Technical brief §1.6.
 *
 * Nothing else in the engine hardcodes a number that appears in MECHANICS.md.
 * The harness overrides this object wholesale, which is why it is a plain frozen
 * value rather than a module of consts.
 *
 * The act pools in `acts`, the economy and `gauntlet.pool` are all MEASURED
 * (balance snapshot 007, MECHANICS.md §2.2) rather than derived from the 3.9
 * baseline the v1.0 numbers came from.
 *
 * Do not tune the game by nudging these without a report. Four findings from
 * the sweeps that produced them are worth knowing before you try:
 *
 * - Act III's pool is NOT a difficulty lever (flat from 17 down to 10). Its
 *   four solve nodes cost 13.3 and everything that kills there is the Gauntlet,
 *   which is funded separately.
 * - Pools alone cannot reach §10.3's band. With Act I's death rate under 15%
 *   they floor at about 48%.
 * - Neither can pools plus the economy: that pair floors at about 38%.
 * - `gauntlet.pool` is the lever that closes the gap, and the only one that
 *   moves the win rate without touching Act I's death rate at all.
 */
export interface ActConfig {
  /** MEASURED — MECHANICS.md §2.2, balance snapshot 006. */
  pool: number;
  solveNodes: number;
  mapNodes: number;
  maxElites: number;
  wordLength: 5 | 6 | 7;
}

export interface GameConfig {
  acts: readonly [ActConfig, ActConfig, ActConfig];
  gauntlet: { pool: number; words: number; wordLength: 5 | 6 | 7 };
  goldPerLeftoverGuess: number;
  ledgerGoldPerLeftoverGuess: number;
  vaultCarryCap: number;
  emergencyCosts: readonly number[];
  rewards: {
    /**
     * R-025: a word node pays this INSTEAD of its relic, never as well. The
     * player chooses. Elite and boss nodes grant both.
     */
    wordGoldInstead: number;
    elite: number;
    boss: number;
  };
  minNetGuessesPerWord: number;
  preGuessRevealCap: number;
  consumableSlots: number;
  shopArchetypeFloor: number;
  /**
   * MECHANICS.md §6.6 — the share of a relic draw each rarity takes, indexed by
   * act. Rarity, not price, is what makes a RARE rare: these are the numbers
   * that decide how often one is on the shelf at all.
   *
   * Read as a SHARE OF THE DRAW, not as a per-relic weight. There are 8 COMMON,
   * 12 UNCOMMON and 7 RARE relics, so weighting each relic equally hands the
   * biggest tier the biggest share — which is why RARE was appearing 23% of the
   * time before this existed. `drawRelicSlots` divides a tier's share by how
   * many of that tier are still in the pool, so the share holds as relics are
   * taken and the ratio between tiers means what it says.
   *
   * BOSS is 0 in every act on purpose: boss relics come from bosses (§3.3) and
   * are drawn from their own pool. CONSUMABLE is 0 because the shelf reserves a
   * slot for one (§4.1) rather than letting it compete with the relics.
   */
  rarityWeights: readonly [
    Readonly<Record<Rarity, number>>,
    Readonly<Record<Rarity, number>>,
    Readonly<Record<Rarity, number>>,
  ];
  /** §4.2 — the shelf price by rarity, before the ±`priceVariance` swing. */
  prices: Readonly<Record<Rarity, number>>;
  /** The swing on a shelf price, addressed off the slot so it never re-rolls. */
  priceVariance: number;
  /** §4.1 — the shelf is this many relics plus `shopConsumableSlots`. */
  shopRelicSlots: number;
  shopConsumableSlots: number;
  nodeWeights: Readonly<Record<'WORD' | 'ELITE' | 'SHOP' | 'FORGE' | 'EVENT', number>>;
  /** Cipher's deferral depth; Fog's is 1. MECHANICS.md §7.2. */
  cipherDeferralDepth: number;
  /** How many turns a GREEN survives under Decay before reverting. MECHANICS.md §5. */
  decayTurns: number;
  /** applyEffect re-entry guard. Technical brief §2.4. */
  maxEffectDepth: number;
  /** RL.07 The Auditor, per R-001. */
  auditorCostGold: number;
  /**
   * The §2.5 reveal ladder. Escalating within a word, reset each word; its
   * length is the per-word cap, so a fourth purchase is simply off the end.
   */
  revealCosts: readonly number[];
}

export const CONFIG: Readonly<GameConfig> = Object.freeze({
  acts: [
    { pool: 19, solveNodes: 4, mapNodes: 6, maxElites: 1, wordLength: 5 },
    { pool: 12, solveNodes: 4, mapNodes: 6, maxElites: 2, wordLength: 5 },
    { pool: 14, solveNodes: 4, mapNodes: 6, maxElites: 3, wordLength: 6 },
  ],
  // A separate pool that never touches the act pool, in either direction.
  //
  // 9, not snapshot 007's 10. 007 measured 9 and held it: on that economy it
  // took the win rate to 28.2%, low in the band and buying nothing. §6.6's
  // rarity weighting and §4.2's prices are worth +6.5 points on their own, so
  // the same guess now lands the run at 33.2% and closes §10.3's second
  // win-rate target as 007 said it would. Balance snapshot v2-002.
  gauntlet: { pool: 9, words: 5, wordLength: 5 },
  goldPerLeftoverGuess: 10,
  ledgerGoldPerLeftoverGuess: 15, // RL.24 The Ledger
  vaultCarryCap: 10, // RL.27 The Vault
  emergencyCosts: [25, 50, 100],
  // 20 is one §2.5 reveal exactly: declining a relic buys one look at a letter.
  // At 40 it bought that AND most of an emergency guess, which is why the gold
  // was never a real alternative to the relic. MECHANICS.md §3.3, R-025.
  rewards: { wordGoldInstead: 20, elite: 40, boss: 60 },
  minNetGuessesPerWord: 1, // MECHANICS.md §2.4 Rule A
  preGuessRevealCap: 2, // MECHANICS.md §6.3
  consumableSlots: 3,
  shopArchetypeFloor: 0.25, // MECHANICS.md §6.4
  rarityWeights: [
    Object.freeze({ COMMON: 0.6, UNCOMMON: 0.3, RARE: 0.1, BOSS: 0, CONSUMABLE: 0 }),
    Object.freeze({ COMMON: 0.42, UNCOMMON: 0.42, RARE: 0.16, BOSS: 0, CONSUMABLE: 0 }),
    Object.freeze({ COMMON: 0.26, UNCOMMON: 0.46, RARE: 0.28, BOSS: 0, CONSUMABLE: 0 }),
  ],
  prices: Object.freeze({ COMMON: 35, UNCOMMON: 60, RARE: 95, BOSS: 140, CONSUMABLE: 30 }),
  priceVariance: 0.15,
  shopRelicSlots: 3, // MECHANICS.md §4.1
  shopConsumableSlots: 1,
  nodeWeights: { WORD: 0.55, ELITE: 0.15, SHOP: 0.12, FORGE: 0.1, EVENT: 0.08 },
  cipherDeferralDepth: 3,
  decayTurns: 1,
  maxEffectDepth: 8,
  auditorCostGold: 5,
  revealCosts: [20, 55, 130], // MECHANICS.md §2.5
} as const);

/** Harness override. Returns a new frozen config; never mutates CONFIG. */
export function withConfig(patch: Partial<GameConfig>): Readonly<GameConfig> {
  return Object.freeze({ ...CONFIG, ...patch });
}
