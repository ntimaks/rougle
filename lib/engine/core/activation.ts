import { activationFor } from '../content/registry';
import type { ActivationDef } from '../content/types';
import type { EngineError } from './actions';
import { currentPool } from './pool';
import type { GameState, RelicInstance } from './state';

/**
 * Player-activated relics. MECHANICS.md §13 I-04, ruled in R-013.
 *
 * Five relics are things the player *does* — name a letter, wager guesses, opt
 * out of feedback — rather than reactions to an event. `onUse` already had the
 * right shape; `relics.json` scoped it to consumables. It is now open to relics
 * that declare an `activation` block, and this module owns every rule about
 * when one may fire, so no relic needs a special case in the reducer.
 *
 * Per-word bookkeeping lives in `RelicInstance.state`, keyed by node id, for
 * the same reason: it is the generic mechanism relics already use, and it
 * survives save/load without WordState growing a field per relic.
 */

/** How many times this instance has fired on the current word. */
export function usesThisWord(relic: RelicInstance, nodeId: string): number {
  return relic.state['activationNodeId'] === nodeId
    ? Number(relic.state['activationUses'] ?? 0)
    : 0;
}

/** The patch that records one more use. Relics return this from their handler. */
export function recordUse(relic: RelicInstance, nodeId: string): Record<string, unknown> {
  return { activationNodeId: nodeId, activationUses: usesThisWord(relic, nodeId) + 1 };
}

export interface ActivationCheck {
  def: ActivationDef;
  error: EngineError | null;
}

/**
 * Is this activation legal right now? Returns the definition either way so the
 * caller can charge the cost without looking it up twice.
 */
export function checkActivation(s: GameState, holder: RelicInstance): ActivationCheck | null {
  const def = activationFor(holder.code);
  if (!def) return null;

  const word = s.word;
  const fail = (code: EngineError['code'], message: string): ActivationCheck => ({
    def,
    error: { code, message },
  });

  if (!word || s.phase !== 'WORD') {
    return fail('WRONG_PHASE', `${holder.code} can only be used during a word.`);
  }
  if (def.timing === 'BEFORE_FIRST_GUESS' && word.history.length > 0) {
    return fail('WRONG_PHASE', `${holder.code} must be used before the first guess.`);
  }
  if (def.usesPerWord !== null && usesThisWord(holder, word.nodeId) >= def.usesPerWord) {
    return fail('EMERGENCY_EXHAUSTED', `${holder.code} is spent for this word.`);
  }
  if (def.cost.gold !== undefined && s.gold < def.cost.gold) {
    return fail('UNAFFORDABLE', `${holder.code} costs ${def.cost.gold}g.`);
  }
  // A guess cost may not take the last guess: spending into an empty pool would
  // be a death caused by an optional action, which the emergency ladder exists
  // to prevent (MECHANICS.md §2.3).
  if (def.cost.guesses !== undefined && currentPool(s) <= def.cost.guesses) {
    return fail('UNAFFORDABLE', `${holder.code} costs ${def.cost.guesses} guess.`);
  }
  return { def, error: null };
}

/** Blindfold arms the next guess. Read by the chain's suppression step. */
export function isBlindfolded(s: GameState, nodeId: string, turn: number): boolean {
  const relic = s.relics.find((r) => r.code === 'RL.20');
  if (!relic) return false;
  return relic.state['blindNodeId'] === nodeId && relic.state['blindTurn'] === turn;
}
