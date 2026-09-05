import type { CharacterCode, ConsumableCode, GameState, NodeId, RelicCode } from './state';

/**
 * Everything a player (or the harness) can do. `reduce` is total over this
 * union: an action that is illegal in the current phase returns the state
 * unchanged plus an EngineError, and never throws.
 */
export type Action =
  | { type: 'START_RUN'; seed: string; characterCode: CharacterCode }
  | { type: 'SELECT_NODE'; nodeId: NodeId }
  | { type: 'SUBMIT_GUESS'; guess: string }
  | { type: 'USE_ITEM'; instanceId: string; payload?: Record<string, unknown> }
  | { type: 'ACCEPT_OFFER'; code: string }
  | { type: 'SKIP_OFFER' }
  | { type: 'BUY_EMERGENCY' }
  | { type: 'DECLINE_EMERGENCY' }
  | { type: 'ADVANCE' }
  | { type: 'ABANDON_RUN' };

export type EngineErrorCode =
  | 'WRONG_PHASE'
  | 'NOT_A_WORD'
  | 'WRONG_LENGTH'
  | 'LETTER_LOCKED'
  | 'NO_SUCH_NODE'
  | 'NODE_UNREACHABLE'
  | 'NO_SUCH_ITEM'
  | 'NO_OFFER'
  | 'NOT_IN_OFFER'
  | 'UNAFFORDABLE'
  | 'EMERGENCY_EXHAUSTED'
  | 'INVENTORY_FULL'
  | 'RUN_OVER';

export interface EngineError {
  code: EngineErrorCode;
  message: string;
}

/**
 * Narration for the UI to animate. GameEvent never carries rules: replaying
 * events must never be needed to reconstruct state, which is already correct
 * when reduce returns. A batch is drained atomically so co-ordinated frames
 * (Tin Cup's +5g on the pool-tick frame) land together.
 */
export type GameEvent =
  | { type: 'RUN_STARTED'; seed: string; characterCode: CharacterCode }
  | { type: 'ACT_STARTED'; actIndex: number; pool: number }
  | { type: 'NODE_ENTERED'; nodeId: NodeId }
  | { type: 'WORD_STARTED'; nodeId: NodeId; length: number; modifiers: string[] }
  | { type: 'GUESS_SUBMITTED'; guess: string; turn: number }
  | { type: 'POOL_CHANGED'; delta: number; pool: number; reason: string }
  | { type: 'REFUND_GRANTED'; amount: number; source: string; pool: number }
  | { type: 'POOL_MAX_CHANGED'; delta: number; poolMax: number; reason: string }
  | { type: 'GOLD_CHANGED'; delta: number; gold: number; reason: string }
  | { type: 'FEEDBACK_READY'; turn: number }
  | { type: 'WORD_SOLVED'; nodeId: NodeId; guessesUsed: number }
  | { type: 'WORD_FAILED'; nodeId: NodeId }
  | { type: 'RELIC_GRANTED'; code: RelicCode }
  | { type: 'RELIC_SUPPRESSED'; instanceId: string }
  | { type: 'CONSUMABLE_GRANTED'; code: ConsumableCode }
  | { type: 'CONSUMABLE_USED'; code: ConsumableCode }
  | { type: 'LETTER_LOCKED'; letter: string; source: string }
  | { type: 'TILE_PRESET'; index: number }
  | { type: 'META_REVEALED'; field: string }
  | { type: 'MODIFIERS_CLEARED' }
  | { type: 'EMERGENCY_OFFERED'; cost: number; affordable: boolean }
  | { type: 'EMERGENCY_BOUGHT'; cost: number }
  | { type: 'ACT_ENDED'; actIndex: number; leftover: number; goldGained: number }
  | { type: 'OUROBOROS_TRIGGERED'; actIndex: number }
  | { type: 'RUN_ENDED'; outcome: 'WIN' | 'DEATH'; cause: string | null };

export interface ReduceResult {
  state: GameState;
  events: GameEvent[];
  error?: EngineError;
}
