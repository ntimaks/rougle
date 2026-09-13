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
  /**
   * §2.3 — `payout = max(0, base(length) − guesses_used)`.
   *
   * FLAT across lengths. It used to rise by 1 per letter, which made §7's two
   * "difficulty" modifiers the most profitable thing in the game: longer words
   * take FEWER guesses, not more, so a rising base compounded an advantage
   * instead of compensating a cost. Measured net was -1.54 at five letters,
   * +0.07 at six and +1.80 at seven.
   *
   * Flat leaves them easier than a five-letter word (-1.54 / -0.94 / -0.20)
   * but no longer profitable. The residue is not the payout's fault: §10's
   * six- and seven-letter solution lists are ~800 and ~500 against ~1500, so
   * there is simply less to disambiguate. Closing it the rest of the way is a
   * curation job, not an economy one.
   */
  payoutBase: Readonly<Record<WordLength, number>>;
  /** §2.5 Clamp A — no word may ADD more than this to the bankroll. */
  maxNetGainPerWord: number;
  /**
   * §2.4 — escalates across the RUN, not the act. Off the end is unavailable.
   *
   * Repriced from 25/50/100. The grant tripled from +1 to +3 in v2.0 and the
   * price did not move, which put the first purchase at 8.3g per bankroll —
   * the cheapest bankroll in the game, below refills and a third of relic
   * parity. That makes the last resort the best deal on the board and rewards
   * running yourself to zero on purpose. At 80 the first rung is ~27g per
   * bankroll, roughly relic parity, and it doubles from there.
   */
  emergencyCosts: readonly number[];
  /** §2.4 — every rung grants the same. */
  emergencyGrant: number;
  /** §3.3 — a boss pays this on top of its words' payouts. */
  bossBankroll: number;
  /**
   * §6.7 B — the forge converts gold to bankroll off the SAME §4.1 ladder the
   * shop sells from, rather than at its own flat rate.
   *
   * It used to be a flat 20g with no cap at all ("any quantity affordable"),
   * which after the §4.1 and §2.4 repricings made it the cheapest and only
   * uncapped bankroll in the game — switching it on took a relic-less run from
   * 34.3% to 63.5%, undoing most of both fixes. Pricing it separately would
   * have re-opened the arbitrage the moment either number moved again.
   *
   * One ladder, one run cap, wherever you buy it. This flag exists only so the
   * harness can measure the difference; the rule is the shared ladder.
   */
  forgeUsesRefillLadder: true;
  /**
   * §4.1/§4.2 — the guess-refill ladder, escalating across the RUN.
   *
   * Was a flat 25g, three a shop, twelve shops: 36 purchasable bankroll against
   * a non-relic economy of 24 (12 start + 12 from boss clears). The valve was
   * one and a half times the base economy, and at 25g per bankroll it was also
   * priced better than relics — an uncommon at 110g closing ~0.4 a word over
   * ten words is ~27g per bankroll. Gold bought survival more cheaply than it
   * bought a build, which is backwards.
   *
   * Its length is the run cap; `refillsPerShop` is the per-shop cap. 540g for 6
   * bankroll, 90g each, comfortably worse than relic efficiency.
   */
  refillCosts: readonly number[];
  /** §4.1 — how many refills one shop will sell. */
  refillsPerShop: number;
}

export const ECONOMY: Readonly<EconomyConfig> = Object.freeze({
  bankrollStart: 12,
  bankrollCap: 24,
  overflowGoldPerGuess: 10,
  payoutBase: Object.freeze({ 5: 6, 6: 6, 7: 6 }),
  maxNetGainPerWord: 5,
  emergencyCosts: [80, 160, 320],
  emergencyGrant: 3,
  bossBankroll: 4,
  forgeUsesRefillLadder: true,
  refillCosts: [40, 60, 80, 100, 120, 140],
  refillsPerShop: 1,
} as const);

/** Harness override. Returns a new frozen config; never mutates ECONOMY. */
export function withEconomy(patch: Partial<EconomyConfig>): Readonly<EconomyConfig> {
  return Object.freeze({ ...ECONOMY, ...patch });
}
