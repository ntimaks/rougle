import type { GameConfig } from '../core/config';
import type { Effect } from '../core/effects';
import type { FeedbackResult } from '../feedback/types';
import type {
  CharacterCode,
  GameState,
  RelicInstance,
  WordState,
} from '../core/state';

/**
 * MECHANICS.md §6.1, verbatim. No additions.
 *
 * v1.3 carried four more — `onActStart`, `onActEnd`, `onNodeLeave` and
 * `onWordFailed` — and v2.0 removed the reason for each. There is no act-end
 * conversion and `RL.30` Ouroboros moved to `onBankrollChange`, so the two act
 * hooks have no subscriber; `onNodeLeave` existed for `RL.16` The Pilgrim,
 * which is retired; and §2.3 makes failing a word end the run, so there is
 * nothing to hook after it.
 */
export const HOOK_NAMES = [
  'onRunStart',
  'onNodeEnter',
  'onWordStart',
  'onGuessSubmit',
  'onFeedbackTransform',
  'onWordSolved',
  /** §6.1 — new in v2.0, and where every payout-modifying relic attaches. */
  'onPayout',
  /** §4 — the shop that opens after a solve node. `RL.22` Polyglot reads it. */
  'onShopOpen',
  'onGoldChange',
  'onBankrollChange',
  'onUse',
] as const;

export type HookName = (typeof HOOK_NAMES)[number];

export interface HookPayloads {
  onRunStart: Record<string, never>;
  onNodeEnter: { nodeId: string; kind: string };
  onWordStart: { nodeId: string; solutions: string[]; previousSolution: string | null };
  onGuessSubmit: { guess: string; turn: number; newUniqueLetters: number };
  onFeedbackTransform: Record<string, never>;
  /** Fires before `onPayout`, so a relic may pay gold and bid on the payout. */
  onWordSolved: { nodeId: string; guessesUsed: number; length: number; kind: string };
  /**
   * §2.3 — the payout is about to be computed. A handler returns `PAYOUT_BONUS`
   * (subject to Clamp B) or `PAYOUT_DISCOUNT`, never a `BANKROLL` grant: a
   * grant would bypass both clamps, which is exactly what §2.5 forbids.
   *
   * `openerUniqueLetters` is on the payload because `RL.13` Opening Gambit
   * gates on it and it is a fact about a guess that has long since resolved.
   */
  onPayout: {
    guessesUsed: number;
    length: number;
    openerUniqueLetters: number;
  };
  /** §4 — a shop is rolling its stock. `RL.22` Polyglot raises the tier. */
  onShopOpen: { nodeId: string; afterLength: number; afterKind: string };
  onGoldChange: { delta: number; gold: number };
  onBankrollChange: { delta: number; bankroll: number };
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
  transform_order?: number;
  anti_synergy?: string[];
  anti_synergy_reason?: string;
  synergy?: string[];
  /** §2.5 Clamp B — a declared payout bonus and what triggers it. */
  payout_bonus?: { amount: number; trigger: string };
  /** §6.5 — the run-long counter, for the six relics that carry one. */
  scaling?: {
    counter: string;
    increments_on?: string;
    resets_on?: string;
    starts_at?: number;
    effect: string;
    cap?: number;
  };
  /** §6.5 — measured worth in bankroll per word over a 20-word run. */
  value_note?: string;
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
  /** §9 — the character's starting bankroll, not a delta. */
  bankroll_start: number;
  innate: string;
  payout_bonus?: { amount: number; trigger: string };
  engine_note?: string;
  hook?: HookName;
  activation?: ActivationDef;
}
