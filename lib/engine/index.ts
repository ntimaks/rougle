/**
 * The engine's public API — the ONLY module `/components` may import.
 *
 * Everything below this line is pure TypeScript: no React, no Next, no DOM, no
 * Math.random, no Date.now. `npx tsx sim/harness.ts` runs it with the Next
 * server stopped, and CI runs that with no build step, which is the check that
 * actually proves the boundary (technical brief §1.3).
 *
 * If a component needs to know something, add a pure selector here rather than
 * computing a rule in the view.
 */

// Rules core
export { reduce, canDispatch, initialState, emergencyCost, revealCost, revealBlocker, applyEffects, rollOffer } from './core/reducer';
export { CONFIG, withConfig, type GameConfig, type ActConfig } from './core/config';
export { serialize, deserialize, migrate, SaveError } from './core/serialize';
export { draw, drawInt, drawPick, drawShuffle, drawWeighted, formatSeed, hash32, isValidSeed, DOMAIN, SEED_LENGTH } from './core/rng';
export { spendGuess, grantableRefund, highestRefund, currentPool } from './core/pool';
export { resolveHook, resolveUse, holdersInOrder } from './core/hooks';
export { FORGE_GOLD_PER_GUESS, shopPrice, forgeOperations, optionAvailable } from './core/nodes';
export { EVENTS, EVENT_DEFS, eventsForAct, type EventDef, type EventOption } from './content/events';
export { ALPHABET, eligibleLettersForRemoval, hammingDistance, isLetterAvailable } from './core/letters';
export { checkActivation, usesThisWord, isBlindfolded } from './core/activation';

// Types
export type { Action, EngineError, EngineErrorCode, GameEvent, ReduceResult } from './core/actions';
export type { PendingChallenge, ShopState, ForgeState, EventState } from './core/state';
export type { Effect } from './core/effects';
export type {
  CharacterCode,
  ConsumableInstance,
  DeathCause,
  GameState,
  GuessRecord,
  MapNode,
  MapState,
  ModifierId,
  NodeId,
  NodeKind,
  Offer,
  RelicCode,
  RelicInstance,
  RunPhase,
  RunStats,
  WordState,
} from './core/state';
export { hasModifier, hasRelic, findRelic, SAVE_VERSION } from './core/state';

// Feedback
export { scoreBase, scoreStates, vowelCount, hasRepeat } from './feedback/scorer';
export { CHAIN, runChain, annotateDistances, legalDistances, liesAt } from './feedback/chain';
export {
  projectBoard,
  deriveKeyboard,
  deriveLocked,
  decayGreens,
  isDeferred,
  withhold,
  type BoardRow,
  type BoardView,
} from './feedback/projection';
export { activeReveals, revealAllowed, orderForSuppression } from './feedback/infoCap';
export { renderStates, type FeedbackResult, type Tile, type TileState } from './feedback/types';

// Content
export {
  REGISTRY,
  RELIC_DEFS,
  CHARACTERS,
  CHARACTER_BY_CODE,
  offerableRelics,
  offerableConsumables,
  PRE_GUESS_REVEAL_CODES,
  PENDING_IMPLEMENTATION,
  isImplemented,
  isHookName,
  isPreGuessReveal,
  isActivated,
  activationFor,
  offerableInAct,
  def,
  impl,
} from './content/registry';
export {
  HOOK_NAMES,
  type ActivationDef,
  type ActivationTiming,
  type HookName,
  type RelicDef,
  type RelicImpl,
} from './content/types';
export { MODIFIERS, availableModifiers, canStack, lengthFor, rollModifiers } from './content/modifiers';
export { BOSSES, type BossDef } from './content/bosses';

// Words
export {
  drawSolution,
  hasWordList,
  isValidGuess,
  registerWordList,
  wordList,
  type WordLength,
} from './words';
