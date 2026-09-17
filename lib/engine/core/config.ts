import { ECONOMY, type EconomyConfig } from '../economy/config';

/**
 * Every tunable that appears in MECHANICS.md. Technical brief §1.6.
 *
 * Nothing else in the engine hardcodes a number that appears in MECHANICS.md.
 * The harness overrides this object wholesale, which is why it is a plain frozen
 * value rather than a module of consts.
 *
 * ## What v2.0 deleted from here
 *
 * `acts[].pool`, `gauntlet.pool`, `goldPerLeftoverGuess`, `vaultCarryCap` and
 * `minNetGuessesPerWord` are all gone, and they were the four most-tuned numbers
 * in the file. They described a per-act budget that refilled: how big each act's
 * pool was, what the leftovers converted at, how much a word had to cost net of
 * refunds. §2.1 replaces all of it with one run-long bankroll, so there is no
 * act pool to size, no leftover to convert and no refund to floor.
 *
 * `revealCosts` and `preGuessRevealCap` are gone with the paid reveal ladder
 * (§12.1). `nodeWeights.SHOP` is gone because §4 makes the shop follow every
 * solve node rather than occupy one.
 *
 * The economy that replaced them lives in `economy/config.ts` and is reachable
 * here as `cfg.economy`, so a harness sweep overrides one object.
 */
import type { WordLength } from '../economy/config';
import type { Rarity } from '../content/types';

export interface ActConfig {
  /** §3.1 — exactly this many solve nodes on every legal path. */
  solveNodes: number;
  /** §3.1 — 6 map nodes, then the boss. */
  mapNodes: number;
  /** §3.1 — Act I at most 1 elite, Act II at most 2, Act III at most 3. */
  maxElites: number;
  /**
   * The length before modifiers. Flat 5 across all three acts: §7 makes length
   * a MODIFIER (`LONG_WORD` from Act II, `LONGER_WORD` in Act III), not a
   * property of the act. v1.3 made Act III 6-letter at the act level, which
   * double-counted with the modifier and put Act III's base above its own
   * headline difficulty.
   */
  wordLength: WordLength;
}

export interface GameConfig {
  acts: readonly [ActConfig, ActConfig, ActConfig];
  /** §8.3 — five words back to back. The separate 14-guess pool is removed. */
  gauntlet: { words: number; wordLength: WordLength };
  /** §2 and §4. One object so a sweep overrides one object. */
  economy: Readonly<EconomyConfig>;
  /**
   * §3.3 — gold on clearing a node.
   *
   * 30/50/90, not §3.3's 40/70/120. `v2-004` measured a run earning ~920g
   * against five slots at 60/110/180 and named the income its first lever:
   * "the shelf is not a choice". §4.2's prices came down about a third with
   * §6.6, which on its own makes the shelf less of a choice still, so the
   * income comes down with them. Measured: the pair leaves relic affordability
   * better than before and the run's spare gold lower — 11.6 relics and 167g
   * unspent becomes 9.1 and 124g.
   */
  rewards: {
    word: number;
    elite: number;
    boss: number;
  };
  /** §6.2 — hard cap. A sixth acquisition destroys one of the five. */
  relicSlots: number;
  /** §6.2 — separate from relic slots. */
  consumableSlots: number;
  /** §6.6 — the floor in `0.25 + 0.75 × share`, so pivoting stays possible. */
  shopArchetypeFloor: number;
  /**
   * §6.6 — the share of a relic draw each rarity takes, indexed by act.
   *
   * Rarity, not price, is what makes a RARE rare. Until this existed no draw
   * read the field at all: `rollShopStock` weighted by archetype alone, so a
   * tier's share of a shelf was however many relics happened to be in it, and
   * RARE — 7 of the 27 offerable relics — took 23% of every shelf in every act.
   *
   * Read as a share of the DRAW, not as a per-relic weight. `drawRelicSlots`
   * divides a tier's share by how many of that tier are still unheld, which
   * makes the stated share the one that lands and keeps it landing as relics
   * leave the pool.
   *
   * UNCOMMON stays the backbone in every act rather than peaking in the middle,
   * because §6.4's impact test left the registry at 3 COMMON, 10 UNCOMMON and 5
   * RARE. A curve that gave Act I to COMMON would be handing 60% of the early
   * shelves to three relics, and three relic slots would then show the same
   * three relics every shop. What moves across the acts is the thing the player
   * is meant to feel moving: RARE, from a tenth of the shelf to over a quarter.
   *
   * BOSS is 0 in every act: §3.3 gives boss relics out on a boss clear and
   * `rollBossOffer` draws them. CONSUMABLE is 0 because §4.1 reserves the
   * shelf's last slot for one rather than letting it compete for a relic slot.
   */
  rarityWeights: readonly [
    Readonly<Record<Rarity, number>>,
    Readonly<Record<Rarity, number>>,
    Readonly<Record<Rarity, number>>,
  ];
  /**
   * §4.2 — the shelf price by rarity. Flat, no variance.
   *
   * Moved out of `nodes.ts`, where it was a module constant and therefore
   * outside the object the harness overrides — which is why no sweep in eleven
   * snapshots ever moved a price, including the one `v2-004` nominated as the
   * cheapest lever available.
   */
  prices: Readonly<Record<Rarity, number>>;
  /** §4.1 — how many relics and consumables a shop rolls. */
  shopRelics: number;
  shopConsumables: number;
  /** §4.2 — 20g, +10g per reroll within the same shop. */
  rerollBase: number;
  rerollStep: number;
  /** §4.2 — sell a held relic for this fraction of its price, rounded down. */
  sellFraction: number;
  /** §3.1 — weights, applied before the constraints that override them. */
  nodeWeights: Readonly<Record<'WORD' | 'ELITE' | 'FORGE' | 'EVENT', number>>;
  /** Cipher's deferral depth; Fog's is 1. MECHANICS.md §7. */
  cipherDeferralDepth: number;
  /** How many turns a GREEN survives under Decay before reverting. */
  decayTurns: number;
  /** applyEffect re-entry guard. Technical brief §2.4. */
  maxEffectDepth: number;
  /** `RL.07` The Auditor. Raised from 5g with the v2.0 registry. */
  auditorCostGold: number;
}

export const CONFIG: Readonly<GameConfig> = Object.freeze({
  acts: [
    { solveNodes: 4, mapNodes: 6, maxElites: 1, wordLength: 5 },
    { solveNodes: 4, mapNodes: 6, maxElites: 2, wordLength: 5 },
    { solveNodes: 4, mapNodes: 6, maxElites: 3, wordLength: 5 },
  ],
  gauntlet: { words: 5, wordLength: 5 },
  economy: ECONOMY,
  rewards: { word: 30, elite: 50, boss: 90 },
  relicSlots: 5,
  consumableSlots: 2,
  shopArchetypeFloor: 0.25,
  rarityWeights: [
    Object.freeze({ COMMON: 0.35, UNCOMMON: 0.55, RARE: 0.1, BOSS: 0, CONSUMABLE: 0 }),
    Object.freeze({ COMMON: 0.28, UNCOMMON: 0.55, RARE: 0.17, BOSS: 0, CONSUMABLE: 0 }),
    Object.freeze({ COMMON: 0.2, UNCOMMON: 0.52, RARE: 0.28, BOSS: 0, CONSUMABLE: 0 }),
  ],
  prices: Object.freeze({ COMMON: 40, UNCOMMON: 70, RARE: 110, BOSS: 150, CONSUMABLE: 30 }),
  shopRelics: 3,
  shopConsumables: 1,
  rerollBase: 20,
  rerollStep: 10,
  sellFraction: 0.5,
  nodeWeights: { WORD: 0.6, ELITE: 0.18, FORGE: 0.12, EVENT: 0.1 },
  cipherDeferralDepth: 3,
  decayTurns: 1,
  maxEffectDepth: 8,
  auditorCostGold: 15,
} as const);

/** Harness override. Returns a new frozen config; never mutates CONFIG. */
export function withConfig(patch: Partial<GameConfig>): Readonly<GameConfig> {
  return Object.freeze({ ...CONFIG, ...patch });
}
