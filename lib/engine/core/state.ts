import type { FeedbackResult } from '../feedback/types';

/** MECHANICS.md §5. Modifiers attach to words and are the difficulty curve. */
export type ModifierId =
  | 'LOCKED_KEY'
  | 'SILENT_START'
  | 'LONG_WORD'
  | 'DECAY'
  | 'FOG'
  | 'MIRROR'
  | 'LIAR_LETTER'
  | 'LONGER_WORD'
  | 'STACKED';

export type RelicCode = string;
export type ConsumableCode = string;
export type CharacterCode = 'CH.01' | 'CH.02' | 'CH.03';
export type NodeId = string;

export type NodeKind = 'WORD' | 'ELITE' | 'SHOP' | 'FORGE' | 'EVENT' | 'BOSS';

export type RunPhase =
  | 'TITLE'
  | 'CHARACTER_SELECT'
  | 'MAP'
  | 'WORD'
  | 'REWARD'
  | 'SHOP'
  | 'FORGE'
  | 'EVENT'
  | 'BOSS_INTRO'
  | 'ACT_END'
  | 'EMERGENCY'
  | 'DEATH'
  | 'VICTORY';

export type DeathCause =
  | 'POOL_EXHAUSTED'
  | 'EMERGENCY_DECLINED'
  | 'EMERGENCY_UNAFFORDABLE'
  | 'GAUNTLET'
  | 'EVENT';

export interface RelicInstance {
  instanceId: string;
  code: RelicCode;
  /** Per-relic mutable state. Written only via SET_RELIC_STATE, never in a module. */
  state: Record<string, unknown>;
  /** Monotonic acquisition ordinal. Load-bearing for hook order and §6.3. */
  acquiredAt: number;
}

export interface ConsumableInstance {
  instanceId: string;
  code: ConsumableCode;
  acquiredAt: number;
}

export interface GuessRecord {
  guess: string;
  /**
   * TRUTH: one FeedbackResult per solution, straight from the base scorer.
   * Never mutated. Corruption, distance and time effects are applied downstream
   * in projectBoard from deterministic inputs stored on WordState.
   */
  raw: FeedbackResult[];
  /** 0-indexed turn within the word. */
  turn: number;
}

export interface WordState {
  solutions: string[]; // 1, or 2 under Mirror/Twins
  solved: boolean[];
  length: 5 | 6 | 7;
  modifiers: ModifierId[];
  history: GuessRecord[];
  /** Rosetta / Hot Streak / Skeleton Key. Applied at onWordStart (MECHANICS §4.5). */
  presetTiles: Array<{ index: number; letter: string }>;
  /**
   * Locked Key + The Moth. Never a solution letter (R-003). Source-tagged so
   * CN.02 The Poultice can clear the modifier's lock without clearing the
   * relic's — clearing "every modifier" must not disarm a relic.
   */
  lockedLetters: Array<{ letter: string; source: string }>;
  liarIndex: number | null;
  /** RL.28 Shaved Coin re-rolls this. null when nothing lies. */
  truthMask: boolean[] | null;
  /** For the §2.4 Rule A floor. Per word, cumulative. */
  netGuessesSpent: number;
  /** Refund already granted this word, so Rule A can truncate correctly. */
  refundsAppliedThisWord: number;
  /**
   * Refunds that Rule A could not grant yet, retried on each later spend of the
   * same word and dropped when the word ends. See ADR-0005 / §13 I-16: without
   * this, a refund that fires on guess 1 is always truncated to nothing, which
   * silently kills RL.13 Opening Gambit and RL.19 The Moth outright.
   */
  pendingRefunds: Array<{ amount: number; source: string }>;
  /** Deferral depth in effect: 0 none, 1 Fog, 3 Cipher. */
  deferralDepth: number;
  /** Reveals granted before the first guess, after the §6.3 cap. */
  revealed: {
    vowelCount: number | null;
    hasRepeat: boolean | null;
    sharedLetter: string | null;
    /** RL.07 / CH.03 / RL.26 answers, accumulated during the word. */
    letters: Array<{ letter: string; present: boolean }>;
  };
  nodeId: NodeId;
  /** Which pool this word draws from. The Gauntlet uses its own (MECHANICS §7.3). */
  poolSource: 'ACT' | 'GAUNTLET';
}

export interface MapNode {
  id: NodeId;
  kind: NodeKind;
  row: number;
  col: number;
  next: NodeId[];
  modifiers: ModifierId[];
  visited: boolean;
}

export interface MapState {
  nodes: Record<NodeId, MapNode>;
  rows: NodeId[][];
  bossId: NodeId;
  currentId: NodeId | null;
  /** Nodes reachable from the current position. Empty at act start = pick any row-1 node. */
  available: NodeId[];
  /** RL.06 Cartographer. */
  modifiersRevealed: boolean;
}

export interface Offer {
  kind: 'RELIC' | 'CONSUMABLE';
  codes: string[];
  sourceNodeId: NodeId;
  /** Boss relics are guaranteed, not chosen from three. */
  forced: boolean;
}

export interface RunStats {
  guessesSpent: number;
  refundsGranted: number;
  wordsSolved: number;
  wordsFailed: number;
  guessesPerWord: number[];
  goldEarned: number;
  goldSpent: number;
  emergencyPurchases: number;
  relicsTaken: RelicCode[];
  nodesVisited: NodeId[];
  deathNodeId: NodeId | null;
  deathCause: DeathCause | null;
  /** Word-luck attribution: the solver had the answer in its candidate set but ran out. */
  deathWithCandidatesRemaining: number | null;
}

export interface GameState {
  version: number;
  /** 8 base32 chars, no 0/O/1/I. Stamped in the chrome, held all run. */
  seed: string;
  characterCode: CharacterCode;
  phase: RunPhase;
  actIndex: 0 | 1 | 2;
  pool: number;
  /** Act base + character modifier + relic modifiers. */
  poolMax: number;
  gold: number;
  emergencyPurchasesThisAct: number;
  /** Acquisition order. Load-bearing for hook order and §6.3 suppression. */
  relics: RelicInstance[];
  consumables: ConsumableInstance[]; // cap CONFIG.consumableSlots
  map: MapState;
  word: WordState | null;
  gauntlet: { pool: number; wordIndex: number } | null;
  pendingOffer: Offer | null;
  /** Serialized state written at onActStart, for RL.30 Ouroboros. */
  actStartSnapshot: string | null;
  ouroborosSpent: boolean;
  /**
   * Every solution the run has served, so a run never repeats a word. Also the
   * input to RL.03 Palimpsest, which compares against the previous solution.
   */
  usedSolutions: string[];
  /** Ad-hoc counters. Also the source of RNG indices where none is natural. */
  counters: Record<string, number>;
  stats: RunStats;
  /**
   * The act-end receipt, held while phase is ACT_END.
   *
   * The conversion has to be legible as a TRADE, not a total: leftover guesses
   * count down while gold counts up. That needs both numbers at once, so they
   * are kept rather than folded into `gold` and forgotten.
   */
  actReceipt: { actIndex: number; leftover: number; goldGained: number; rate: number } | null;
  /** Terminal outcome, set with phase DEATH or VICTORY. */
  outcome: { result: 'WIN' | 'DEATH'; cause: DeathCause | null } | null;
}

export const SAVE_VERSION = 1;

export function emptyStats(): RunStats {
  return {
    guessesSpent: 0,
    refundsGranted: 0,
    wordsSolved: 0,
    wordsFailed: 0,
    guessesPerWord: [],
    goldEarned: 0,
    goldSpent: 0,
    emergencyPurchases: 0,
    relicsTaken: [],
    nodesVisited: [],
    deathNodeId: null,
    deathCause: null,
    deathWithCandidatesRemaining: null,
  };
}

export function emptyMap(): MapState {
  return { nodes: {}, rows: [], bossId: '', currentId: null, available: [], modifiersRevealed: false };
}

/** Does the state hold this relic? Codes are opaque keys; never sort by them. */
export function hasRelic(s: GameState, code: RelicCode): boolean {
  return s.relics.some((r) => r.code === code);
}

export function findRelic(s: GameState, code: RelicCode): RelicInstance | undefined {
  return s.relics.find((r) => r.code === code);
}

export function hasModifier(w: WordState | null, id: ModifierId): boolean {
  return !!w && w.modifiers.includes(id);
}
