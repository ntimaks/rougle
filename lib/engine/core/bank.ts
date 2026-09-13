import type { GameEvent } from './actions';
import { CONFIG, type GameConfig } from './config';
import type { GameState } from './state';
import {
  applyPayout as applyPayoutPure,
  buyEmergency as buyEmergencyPure,
  emergencyCost as emergencyCostPure,
  grant as grantPure,
  payoutFor,
  spendGuess as spendGuessPure,
  type BankrollEvent,
  type BankrollState,
} from '../economy/bankroll';
import type { WordLength } from '../economy/config';

/**
 * The bankroll, lifted onto `GameState`. MECHANICS.md §2.
 *
 * THIS IS THE ONLY MODULE THAT MAY CHANGE `state.bankroll` (AGENTS.md
 * non-negotiable 4, which said `state.pool` until v2.0 replaced the per-act
 * pool with a run-long stake).
 *
 * The arithmetic is not here. `economy/bankroll.ts` is a pure reducer over the
 * three numbers that actually move — bankroll, gold, emergency purchases — and
 * this file is the adapter that reads them out of `GameState`, writes them
 * back, and translates `BankrollEvent` into the `GameEvent` the UI listens to.
 *
 * The split earns its keep twice. It let §2 be written and tested against the
 * spec before any of this existed, and it keeps Clamps A and B (§2.5) in one
 * pure function rather than spread across the reducer's five call sites.
 *
 * ## What went away with the pool
 *
 * v1.3's `pool.ts` was 300 lines, and roughly 200 of them were the refund
 * system: Rule A's per-word net floor, Rule B's highest-refund-only, and the
 * `pendingRefunds` queue that existed because a refund firing on guess 1 always
 * truncated to nothing. §2.5 replaces all of it with two clamps applied at
 * payout. Nothing is queued, nothing is retried, and a relic that wants to move
 * the bankroll says so with a `BANKROLL` effect.
 *
 * It also had two pools — the act's and the Gauntlet's — and every function
 * took a `poolSource` to decide which it was addressing. §8.3 deletes the
 * second one. That is most of why this file is short.
 */

export interface BankResult {
  state: GameState;
  events: GameEvent[];
}

function read(s: GameState): BankrollState {
  return { bankroll: s.bankroll, gold: s.gold, emergencyPurchases: s.emergencyPurchases };
}

function write(s: GameState, b: BankrollState, events: readonly BankrollEvent[]): BankResult {
  const goldDelta = b.gold - s.gold;
  const next: GameState = {
    ...s,
    bankroll: b.bankroll,
    gold: b.gold,
    emergencyPurchases: b.emergencyPurchases,
    stats:
      goldDelta === 0
        ? s.stats
        : {
            ...s.stats,
            goldEarned: s.stats.goldEarned + Math.max(0, goldDelta),
            goldSpent: s.stats.goldSpent + Math.max(0, -goldDelta),
          },
  };
  return { state: next, events: events.map(toGameEvent) };
}

function toGameEvent(e: BankrollEvent): GameEvent {
  return { type: 'BANKROLL_CHANGED', delta: e.delta, bankroll: e.bankroll, reason: e.reason, kind: e.type };
}

/**
 * §2.1 — every submitted guess decrements before feedback resolves.
 *
 * Unconditional, and allowed to reach 0. Reaching 0 with the word unsolved is
 * what triggers the §2.4 offer, and that decision belongs to the reducer, which
 * is the only thing that knows whether the word fell.
 */
export function spendGuess(s: GameState): BankResult {
  const r = spendGuessPure(read(s));
  const withWord = s.word
    ? { ...s, word: { ...s.word, guessesSpent: s.word.guessesSpent + 1 } }
    : s;
  const counted = {
    ...withWord,
    stats: { ...withWord.stats, guessesSpent: withWord.stats.guessesSpent + 1 },
  };
  return write(counted, r.state, r.events);
}

/**
 * §2.1 — add to the bankroll, converting anything over the cap to gold.
 *
 * The one entry point for every grant that is not a payout: emergency rungs,
 * boss clears, shop refills, `CN.03` The Decanter, `RL.15` Bloodhound, an
 * event's gift. A negative amount is a cost, not a grant, and goes through
 * `charge`.
 */
export function grant(
  s: GameState,
  amount: number,
  reason: string,
  cfg: Readonly<GameConfig> = CONFIG,
): BankResult {
  const r = grantPure(read(s), amount, reason, cfg.economy);
  return write(s, r.state, r.events);
}

/**
 * A bankroll COST that is not a guess: `RL.09` The Anvil's -2 at run start,
 * `RL.31` Rosetta's payout penalty when it drives a payout below zero, an
 * event's price.
 *
 * Floors at 0 rather than going negative. A charge that empties the bankroll
 * outside a word does not trigger §2.4 — the offer is defined at "bankroll
 * reaches 0 with the current word unsolved" — so the reducer checks for death
 * where it can act on it, and this function only moves the number.
 */
export function charge(s: GameState, amount: number, reason: string): BankResult {
  if (amount <= 0) return { state: s, events: [] };
  const taken = Math.min(amount, s.bankroll);
  if (taken === 0) return { state: s, events: [] };
  const next = { ...s, bankroll: s.bankroll - taken };
  return {
    state: next,
    events: [
      {
        type: 'BANKROLL_CHANGED',
        delta: -taken,
        bankroll: next.bankroll,
        reason,
        kind: 'BANKROLL_SPENT',
      },
    ],
  };
}

/**
 * §2.3 + §2.5 — pay a solved word, clamps applied.
 *
 * `guessesUsed` is passed rather than read off the word because `RL.13` Opening
 * Gambit computes the payout "as though you used one fewer guess" without
 * refunding anything, so the number the formula sees and the number the
 * bankroll spent are deliberately allowed to differ.
 */
export function applyPayout(
  s: GameState,
  length: WordLength,
  guessesUsed: number,
  bonuses: readonly { amount: number; source: string }[] = [],
  cfg: Readonly<GameConfig> = CONFIG,
): BankResult & { payout: number } {
  const r = applyPayoutPure(read(s), length, guessesUsed, bonuses, cfg.economy);
  const counted = {
    ...s,
    stats: { ...s.stats, payoutsGranted: s.stats.payoutsGranted + r.payout },
  };
  return { ...write(counted, r.state, r.events), payout: r.payout };
}

/** §2.3 — what a solve is worth, without granting it. For the UI and the solver. */
export { payoutFor };

/** §2.4 — the price of the next rung, or null when the ladder is spent. */
export function emergencyCost(s: GameState, cfg: Readonly<GameConfig> = CONFIG): number | null {
  return emergencyCostPure(read(s), cfg.economy);
}

/** §2.4 — buy the next rung. null when it is unaffordable or the ladder is spent. */
export function buyEmergency(s: GameState, cfg: Readonly<GameConfig> = CONFIG): BankResult | null {
  const r = buyEmergencyPure(read(s), cfg.economy);
  if (r === null) return null;
  const counted = {
    ...s,
    stats: { ...s.stats, emergencyPurchases: s.stats.emergencyPurchases + 1 },
  };
  return write(counted, r.state, r.events);
}

/**
 * §4.1 / §6.7 B — the price of the next guess refill, or null when the run's
 * ladder is spent. R-046: the shop and the forge sell off the SAME ladder.
 *
 * `stats.refillsBought` is the index, so it is the run cap and the price at
 * once, and neither shop can be cheaper than the other by construction. When
 * they were priced separately — 40g rising at the shop, a flat 20g uncapped at
 * the forge — switching the forge on took a relic-less run from 34.3% to 63.5%,
 * because the cheaper of two shops selling the same thing is the only one
 * anybody uses.
 */
export function refillCost(s: GameState, cfg: Readonly<GameConfig> = CONFIG): number | null {
  return cfg.economy.refillCosts[s.stats.refillsBought] ?? null;
}

/**
 * §4.1 — buy one rung of the refill ladder. null when it is unaffordable, off
 * the end of the ladder, or the bankroll is already at the §2.1 cap.
 *
 * Refusing at the cap rather than selling a rung that overflows straight back
 * to gold: at 10g a guess the overflow would return an eighth of a 80g rung,
 * which is a trap rather than a trade.
 */
export function buyRefill(s: GameState, cfg: Readonly<GameConfig> = CONFIG): BankResult | null {
  const cost = refillCost(s, cfg);
  if (cost === null || s.gold < cost) return null;
  if (s.bankroll >= cfg.economy.bankrollCap) return null;
  const paid: GameState = {
    ...s,
    gold: s.gold - cost,
    stats: {
      ...s.stats,
      goldSpent: s.stats.goldSpent + cost,
      refillsBought: s.stats.refillsBought + 1,
    },
  };
  return grant(paid, 1, 'refill', cfg);
}
