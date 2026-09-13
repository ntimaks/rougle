import type { GameEvent } from './actions';
import { CONFIG } from './config';
import type {
  ConsumableCode,
  DeathCause,
  GameState,
  ModifierId,
  RelicCode,
} from './state';

/**
 * The complete vocabulary of state change. Technical brief §2.4.
 *
 * A relic that cannot be expressed as hooks + effects means this union is
 * incomplete: extend it and record why. Never special-case a relic inside
 * `reduce` (AGENTS.md non-negotiable 6).
 */
export type Effect =
  /**
   * §2.1 — move the bankroll. A positive delta overflows to gold at the §2.1
   * cap; a negative one floors at 0.
   *
   * This replaces v1.3's three-way split of `POOL`, `POOL_MAX` and `REFUND`.
   * There is no cap to raise, so `POOL_MAX` has nothing to address, and §2.5
   * replaced the refund floor with two clamps applied at payout — so a refund
   * is no longer a distinct kind of grant that has to bypass anything.
   */
  | { kind: 'BANKROLL'; delta: number; reason: string }
  /**
   * §2.5 Clamp B — offer a payout bonus for the word being solved. Collected,
   * not applied: only the largest offered bonus survives the clamp, so a relic
   * states its bid and `bank.applyPayout` decides.
   */
  | { kind: 'PAYOUT_BONUS'; amount: number; source: string }
  /**
   * `RL.13` Opening Gambit — compute the payout as though this many fewer
   * guesses were used. NOT a bankroll grant: the guesses were spent and the
   * bankroll already ticked down for them.
   */
  | { kind: 'PAYOUT_DISCOUNT'; guesses: number; source: string }
  | { kind: 'GOLD'; delta: number; reason: string }
  | { kind: 'PRESET_TILE'; index?: number; letter?: string }
  | { kind: 'LOCK_LETTER'; letter?: string; source: string }
  | { kind: 'REVEAL_META'; field: 'vowelCount' | 'hasRepeat' | 'sharedLetter' }
  | { kind: 'REVEAL_LETTER'; letter: string }
  | { kind: 'GRANT_RELIC'; code: RelicCode }
  | { kind: 'GRANT_CONSUMABLE'; code: ConsumableCode }
  | { kind: 'CONSUME'; instanceId: string }
  | { kind: 'SET_RELIC_STATE'; instanceId: string; patch: Record<string, unknown> }
  | { kind: 'SET_COUNTER'; key: string; value: number }
  | { kind: 'REROLL_TRUTH_MASK' }
  | { kind: 'CLEAR_MODIFIERS' }
  | { kind: 'REVEAL_MAP_MODIFIERS' }
  | { kind: 'FORGE_OPS'; delta: number }
  | { kind: 'SET_DEFERRAL'; depth: number }
  | { kind: 'ADD_MODIFIER'; id: ModifierId }
  | { kind: 'END_RUN'; outcome: 'WIN' | 'DEATH'; cause: DeathCause };

export interface EffectContext {
  /** Re-entry depth for BANKROLL/GOLD effects that fire onBankrollChange/onGoldChange. */
  depth: number;
  /** Hook re-entry, injected by the reducer so effects.ts does not import hooks.ts. */
  reenter?: (state: GameState, effect: Effect, depth: number) => Effect[];
}

export class EffectDepthError extends Error {
  constructor(depth: number) {
    super(
      `Effect recursion exceeded ${CONFIG.maxEffectDepth} (reached ${depth}). ` +
        'A relic pair is feeding itself through onBankrollChange/onGoldChange.',
    );
    this.name = 'EffectDepthError';
  }
}

export interface ApplyResult {
  state: GameState;
  events: GameEvent[];
}
