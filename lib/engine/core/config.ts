/**
 * Every tunable that appears in MECHANICS.md. Technical brief §1.6.
 *
 * Nothing else in the engine hardcodes a number that appears in MECHANICS.md.
 * The harness overrides this object wholesale, which is why it is a plain frozen
 * value rather than a module of consts.
 *
 * ⚠ PROVISIONAL: the act budgets are derived estimates, not measurements
 * (MECHANICS.md §10.1). Every number in `acts` and `gauntlet` is provisional
 * until the Phase 5 sweep (B-02) confirms or replaces it. Do not treat them as
 * settled and do not tune the game by nudging them without a report.
 */
export interface ActConfig {
  /** PROVISIONAL — MECHANICS.md §2.2 */
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
  rewards: { word: readonly [number, number]; elite: number; boss: number };
  minNetGuessesPerWord: number;
  preGuessRevealCap: number;
  consumableSlots: number;
  shopArchetypeFloor: number;
  nodeWeights: Readonly<Record<'WORD' | 'ELITE' | 'SHOP' | 'FORGE' | 'EVENT', number>>;
  /** Cipher's deferral depth; Fog's is 1. MECHANICS.md §7.2. */
  cipherDeferralDepth: number;
  /** How many turns a GREEN survives under Decay before reverting. MECHANICS.md §5. */
  decayTurns: number;
  /** applyEffect re-entry guard. Technical brief §2.4. */
  maxEffectDepth: number;
  /** RL.07 The Auditor, per R-001. */
  auditorCostGold: number;
}

export const CONFIG: Readonly<GameConfig> = Object.freeze({
  acts: [
    { pool: 22, solveNodes: 4, mapNodes: 6, maxElites: 1, wordLength: 5 },
    { pool: 19, solveNodes: 4, mapNodes: 6, maxElites: 2, wordLength: 5 },
    { pool: 17, solveNodes: 4, mapNodes: 6, maxElites: 3, wordLength: 6 },
  ],
  // A separate pool that never touches the act pool, in either direction.
  gauntlet: { pool: 14, words: 5, wordLength: 5 },
  goldPerLeftoverGuess: 10,
  ledgerGoldPerLeftoverGuess: 15, // RL.24 The Ledger
  vaultCarryCap: 10, // RL.27 The Vault
  emergencyCosts: [25, 50, 100],
  rewards: { word: [15, 25], elite: 40, boss: 60 },
  minNetGuessesPerWord: 1, // MECHANICS.md §2.4 Rule A
  preGuessRevealCap: 2, // MECHANICS.md §6.3
  consumableSlots: 3,
  shopArchetypeFloor: 0.25, // MECHANICS.md §6.4
  nodeWeights: { WORD: 0.55, ELITE: 0.15, SHOP: 0.12, FORGE: 0.1, EVENT: 0.08 },
  cipherDeferralDepth: 3,
  decayTurns: 1,
  maxEffectDepth: 8,
  auditorCostGold: 5,
} as const);

/** Harness override. Returns a new frozen config; never mutates CONFIG. */
export function withConfig(patch: Partial<GameConfig>): Readonly<GameConfig> {
  return Object.freeze({ ...CONFIG, ...patch });
}
