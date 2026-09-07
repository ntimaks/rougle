import { ECONOMY, type EconomyConfig, type WordLength } from './config';

/**
 * The bankroll reducer. MECHANICS.md §2.
 *
 * The v1.3 pool was a budget: it refilled every act, so running low meant
 * "this act is going badly". The bankroll is a stake — one number for the whole
 * run, no refills — so §2.2's claim is that every word now carries a signal the
 * player can read immediately. This module is where that signal is computed.
 *
 * Pure over three numbers rather than over `GameState`, deliberately. The v1.3
 * pool reducer took the whole state and had to be told which of two pools it
 * was addressing (`poolSource`), which is most of what made the Gauntlet's
 * separate pool expensive to reason about. There is one bankroll now, so the
 * reducer needs exactly the three fields that move.
 */
export interface BankrollState {
  bankroll: number;
  gold: number;
  /**
   * §2.4 — RUN-scoped. The v1.3 ladder reset every act, which is what let a
   * player buy nine emergency guesses a run and is why gold never ran out.
   */
  emergencyPurchases: number;
}

export interface BankrollEvent {
  type: 'BANKROLL_SPENT' | 'BANKROLL_GRANTED' | 'OVERFLOW_TO_GOLD' | 'PAYOUT' | 'EMERGENCY_BOUGHT';
  delta: number;
  bankroll: number;
  reason: string;
}

export interface BankrollResult {
  state: BankrollState;
  events: BankrollEvent[];
}

const none = (s: BankrollState): BankrollResult => ({ state: s, events: [] });

/**
 * §2.3 — the payout a solve earns, before clamps.
 *
 * `max(0, base − guesses)`. Never negative: a slow solve pays nothing, it does
 * not charge. The charge already happened, one guess at a time, which is the
 * whole point of the design — the loss is felt while it accrues rather than
 * announced at the end.
 */
export function basePayout(
  length: WordLength,
  guessesUsed: number,
  cfg: Readonly<EconomyConfig> = ECONOMY,
): number {
  return Math.max(0, cfg.payoutBase[length] - guessesUsed);
}

/**
 * §2.5 Clamp B — largest payout bonus only, never summed.
 *
 * Returns the winning bonus rather than the total, so a caller can name which
 * relic paid. A Gambler holding Flywheel who solves in three gets +3 (the
 * innate), not +5, and the receipt should be able to say which.
 */
export function largestBonus(bonuses: readonly { amount: number; source: string }[]): {
  amount: number;
  source: string;
} | null {
  let best: { amount: number; source: string } | null = null;
  for (const b of bonuses) {
    if (b.amount > 0 && (best === null || b.amount > best.amount)) best = b;
  }
  return best;
}

/**
 * §2.3 + §2.5 — what a solved word is actually worth to the bankroll.
 *
 * Clamp A is stated as "no word may ADD more than 5 to the bankroll", so it is
 * applied to the word's NET effect — payout plus the winning bonus, less the
 * guesses that were already spent — not to the payout in isolation. Read the
 * other way it would cap a 5-guess solve's payout at 5, which never binds and
 * would make the clamp dead text. This reading is what makes `RL.21` All In's
 * engine note ("net gain per word capped at +5") mean anything.
 */
export function payoutFor(
  length: WordLength,
  guessesUsed: number,
  bonuses: readonly { amount: number; source: string }[] = [],
  cfg: Readonly<EconomyConfig> = ECONOMY,
): { payout: number; bonus: { amount: number; source: string } | null; clamped: boolean } {
  const bonus = largestBonus(bonuses);
  const gross = basePayout(length, guessesUsed, cfg) + (bonus?.amount ?? 0);
  const ceiling = guessesUsed + cfg.maxNetGainPerWord;
  return { payout: Math.min(gross, ceiling), bonus, clamped: gross > ceiling };
}

/**
 * §2.1 — every submitted guess decrements before feedback resolves.
 *
 * Unconditional, and allowed to reach 0: reaching 0 with the word unsolved is
 * what triggers the §2.4 offer, and that decision belongs to the caller that
 * knows whether the word fell. Never goes below 0.
 */
export function spendGuess(s: BankrollState): BankrollResult {
  if (s.bankroll <= 0) return none(s);
  const next = { ...s, bankroll: s.bankroll - 1 };
  return {
    state: next,
    events: [{ type: 'BANKROLL_SPENT', delta: -1, bankroll: next.bankroll, reason: 'guess' }],
  };
}

/**
 * §2.1 — add to the bankroll, converting anything over the cap to gold.
 *
 * The conversion is immediate and automatic, so a player at 23 who earns 4 is
 * not quietly given 1 and robbed of 3 — they are given 1 and paid 30g, and both
 * events are emitted so the UI can show the second one happening.
 */
export function grant(
  s: BankrollState,
  amount: number,
  reason: string,
  cfg: Readonly<EconomyConfig> = ECONOMY,
): BankrollResult {
  if (amount <= 0) return none(s);
  const room = Math.max(0, cfg.bankrollCap - s.bankroll);
  const kept = Math.min(amount, room);
  const overflow = amount - kept;
  const events: BankrollEvent[] = [];
  let next = s;

  if (kept > 0) {
    next = { ...next, bankroll: next.bankroll + kept };
    events.push({ type: 'BANKROLL_GRANTED', delta: kept, bankroll: next.bankroll, reason });
  }
  if (overflow > 0) {
    const goldGained = overflow * cfg.overflowGoldPerGuess;
    next = { ...next, gold: next.gold + goldGained };
    events.push({
      type: 'OVERFLOW_TO_GOLD',
      delta: goldGained,
      bankroll: next.bankroll,
      reason: `${reason} (${overflow} over the cap)`,
    });
  }
  return { state: next, events };
}

/** §2.3 — grant a solved word's payout, clamps applied. */
export function applyPayout(
  s: BankrollState,
  length: WordLength,
  guessesUsed: number,
  bonuses: readonly { amount: number; source: string }[] = [],
  cfg: Readonly<EconomyConfig> = ECONOMY,
): BankrollResult & { payout: number } {
  const { payout, bonus } = payoutFor(length, guessesUsed, bonuses, cfg);
  const reason = bonus ? `payout (+${bonus.amount} ${bonus.source})` : 'payout';
  const granted = grant(s, payout, reason, cfg);
  return {
    ...granted,
    events: [
      { type: 'PAYOUT', delta: payout, bankroll: granted.state.bankroll, reason },
      ...granted.events,
    ],
    payout,
  };
}

/**
 * §2.4 — the price of the next emergency purchase, or null when the ladder is
 * spent. Escalates across the run.
 */
export function emergencyCost(
  s: BankrollState,
  cfg: Readonly<EconomyConfig> = ECONOMY,
): number | null {
  return cfg.emergencyCosts[s.emergencyPurchases] ?? null;
}

/**
 * §2.4 — buy the next rung. Returns null when the ladder is spent or the price
 * cannot be paid, so an unaffordable attempt does not consume a rung.
 */
export function buyEmergency(
  s: BankrollState,
  cfg: Readonly<EconomyConfig> = ECONOMY,
): BankrollResult | null {
  const cost = emergencyCost(s, cfg);
  if (cost === null || s.gold < cost) return null;
  const paid: BankrollState = {
    ...s,
    gold: s.gold - cost,
    emergencyPurchases: s.emergencyPurchases + 1,
  };
  const granted = grant(paid, cfg.emergencyGrant, 'emergency', cfg);
  return {
    state: granted.state,
    events: [
      {
        type: 'EMERGENCY_BOUGHT',
        delta: -cost,
        bankroll: granted.state.bankroll,
        reason: `rung ${paid.emergencyPurchases}`,
      },
      ...granted.events,
    ],
  };
}

/**
 * §2.3's break-even, for the UI and the report: the guess count at which a word
 * is neutral. Net is `base − 2 × guesses`, so it is `base / 2`.
 */
export function breakEven(length: WordLength, cfg: Readonly<EconomyConfig> = ECONOMY): number {
  return cfg.payoutBase[length] / 2;
}
