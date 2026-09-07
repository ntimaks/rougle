/**
 * The v2.0 economy constants. MECHANICS.md §2, §3.3, §4, §6.2, §6.7.
 *
 * Separate from `core/config.ts` — which still holds the v1.3 per-act pool —
 * because the two economies cannot both be live and the migration is not one
 * commit. This file is the destination; nothing here is wired into `reduce`
 * yet. When it is, `core/config.ts` loses §2 entirely and this merges into it.
 *
 * Every number is PROVISIONAL. MECHANICS.md §11.3 is explicit: "Every number in
 * §2 and §4 is provisional until simulation confirms it." v1.3 shipped four
 * balance snapshots learning that lesson the expensive way, so the numbers here
 * are written as the spec states them and nothing has been pre-tuned.
 */
export type WordLength = 5 | 6 | 7;

export interface EconomyConfig {
  /** §2.1 — one bankroll for the whole run. Character-modified at start (§9). */
  bankrollStart: number;
  /** §2.1 — hard cap. Overflow converts to gold immediately and automatically. */
  bankrollCap: number;
  /** §2.1 — the rate that overflow converts at. */
  overflowGoldPerGuess: number;
  /** §2.3 — `payout = max(0, base(length) − guesses_used)`. */
  payoutBase: Readonly<Record<WordLength, number>>;
  /** §2.5 Clamp A — no word may ADD more than this to the bankroll. */
  maxNetGainPerWord: number;
  /** §2.4 — escalates across the RUN, not the act. Off the end is unavailable. */
  emergencyCosts: readonly number[];
  /** §2.4 — every rung grants the same. */
  emergencyGrant: number;
  /** §3.3 — a boss pays this on top of its words' payouts. */
  bossBankroll: number;
  /** §6.7 — Forge operation B converts gold to bankroll at this rate. */
  forgeGoldPerBankroll: number;
  /** §4.2 — a shop guess refill. */
  refillCost: number;
}

export const ECONOMY: Readonly<EconomyConfig> = Object.freeze({
  bankrollStart: 12,
  bankrollCap: 24,
  overflowGoldPerGuess: 10,
  payoutBase: Object.freeze({ 5: 6, 6: 7, 7: 8 }),
  maxNetGainPerWord: 5,
  emergencyCosts: [25, 50, 100, 200],
  emergencyGrant: 3,
  bossBankroll: 4,
  forgeGoldPerBankroll: 20,
  refillCost: 25,
} as const);

/** Harness override. Returns a new frozen config; never mutates ECONOMY. */
export function withEconomy(patch: Partial<EconomyConfig>): Readonly<EconomyConfig> {
  return Object.freeze({ ...ECONOMY, ...patch });
}
