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
  | { kind: 'POOL'; delta: number; reason: string }
  /** NOT 'POOL'. Refunds are subject to the §2.4 floor; a POOL delta bypasses it. */
  | { kind: 'REFUND'; amount: number; source: string }
  | { kind: 'GOLD'; delta: number; reason: string }
  | { kind: 'POOL_MAX'; delta: number; reason: string }
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
  /** Re-entry depth for POOL/GOLD effects that fire onPoolChange/onGoldChange. */
  depth: number;
  /** Hook re-entry, injected by the reducer so effects.ts does not import hooks.ts. */
  reenter?: (state: GameState, effect: Effect, depth: number) => Effect[];
}

export class EffectDepthError extends Error {
  constructor(depth: number) {
    super(
      `Effect recursion exceeded ${CONFIG.maxEffectDepth} (reached ${depth}). ` +
        'A relic pair is feeding itself through onPoolChange/onGoldChange.',
    );
    this.name = 'EffectDepthError';
  }
}

export interface ApplyResult {
  state: GameState;
  events: GameEvent[];
}
