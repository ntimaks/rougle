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
  /** §6.2 — pick which of the five a sixth relic destroys. */
  | 'REPLACE'
  | 'SHOP'
  | 'FORGE'
  | 'EVENT'
  | 'BOSS_INTRO'
  | 'EMERGENCY'
  | 'DEATH'
  | 'VICTORY';

export type DeathCause =
  | 'BANKROLL_EXHAUSTED'
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
  /**
   * MK.II applied at a Forge (§6.7). Per instance, not per code: it is a thing
   * that happened to this relic in this run, and it has to survive save/load
   * and Ouroboros' act restart like any other run state.
   */
  upgraded: boolean;
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
  /**
   * Letters KNOWN about a solution: §2.5 bought reveals, and Rosetta / Hot
   * Streak / Skeleton Key applied at onWordStart (MECHANICS §4.5).
   *
   * `solutionIndex` is which solution the letter is true of. It exists because
   * §7.2 makes the two Mirror results fully independent, and a fact drawn from
   * solution A is not a fact about solution B (R-036).
   */
  presetTiles: Array<{ index: number; letter: string; solutionIndex: number }>;
  /**
   * Locked Key + The Moth. Never a solution letter (R-003). Source-tagged so
   * CN.02 The Poultice can clear the modifier's lock without clearing the
   * relic's — clearing "every modifier" must not disarm a relic.
   */
  lockedLetters: Array<{ letter: string; source: string }>;
  liarIndex: number | null;
  /** RL.28 Shaved Coin re-rolls this. null when nothing lies. */
  truthMask: boolean[] | null;
  /**
   * Guesses spent on this word. The §2.3 payout formula's `guesses_used`, and
   * the trigger every payout relic reads.
   *
   * v1.3 called this `netGuessesSpent` and it was net of refunds, because the
   * §2.4 floor needed a running net to truncate against. There are no refunds
   * under §2.5, so it is simply the count.
   */
  guessesSpent: number;
  /** Deferral depth in effect: 0 none, 1 Fog, 3 Cipher. */
  deferralDepth: number;
  /**
   * Reveals granted before the first guess.
   *
   * v1.3 capped these at two and sold further ones on a price ladder. v2.0 cuts
   * the ladder (§12.1) and §6.2 says the cap "becomes unnecessary and is
   * removed" at five slots — five slots is itself the cap on how much
   * information a board can hold.
   */
  revealed: {
    vowelCount: number | null;
    hasRepeat: boolean | null;
    sharedLetter: string | null;
    /** RL.07 / CH.03 / RL.26 answers, accumulated during the word. */
    letters: Array<{ letter: string; present: boolean }>;
  };
  nodeId: NodeId;
  /**
   * §2.5 Clamp A is stated per WORD, and `RL.13` Opening Gambit changes the
   * guess count the payout is computed from without refunding a guess. Both
   * need the payout to be derived at solve time from stored facts rather than
   * accumulated as it goes, so nothing else about the word is bookkeeping.
   */
  wagered: number | null;
}

export interface ShopStockItem {
  code: string;
  price: number;
  sold: boolean;
}

export interface ShopState {
  /** The solve node whose clear opened it. §4: a shop is not a map node. */
  nodeId: NodeId;
  stock: ShopStockItem[];
  /** §4.2 — 20g, +10g per reroll WITHIN this shop. Resets with the shop. */
  rerolls: number;
  /** §4.1 — one refill per shop, off the run-long ladder in `stats`. */
  refillsSold: number;
}

export interface ForgeState {
  nodeId: NodeId;
  /** Decremented per operation. RL.09 The Anvil starts it at 2. */
  operationsLeft: number;
  /** Codes upgraded here, so the screen can show what it did. */
  upgraded: string[];
  /**
   * The relics THIS forge will work on: instance ids, drawn on entry (R-035).
   * A forge used to offer everything upgradeable you held, which made the node
   * strictly better the more relics you carried and left branch B with nothing
   * to compete against. It is a draw now, like the shop's shelf and the reward
   * screen's three offers.
   */
  candidates: string[];
}

export interface EventState {
  nodeId: NodeId;
  code: string;
}

export interface PendingChallenge {
  /** Guesses the next word must fall within. null means "just clear it". */
  limit: number | null;
  source: string;
  onSuccess: unknown[];
  onFailure: unknown[];
}

export interface MapNode {
  id: NodeId;
  kind: NodeKind;
  /**
   * Which act generated this node. A word's boss, its deferral and its name
   * were all looked up as `BOSSES[state.actIndex]`, which is only correct while
   * the map and the act counter agree — and a screenshot of the Act II Twins
   * labelled THE CIPHER, running the Cipher's 3-turn deferral over a Mirror
   * word, is what happens when they do not. The node knows what it is.
   */
  actIndex: 0 | 1 | 2;
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

/**
 * §3.3 — the boss's choice of 1 of 2 boss relics, and nothing else.
 *
 * v1.3 also used this for the three free relics every word node handed out.
 * §4 makes relics bought rather than granted, so a boss clear is the only
 * offer left in the game — and the only way a BOSS relic enters a run, since
 * shops do not stock them.
 */
export interface Offer {
  kind: 'RELIC' | 'CONSUMABLE';
  codes: string[];
  sourceNodeId: NodeId;
  /** Whether declining is allowed. §3.3: for boss relics it is. */
  forced: boolean;
}

export interface RunStats {
  guessesSpent: number;
  /** §2.3 payout, run total. The mirror of `guessesSpent`; together, the bleed. */
  payoutsGranted: number;
  wordsSolved: number;
  wordsFailed: number;
  guessesPerWord: number[];
  goldEarned: number;
  goldSpent: number;
  emergencyPurchases: number;
  /** §4.1 — how many rungs of the shared refill ladder the run has bought. */
  refillsBought: number;
  /** §11.5 — the acquisition curve is a balance number now. */
  relicsBought: number;
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
  /**
   * §2.1 — ONE number for the whole run. No refills, no act reset, no second
   * pool for the Gauntlet. It is the health bar, the clock and the score at
   * once, which is why every screen shows it and why `bank.ts` is the only
   * module allowed to move it.
   */
  bankroll: number;
  gold: number;
  /** §2.4 — RUN-scoped, not per act. Three rungs, then no valve at all. */
  emergencyPurchases: number;
  /** Acquisition order. Load-bearing for hook order and §6.3 suppression. */
  relics: RelicInstance[];
  consumables: ConsumableInstance[]; // cap CONFIG.consumableSlots
  map: MapState;
  word: WordState | null;
  /** §8.3 — five words back to back. The separate pool is gone; the index is not. */
  gauntlet: { wordIndex: number } | null;
  pendingOffer: Offer | null;
  /** Stock for the SHOP node being stood in. Rolled on entry, discarded on leaving. */
  shop: ShopState | null;
  /** The FORGE node being stood in. RL.09 The Anvil makes `operationsLeft` 2. */
  forge: ForgeState | null;
  /** The EVENT node being stood in (MECHANICS §6.8). */
  event: EventState | null;
  /**
   * Events already drawn this run. §6.8 draws without replacement, so an event
   * seen once cannot recur — which is what makes twelve enough.
   */
  seenEvents: string[];
  /**
   * An event's `word_challenge`, waiting for the next word to resolve against.
   * It has to survive the map screen between the event node and the word, which
   * is why it lives on run state rather than on the word.
   */
  pendingChallenge: PendingChallenge | null;
  /**
   * §6.2 — a relic acquired at a full board, held while the player names which
   * of the five it destroys. The incoming relic is visible alongside the five
   * held, so it has to exist somewhere before it is owned.
   */
  pendingReplace: { code: RelicCode } | null;
  /**
   * EV.08 The Undertaker. A one-shot revival at bankroll zero. Resolves AFTER
   * the §2.4 emergency offer, so a player who can pay gold still pays gold
   * first and keeps the revival.
   */
  revivalBankroll: number | null;
  /** `RL.30` Ouroboros (§6.1 `onBankrollChange`). One return per run. */
  ouroborosSpent: boolean;
  /**
   * Every solution the run has served, so a run never repeats a word. Also the
   * input to RL.03 Palimpsest, which compares against the previous solution.
   */
  usedSolutions: string[];
  /** Ad-hoc counters. Also the source of RNG indices where none is natural. */
  counters: Record<string, number>;
  stats: RunStats;
  /** Terminal outcome, set with phase DEATH or VICTORY. */
  outcome: { result: 'WIN' | 'DEATH'; cause: DeathCause | null } | null;
}

/**
 * 4 — the v2.0 bankroll. A v3 save describes a per-act pool with no bankroll in
 * it, and there is no honest conversion (what is 11-of-14 in Act II worth as a
 * run-long stake?), so `local.ts` discards rather than migrates.
 */
export const SAVE_VERSION = 4;

export function emptyStats(): RunStats {
  return {
    guessesSpent: 0,
    payoutsGranted: 0,
    wordsSolved: 0,
    wordsFailed: 0,
    guessesPerWord: [],
    goldEarned: 0,
    goldSpent: 0,
    emergencyPurchases: 0,
    refillsBought: 0,
    relicsBought: 0,
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
