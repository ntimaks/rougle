import type { GameConfig } from '../core/config';
import type { Effect } from '../core/effects';
import type { FeedbackResult } from '../feedback/types';
import type {
  CharacterCode,
  GameState,
  RelicInstance,
  WordState,
} from '../core/state';

/** MECHANICS.md §6.1, verbatim. No additions. */
export const HOOK_NAMES = [
  'onRunStart',
  'onActStart',
  'onNodeEnter',
  'onNodeLeave',
  'onWordStart',
  'onGuessSubmit',
  'onFeedbackTransform',
  'onWordSolved',
  'onWordFailed',
  'onActEnd',
  'onGoldChange',
  'onPoolChange',
  'onUse',
] as const;

export type HookName = (typeof HOOK_NAMES)[number];

export interface HookPayloads {
  onRunStart: Record<string, never>;
  onActStart: { actIndex: number };
  onNodeEnter: { nodeId: string; kind: string };
  /**
   * Leaving a SHOP, FORGE or EVENT. Added for RL.16 The Pilgrim, which pays for
   * passing a shop without buying — a thing that can only be known on the way
   * out. AGENTS.md: a relic that cannot name a hook means the hook list is
   * incomplete, so extend it rather than special-casing the relic.
   */
  onNodeLeave: { nodeId: string; kind: string; usedIt: boolean };
  onWordStart: { nodeId: string; solutions: string[]; previousSolution: string | null };
  onGuessSubmit: { guess: string; turn: number; newUniqueLetters: number };
  onFeedbackTransform: Record<string, never>;
  onWordSolved: { nodeId: string; guessesUsed: number };
  onWordFailed: { nodeId: string };
  onActEnd: { actIndex: number; leftover: number };
  onGoldChange: { delta: number; gold: number };
  onPoolChange: { delta: number; pool: number };
  onUse: { instanceId: string; payload: Record<string, unknown> };
}

/**
 * Handlers are PURE FUNCTIONS RETURNING EFFECT DATA, not mutating listeners.
 * Same authoring experience, but deterministic and serialisable — which is what
 * the harness needs and what makes a hook testable in three lines.
 */
export interface HookContext {
  state: Readonly<GameState>;
  self: RelicInstance;
  /** Addressed to `relic:${instanceId}:${hook}`. The caller owns the index. */
  rng: (index: number) => number;
  cfg: Readonly<GameConfig>;
}

export type HookHandler<K extends HookName> = (
  ctx: HookContext,
  payload: HookPayloads[K],
) => Effect[];

/** Context for a transform-chain step. Transforms never see the solution. */
export interface TransformContext {
  state: Readonly<GameState>;
  word: Readonly<WordState>;
  /** 0-indexed turn of the row being transformed. */
  turn: number;
  /** Which solution this result scored against, under Mirror. */
  solutionIndex: number;
  rng: (index: number) => number;
}

export type TransformFn = (ctx: TransformContext, fb: FeedbackResult) => FeedbackResult;

/**
 * One module per relic code. The JSON owns the rule; the module owns the
 * mechanism (technical brief §6).
 */
export interface RelicImpl {
  hooks?: { [K in HookName]?: HookHandler<K> };
  /** Relics whose JSON hook is onFeedbackTransform implement this instead. */
  transform?: TransformFn;
  /**
   * For relics whose mechanism IS a step of the declared transform chain rather
   * than a hook handler. Must equal the JSON's `transform_order`. The step
   * itself lives in `feedback/chain.ts`, because MECHANICS.md §4.4 fixes the
   * order centrally and registration order must never decide it.
   */
  chainStep?: number;
  /** Initial RelicInstance.state. */
  initialState?: Record<string, unknown>;
}

/**
 * When a player may fire an activation. MECHANICS.md §6.6 (R-014's companion),
 * added because five relics are things the player *does* rather than reactions
 * to an event — see §13 I-04.
 */
export type ActivationTiming =
  /** Any point in a word where input is accepted. RL.07, RL.28, CH.03. */
  | 'ANY_TIME_IN_WORD'
  /** Only before the first guess of a word. RL.21's wager. */
  | 'BEFORE_FIRST_GUESS'
  /** Arms the next guess. RL.20 Blindfold. */
  | 'BEFORE_SUBMIT';

/** What the player must supply, if anything. */
export type ActivationInput = 'UNTRIED_LETTER' | 'WAGER' | null;

export interface ActivationDef {
  timing: ActivationTiming;
  /** null = uncapped; the cost is the cap. */
  usesPerWord: number | null;
  cost: { gold?: number; guesses?: number };
  input: ActivationInput;
}

export type Rarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'BOSS' | 'CONSUMABLE';
export type Archetype = 'INFO' | 'TEMPO' | 'RISK' | 'GREED' | 'ROUTE';

/** A row of relics.json, typed. The JSON is normative; this only describes it. */
export interface RelicDef {
  code: string;
  name: string;
  archetype?: Archetype;
  rarity: Rarity;
  hook: HookName;
  rule: string;
  flavor?: string;
  pre_guess_reveal: boolean;
  transform_order?: number;
  anti_synergy?: string[];
  anti_synergy_reason?: string;
  synergy?: string[];
  refund?: { amount: number | string; trigger: string };
  ruling?: string;
  engine_note?: string;
  balance_flag?: string;
  /**
   * Present on relics the player fires rather than ones that react to an event.
   * Its presence is what makes `hook: "onUse"` legal on a non-consumable.
   */
  activation?: ActivationDef;
  /**
   * 1-indexed act from which this may be OFFERED. Not a rule about what the
   * relic does — a filter that stops the game offering something provably inert
   * (RL.28 Shaved Coin before Liar Letter exists). See R-015.
   */
  offer_from_act?: number;
  /**
   * The relic's single MK.II tier (§6.7). Every relic has exactly one; no
   * consumable has any. `axis` is which of the five kinds of change it makes,
   * recorded so the distribution can be audited rather than drifting toward
   * "a number goes up" thirty-one times.
   */
  upgrade?: {
    name: string;
    axis: 'magnitude' | 'duration' | 'reach' | 'reliability' | 'cost';
    rule: string;
    engine_note?: string;
  };
  /**
   * Proportional discount on the §2.5 reveal ladder, 0–1. Declared as data
   * rather than as a hook because a price is a query, not a state change, and
   * `Effect` is the vocabulary of state change. `revealCost` reads this from
   * every held relic, so a future discount relic needs no engine change.
   */
  reveal_discount?: number;
  /** Set by the loader: consumables live in their own array in the JSON. */
  isConsumable: boolean;
}

export interface CharacterDef {
  code: CharacterCode;
  name: string;
  archetype: Archetype;
  pool_modifier: number;
  innate: string;
  pre_guess_reveal: boolean;
  refund?: { amount: number; trigger: string };
  engine_note?: string;
  hook?: HookName;
  activation?: ActivationDef;
}
