import type { GameEvent } from './actions';
import { CONFIG, type GameConfig } from './config';
import type { Effect } from './effects';
import type { GameState } from './state';

/**
 * The pool reducer. Technical brief §3, MECHANICS.md §2.4.
 *
 * THIS IS THE ONLY MODULE THAT MAY CHANGE `state.pool` OR `state.poolMax`
 * (AGENTS.md non-negotiable 4). The refund floor lives here, once, rather than
 * in individual relics — that is what makes it composable and testable.
 *
 * Deviation from the brief's sketch: `spendGuess` takes the refund effects
 * rather than calling `collectRefunds(state)` itself. pool.ts must not import
 * the hook system (the hook system already applies effects, so the dependency
 * would be circular), and passing them in makes the "collected on this event"
 * scope of Rule B explicit at the call site instead of implicit in a helper.
 */

export type RefundEffect = Extract<Effect, { kind: 'REFUND' }>;

export interface PoolResult {
  state: GameState;
  events: GameEvent[];
}

/** Rule B — highest refund only, never summed. */
export function highestRefund(refunds: readonly RefundEffect[]): RefundEffect | null {
  let best: RefundEffect | null = null;
  for (const r of refunds) {
    if (r.amount > 0 && (best === null || r.amount > best.amount)) best = r;
  }
  return best;
}

/**
 * Rule A — a word costs at least `minNetGuessesPerWord` net of all refunds,
 * cumulative across the word. Truncates the refund; never goes below zero.
 */
export function grantableRefund(
  grossSpentThisWord: number,
  alreadyRefundedThisWord: number,
  candidate: number,
  cfg: Readonly<GameConfig> = CONFIG,
): number {
  const netAfter = grossSpentThisWord - alreadyRefundedThisWord - candidate;
  if (netAfter >= cfg.minNetGuessesPerWord) return candidate;
  return Math.max(0, candidate - (cfg.minNetGuessesPerWord - netAfter));
}

/**
 * Every guess: decrement first, then resolve all refunds together.
 *
 * Rule C is why the decrement is unconditional. RL.13 Opening Gambit's "free"
 * guess is a refund, so the pool visibly ticks down and back up — a balance
 * requirement (it goes through the floor) and a legibility one (the design's
 * GUESS COST FLOAT fires on onGuessSubmit regardless).
 *
 * Order within one spend:
 *   1. decrement
 *   2. Rule B — the single largest refund that triggered on THIS event
 *   3. Rule A — truncate it against the word's running net; queue any remainder
 *   4. retry refunds queued by earlier events of the same word
 */
export function spendGuess(
  s: GameState,
  refunds: readonly RefundEffect[] = [],
  cfg: Readonly<GameConfig> = CONFIG,
): PoolResult {
  if (!s.word) throw new Error('spendGuess called with no word in progress');

  const events: GameEvent[] = [];
  const usesGauntletPool = s.word.poolSource === 'GAUNTLET' && s.gauntlet !== null;

  let next: GameState = usesGauntletPool
    ? { ...s, gauntlet: { ...s.gauntlet!, pool: s.gauntlet!.pool - 1 } }
    : { ...s, pool: s.pool - 1 };

  next = {
    ...next,
    word: { ...next.word!, netGuessesSpent: next.word!.netGuessesSpent + 1 },
    stats: { ...next.stats, guessesSpent: next.stats.guessesSpent + 1 },
  };
  events.push({ type: 'POOL_CHANGED', delta: -1, pool: currentPool(next), reason: 'guess' });

  // Rule B: the losers of this event are discarded, not queued. They did not
  // "apply", and queueing them would let two relics stack across turns, which
  // is the composition Rule B exists to forbid.
  const best = highestRefund(refunds);
  if (best) {
    const offered = offerRefund(next, best.amount, best.source, cfg);
    next = offered.state;
    events.push(...offered.events);
  }

  const drained = drainPendingRefunds(next, cfg);
  next = drained.state;
  events.push(...drained.events);

  return { state: next, events };
}

/**
 * Offers a refund to the floor: grants what Rule A allows now and queues the
 * rest against the rest of the word. Every refund source goes through here.
 *
 * The queue is the fix for a hole in the brief's §3 sketch. Truncating greedily
 * at the moment of the refund means a refund that fires on guess 1 can never be
 * granted (gross 1, net after refund 0, below the floor of 1), so RL.13 Opening
 * Gambit — whose entire rule is "your first guess is refunded" — never refunds
 * anything, and neither does RL.19 The Moth, which pays at word start. Rule A
 * is stated per word, not per guess; carrying the shortfall forward enforces it
 * on the word's total while leaving both relics alive. Provisional: ADR-0005,
 * raised as §13 I-16.
 */
export function offerRefund(
  s: GameState,
  amount: number,
  source: string,
  cfg: Readonly<GameConfig> = CONFIG,
): PoolResult {
  if (amount <= 0 || !s.word) return { state: s, events: [] };

  const granted = grantableRefund(
    s.word.netGuessesSpent,
    s.word.refundsAppliedThisWord,
    amount,
    cfg,
  );
  const applied = granted > 0 ? applyRefund(s, granted, source) : { state: s, events: [] };
  const remainder = amount - granted;
  if (remainder <= 0) return applied;

  const withQueue: GameState = {
    ...applied.state,
    word: {
      ...applied.state.word!,
      pendingRefunds: [...applied.state.word!.pendingRefunds, { amount: remainder, source }],
    },
  };
  return { state: withQueue, events: applied.events };
}

/** Retries queued refunds against the word's current net. FIFO. */
export function drainPendingRefunds(
  s: GameState,
  cfg: Readonly<GameConfig> = CONFIG,
): PoolResult {
  if (!s.word || s.word.pendingRefunds.length === 0) return { state: s, events: [] };

  const events: GameEvent[] = [];
  let next = s;
  const stillPending: Array<{ amount: number; source: string }> = [];

  for (const p of s.word.pendingRefunds) {
    const granted = grantableRefund(
      next.word!.netGuessesSpent,
      next.word!.refundsAppliedThisWord,
      p.amount,
      cfg,
    );
    if (granted > 0) {
      const applied = applyRefund(next, granted, p.source);
      next = applied.state;
      events.push(...applied.events);
    }
    if (p.amount - granted > 0) stillPending.push({ amount: p.amount - granted, source: p.source });
  }

  next = { ...next, word: { ...next.word!, pendingRefunds: stillPending } };
  return { state: next, events };
}

/**
 * Grants an already-floored refund. Only `offerRefund` and `drainPendingRefunds`
 * call this; it enforces the poolMax ceiling and nothing else, because the §2.4
 * floor has already been applied by the time a refund reaches it.
 */
export function applyRefund(s: GameState, amount: number, source: string): PoolResult {
  if (amount <= 0) return { state: s, events: [] };
  if (!s.word) return addPool(s, amount, `refund:${source}`);

  const usesGauntletPool = s.word.poolSource === 'GAUNTLET' && s.gauntlet !== null;
  const ceiling = usesGauntletPool ? CONFIG.gauntlet.pool : s.poolMax;
  const before = currentPool(s);
  const after = Math.min(ceiling, before + amount);
  const delta = after - before;
  if (delta <= 0) return { state: s, events: [] };

  const next: GameState = {
    ...(usesGauntletPool
      ? { ...s, gauntlet: { ...s.gauntlet!, pool: after } }
      : { ...s, pool: after }),
    word: { ...s.word, refundsAppliedThisWord: s.word.refundsAppliedThisWord + delta },
    stats: { ...s.stats, refundsGranted: s.stats.refundsGranted + delta },
  };

  return {
    state: next,
    events: [{ type: 'REFUND_GRANTED', amount: delta, source, pool: currentPool(next) }],
  };
}

/**
 * A plain pool delta: emergency purchases, CN.03 The Decanter, act refill.
 * Never used for refunds — a POOL delta bypasses the §2.4 floor.
 * Gains are clamped to poolMax ("does not raise the cap"); losses are not
 * clamped here because pool reaching 0 is a legal, load-bearing state.
 */
export function addPool(s: GameState, delta: number, reason: string): PoolResult {
  const usesGauntletPool = s.word?.poolSource === 'GAUNTLET' && s.gauntlet !== null;
  const ceiling = usesGauntletPool ? CONFIG.gauntlet.pool : s.poolMax;
  const before = currentPool(s);
  const after = delta > 0 ? Math.min(ceiling, before + delta) : before + delta;
  const applied = after - before;
  if (applied === 0) return { state: s, events: [] };

  const next: GameState = usesGauntletPool
    ? { ...s, gauntlet: { ...s.gauntlet!, pool: after } }
    : { ...s, pool: after };

  return {
    state: next,
    events: [{ type: 'POOL_CHANGED', delta: applied, pool: currentPool(next), reason }],
  };
}

/**
 * RL.31 Rosetta Slab (-3) and RL.09 The Anvil (-1) cut the act pool.
 *
 * Ruling (ADR-0004, provisional pending a MECHANICS.md §11 entry for §13 I-07):
 * applied immediately to BOTH the cap and the live pool, clamped so `pool` never
 * drops below 1. The unapplied remainder is lost rather than deferred — a debt
 * that follows you into the next act is invisible at the moment you take the
 * relic, which is exactly when the player needs to understand the cost.
 *
 * The live pool has to move or the cut is free: there is no refill left in the
 * act you took the relic in, so cutting only the cap costs nothing until the
 * act ends. That is also why I-07 flags this as able to kill at low pool.
 */
export function addPoolMax(s: GameState, delta: number, reason: string): PoolResult {
  const events: GameEvent[] = [];
  const poolMax = Math.max(1, s.poolMax + delta);
  const appliedMax = poolMax - s.poolMax;
  if (appliedMax === 0) return { state: s, events };

  // A pool already at 0 stays at 0 (you are in the emergency branch, not alive
  // with one guess). Anything at 1 or above floors at 1.
  const floor = Math.min(s.pool, 1);
  const pool =
    appliedMax < 0
      ? Math.max(floor, Math.min(s.pool + appliedMax, poolMax))
      : Math.min(s.pool, poolMax);

  const next: GameState = { ...s, poolMax, pool };
  events.push({ type: 'POOL_MAX_CHANGED', delta: appliedMax, poolMax, reason });
  if (pool !== s.pool) {
    events.push({ type: 'POOL_CHANGED', delta: pool - s.pool, pool, reason });
  }
  return { state: next, events };
}

/** Whichever pool the current word draws from. MECHANICS.md §7.3. */
export function currentPool(s: GameState): number {
  return s.word?.poolSource === 'GAUNTLET' && s.gauntlet ? s.gauntlet.pool : s.pool;
}

/**
 * Refills the act pool at act start. The only place poolMax is set from scratch.
 *
 * No carry parameter: RL.27 The Vault ("up to 10 leftover guesses carry into the
 * next act ... does not raise the act cap") cannot be implemented without a
 * ruling, because a pool that refills to its cap has no room for a carry. See
 * §13 I-15 in docs/decisions/ADR-0006. The Vault is not implemented.
 */
export function refillPool(s: GameState, poolMax: number, reason: string): PoolResult {
  const next: GameState = { ...s, poolMax, pool: poolMax };
  return {
    state: next,
    events: [
      { type: 'POOL_MAX_CHANGED', delta: poolMax - s.poolMax, poolMax, reason },
      { type: 'POOL_CHANGED', delta: next.pool - s.pool, pool: next.pool, reason },
    ],
  };
}
