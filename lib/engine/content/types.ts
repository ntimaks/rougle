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
}
