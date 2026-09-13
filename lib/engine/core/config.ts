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
  /** §3.3 — gold on clearing a node. */
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
  rewards: { word: 40, elite: 70, boss: 120 },
  relicSlots: 5,
  consumableSlots: 2,
  shopArchetypeFloor: 0.25,
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
