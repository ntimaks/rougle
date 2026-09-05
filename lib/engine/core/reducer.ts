import { BOSSES } from '../content/bosses';
import { lengthFor } from '../content/modifiers';
import {
  CHARACTER_BY_CODE,
  OFFERABLE_RELICS,
  REGISTRY,
  impl as implFor,
  isImplemented,
} from '../content/registry';
import { annotateDistances } from '../feedback/chain';
import { activeReveals } from '../feedback/infoCap';
import { projectBoard } from '../feedback/projection';
import { hasRepeat, scoreBase, vowelCount } from '../feedback/scorer';
import { generateLinearAct } from '../map/generate';
import { drawSolution, hasWordList, isValidGuess, type WordLength } from '../words';
import type { Action, EngineError, GameEvent, ReduceResult } from './actions';
import { CONFIG, type GameConfig } from './config';
import type { Effect } from './effects';
import { EffectDepthError } from './effects';
import { resolveHook, resolveUse } from './hooks';
import { ALPHABET, eligibleLettersForRemoval, isLetterAvailable } from './letters';
import { addPool, addPoolMax, currentPool, offerRefund, refillPool, spendGuess } from './pool';
import { DOMAIN, draw, drawInt, drawWeighted } from './rng';
import {
  SAVE_VERSION,
  emptyMap,
  emptyStats,
  type CharacterCode,
  type GameState,
  type ModifierId,
  type NodeId,
  type RelicInstance,
  type WordState,
} from './state';
import { hasRelic } from './state';

/**
 * The one pure function. Technical brief §2.1.
 *
 * Every change — a guess, a purchase, a relic firing, a death — comes through
 * here. The UI never computes a rule; the harness never touches the UI; save is
 * `JSON.stringify(state)`.
 *
 * `events` is narration only. Replaying events must never be needed to
 * reconstruct state: state is already correct when `reduce` returns. The UI
 * drains a batch atomically, which is what makes the design's frame-ordering
 * requirements implementable — Tin Cup's +5g lands on the same frame as the
 * pool decrement because both events are in one batch.
 */
export function reduce(
  state: GameState,
  action: Action,
  cfg: Readonly<GameConfig> = CONFIG,
): ReduceResult {
  const guard = canDispatch(state, action, cfg);
  if (guard) return { state, events: [], error: guard };

  switch (action.type) {
    case 'START_RUN':
      return startRun(action.seed, action.characterCode, cfg);
    case 'SUBMIT_GUESS':
      return submitGuess(state, action.guess, cfg);
    case 'SELECT_NODE':
      return enterNode(state, action.nodeId, cfg);
    case 'ACCEPT_OFFER':
      return acceptOffer(state, action.code, cfg);
    case 'SKIP_OFFER':
      return advance({ ...state, pendingOffer: null }, [], cfg);
    case 'USE_ITEM':
      return applyItemUse(state, action.instanceId, action.payload ?? {}, cfg);
    case 'BUY_EMERGENCY':
      return buyEmergency(state, cfg);
    case 'DECLINE_EMERGENCY':
      return die(state, 'EMERGENCY_DECLINED', cfg);
    case 'ADVANCE':
      return advance(state, [], cfg);
    case 'ABANDON_RUN':
      return die(state, 'POOL_EXHAUSTED', cfg);
  }
}

/**
 * Legality. Returns an error rather than throwing, so an out-of-order action
 * from a mis-wired UI or a fuzzing harness is a no-op with a reason.
 */
export function canDispatch(
  s: GameState,
  action: Action,
  cfg: Readonly<GameConfig> = CONFIG,
): EngineError | null {
  const wrongPhase = (want: string): EngineError => ({
    code: 'WRONG_PHASE',
    message: `${action.type} is not legal in phase ${s.phase} (expected ${want})`,
  });

  if (action.type === 'START_RUN') return null;
  if (s.phase === 'DEATH' || s.phase === 'VICTORY') {
    return { code: 'RUN_OVER', message: 'The run is over.' };
  }

  switch (action.type) {
    case 'SUBMIT_GUESS': {
      if (s.phase !== 'WORD' || !s.word) return wrongPhase('WORD');
      const guess = action.guess.toUpperCase();
      if (guess.length !== s.word.length) {
        return { code: 'WRONG_LENGTH', message: `Need ${s.word.length} letters.` };
      }
      if (!hasWordList(s.word.length) || !isValidGuess(guess, s.word.length)) {
        return { code: 'NOT_A_WORD', message: `${guess} is not in the word list.` };
      }
      // Only project the board when something can actually lock a letter. The
      // check runs on every submitted guess and the harness submits millions of
      // them; projecting an unlockable board is pure cost.
      const canLock = s.word.lockedLetters.length > 0 || hasRelic(s, 'RL.02');
      if (canLock) {
        const provenGrey = new Set(projectBoard(s, s.word).provenGrey);
        for (const letter of new Set(guess)) {
          if (!isLetterAvailable(s, s.word, letter, provenGrey)) {
            return { code: 'LETTER_LOCKED', message: `${letter} is locked this word.` };
          }
        }
      }
      return null;
    }
    case 'SELECT_NODE':
      if (s.phase !== 'MAP') return wrongPhase('MAP');
      if (!s.map.nodes[action.nodeId]) {
        return { code: 'NO_SUCH_NODE', message: `No node ${action.nodeId}.` };
      }
      if (!s.map.available.includes(action.nodeId)) {
        return { code: 'NODE_UNREACHABLE', message: `${action.nodeId} is not reachable from here.` };
      }
      return null;
    case 'ACCEPT_OFFER':
      if (!s.pendingOffer) return { code: 'NO_OFFER', message: 'Nothing is on offer.' };
      if (!s.pendingOffer.codes.includes(action.code)) {
        return { code: 'NOT_IN_OFFER', message: `${action.code} is not one of the three.` };
      }
      if (
        s.pendingOffer.kind === 'CONSUMABLE' &&
        s.consumables.length >= cfg.consumableSlots
      ) {
        return { code: 'INVENTORY_FULL', message: `Consumables are capped at ${cfg.consumableSlots}.` };
      }
      return null;
    case 'SKIP_OFFER':
      if (!s.pendingOffer) return { code: 'NO_OFFER', message: 'Nothing to skip.' };
      return null;
    case 'USE_ITEM': {
      const held = [...s.relics, ...s.consumables].some((i) => i.instanceId === action.instanceId);
      if (!held) return { code: 'NO_SUCH_ITEM', message: `Not holding ${action.instanceId}.` };
      return null;
    }
    case 'BUY_EMERGENCY': {
      if (s.phase !== 'EMERGENCY') return wrongPhase('EMERGENCY');
      const cost = emergencyCost(s, cfg);
      if (cost === null) {
        return { code: 'EMERGENCY_EXHAUSTED', message: 'No emergency guesses remain this act.' };
      }
      if (s.gold < cost) return { code: 'UNAFFORDABLE', message: `${cost}g needed.` };
      return null;
    }
    case 'DECLINE_EMERGENCY':
      if (s.phase !== 'EMERGENCY') return wrongPhase('EMERGENCY');
      return null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------- run start

export function initialState(seed: string, characterCode: CharacterCode): GameState {
  return {
    version: SAVE_VERSION,
    seed,
    characterCode,
    phase: 'TITLE',
    actIndex: 0,
    pool: 0,
    poolMax: 0,
    gold: 0,
    emergencyPurchasesThisAct: 0,
    relics: [],
    consumables: [],
    map: emptyMap(),
    word: null,
    gauntlet: null,
    pendingOffer: null,
    actStartSnapshot: null,
    ouroborosSpent: false,
    usedSolutions: [],
    counters: {},
    stats: emptyStats(),
    outcome: null,
  };
}

function startRun(
  seed: string,
  characterCode: CharacterCode,
  cfg: Readonly<GameConfig>,
): ReduceResult {
  const character = CHARACTER_BY_CODE[characterCode];
  if (!character) {
    return {
      state: initialState(seed, characterCode),
      events: [],
      error: { code: 'NO_SUCH_ITEM', message: `Unknown character ${characterCode}.` },
    };
  }
  if (!isImplemented(characterCode)) {
    return {
      state: initialState(seed, characterCode),
      events: [],
      error: {
        code: 'NO_SUCH_ITEM',
        message: `${characterCode}'s innate is not implemented yet — see impl/index.ts.`,
      },
    };
  }

  let s = initialState(seed, characterCode);
  // The innate is a hidden registry entry: granted at run start, never offered,
  // never occupying a drawer slot.
  s = { ...s, relics: [instantiate(characterCode, 0)] };

  const events: GameEvent[] = [{ type: 'RUN_STARTED', seed, characterCode }];
  const runStart = applyEffects(s, resolveHook(s, 'onRunStart', {}, cfg), cfg);
  s = runStart.state;
  events.push(...runStart.events);

  const act = startAct(s, 0, cfg);
  return { state: act.state, events: [...events, ...act.events] };
}

function startAct(s: GameState, actIndex: 0 | 1 | 2, cfg: Readonly<GameConfig>): ReduceResult {
  const character = CHARACTER_BY_CODE[s.characterCode]!;
  const poolMax = Math.max(1, cfg.acts[actIndex].pool + character.pool_modifier);

  let next: GameState = {
    ...s,
    actIndex,
    emergencyPurchasesThisAct: 0,
    gauntlet: null,
    word: null,
    pendingOffer: null,
    map: generateLinearAct(s.seed, actIndex, cfg),
    phase: 'MAP',
  };

  const filled = refillPool(next, poolMax, `act ${actIndex + 1} start`);
  next = filled.state;
  const events: GameEvent[] = [
    { type: 'ACT_STARTED', actIndex, pool: next.pool },
    ...filled.events,
  ];

  const hooked = applyEffects(next, resolveHook(next, 'onActStart', { actIndex }, cfg), cfg);
  next = hooked.state;
  events.push(...hooked.events);

  // RL.30 Ouroboros restores from here. Written after onActStart so a restored
  // act replays its own start effects rather than double-applying them.
  next = { ...next, actStartSnapshot: JSON.stringify({ ...next, actStartSnapshot: null }) };

  return { state: next, events };
}

function instantiate(code: string, acquiredAt: number): RelicInstance {
  return {
    instanceId: `${code}#${acquiredAt}`,
    code,
    state: relicInitialState(code),
    acquiredAt,
  };
}

function relicInitialState(code: string): Record<string, unknown> {
  return { ...(implFor(code)?.initialState ?? {}) };
}

// ------------------------------------------------------------------- nodes

function enterNode(s: GameState, nodeId: NodeId, cfg: Readonly<GameConfig>): ReduceResult {
  const node = s.map.nodes[nodeId]!;
  let next: GameState = {
    ...s,
    map: {
      ...s.map,
      currentId: nodeId,
      available: [],
      nodes: { ...s.map.nodes, [nodeId]: { ...node, visited: true } },
    },
    stats: { ...s.stats, nodesVisited: [...s.stats.nodesVisited, nodeId] },
  };
  const events: GameEvent[] = [{ type: 'NODE_ENTERED', nodeId }];

  const hooked = applyEffects(
    next,
    resolveHook(next, 'onNodeEnter', { nodeId, kind: node.kind }, cfg),
    cfg,
  );
  next = hooked.state;
  events.push(...hooked.events);

  if (node.kind === 'BOSS' && BOSSES[next.actIndex].ownPool !== null) {
    next = { ...next, gauntlet: { pool: BOSSES[next.actIndex].ownPool!, wordIndex: 0 } };
  }

  const started = startWord(next, nodeId, cfg);
  return { state: started.state, events: [...events, ...started.events] };
}

// -------------------------------------------------------------------- word

function startWord(s: GameState, nodeId: NodeId, cfg: Readonly<GameConfig>): ReduceResult {
  const node = s.map.nodes[nodeId]!;
  const isBoss = node.kind === 'BOSS';
  const boss = BOSSES[s.actIndex];
  const modifiers: ModifierId[] = [...node.modifiers];
  const baseLength = cfg.acts[s.actIndex].wordLength;
  const length: WordLength = isBoss
    ? boss.ownPool !== null
      ? cfg.gauntlet.wordLength
      : baseLength
    : lengthFor(baseLength, modifiers);

  if (!hasWordList(length)) {
    throw new Error(
      `Act ${s.actIndex + 1} needs the ${length}-letter list. Import lib/engine/words/all.ts.`,
    );
  }

  const used = new Set(s.usedSolutions);
  const wordIndex = s.gauntlet?.wordIndex ?? 0;
  const domain = DOMAIN.word(`${nodeId}:${wordIndex}`);
  const solutions = [drawSolution(s.seed, domain, length, used)];
  if (modifiers.includes('MIRROR')) {
    solutions.push(drawSolution(s.seed, `${domain}:b`, length, new Set([...used, solutions[0]!])));
  }

  const deferralDepth = isBoss && boss.deferralDepth > 0
    ? boss.deferralDepth
    : modifiers.includes('FOG')
      ? 1
      : 0;

  const liarIndex = modifiers.includes('LIAR_LETTER')
    ? drawInt(s.seed, DOMAIN.liar(nodeId), 0, length)
    : null;

  const word: WordState = {
    solutions,
    solved: solutions.map(() => false),
    length,
    modifiers,
    history: [],
    presetTiles: [],
    lockedLetters: [],
    liarIndex,
    truthMask: null,
    netGuessesSpent: 0,
    refundsAppliedThisWord: 0,
    pendingRefunds: [],
    deferralDepth,
    revealed: { vowelCount: null, hasRepeat: null, sharedLetter: null, letters: [] },
    nodeId,
    poolSource: s.gauntlet ? 'GAUNTLET' : 'ACT',
  };

  let next: GameState = {
    ...s,
    phase: 'WORD',
    word,
    usedSolutions: [...s.usedSolutions, ...solutions],
  };
  const events: GameEvent[] = [
    { type: 'WORD_STARTED', nodeId, length, modifiers: [...modifiers] },
  ];

  // MECHANICS.md §5: the Locked Key modifier never takes a solution letter.
  if (modifiers.includes('LOCKED_KEY')) {
    const locked = drawLockedLetter(next, 'MOD:LOCKED_KEY');
    if (locked) {
      next = withWord(next, (w) => ({ ...w, lockedLetters: [...w.lockedLetters, locked] }));
      events.push({ type: 'LETTER_LOCKED', letter: locked.letter, source: locked.source });
    }
  }

  // §6.3: suppressed pre-guess reveals do not fire at all. Suppression is
  // per-word, so it is evaluated here rather than cached.
  const suppressed = new Set(activeReveals(next, cfg).suppressed);
  for (const id of suppressed) events.push({ type: 'RELIC_SUPPRESSED', instanceId: id });

  const payload = {
    nodeId,
    solutions: [...solutions],
    previousSolution: lastSolution(s),
  };
  const effects = resolveHook(next, 'onWordStart', payload, cfg).filter(
    (_e, i) => !isSuppressedEffect(next, 'onWordStart', payload, i, suppressed, cfg),
  );
  const hooked = applyEffects(next, effects, cfg);
  next = hooked.state;
  events.push(...hooked.events);

  return { state: next, events };
}

/**
 * Which effects came from a suppressed holder. Recomputing per holder is
 * cheaper to read than threading provenance through every handler, and this
 * runs once per word rather than once per guess.
 */
function isSuppressedEffect(
  s: GameState,
  hook: 'onWordStart',
  payload: { nodeId: string; solutions: string[]; previousSolution: string | null },
  index: number,
  suppressed: ReadonlySet<string>,
  cfg: Readonly<GameConfig>,
): boolean {
  if (suppressed.size === 0) return false;
  let cursor = 0;
  for (const holder of [...s.relics, ...s.consumables].sort((a, b) => a.acquiredAt - b.acquiredAt)) {
    const produced = resolveHookFor(s, holder.instanceId, hook, payload, cfg);
    if (index < cursor + produced) {
      return suppressed.has(holder.instanceId) && REGISTRY[holder.code]?.pre_guess_reveal === true;
    }
    cursor += produced;
  }
  return false;
}

function resolveHookFor(
  s: GameState,
  instanceId: string,
  hook: 'onWordStart',
  payload: { nodeId: string; solutions: string[]; previousSolution: string | null },
  cfg: Readonly<GameConfig>,
): number {
  const single: GameState = {
    ...s,
    relics: s.relics.filter((r) => r.instanceId === instanceId),
    consumables: s.consumables.filter((c) => c.instanceId === instanceId),
  };
  return resolveHook(single, hook, payload, cfg).length;
}

function submitGuess(s: GameState, raw: string, cfg: Readonly<GameConfig>): ReduceResult {
  const guess = raw.toUpperCase();
  const word = s.word!;
  const turn = word.history.length;
  const events: GameEvent[] = [{ type: 'GUESS_SUBMITTED', guess, turn }];

  const scored = word.solutions.map((solution) =>
    annotateDistances(scoreBase(guess, solution), solution),
  );

  let next = withWord(s, (w) => ({
    ...w,
    history: [...w.history, { guess, raw: scored, turn }],
  }));

  const usedBefore = new Set(word.history.flatMap((h) => [...h.guess]));
  const newUnique = new Set([...guess].filter((c) => !usedBefore.has(c))).size;

  const hookEffects = resolveHook(
    next,
    'onGuessSubmit',
    { guess, turn, newUniqueLetters: newUnique },
    cfg,
  );
  const refunds = hookEffects.filter((e) => e.kind === 'REFUND');
  const others = hookEffects.filter((e) => e.kind !== 'REFUND');

  const spent = spendGuess(next, refunds, cfg);
  next = spent.state;
  events.push(...spent.events);

  const applied = applyEffects(next, others, cfg);
  next = applied.state;
  events.push(...applied.events);

  events.push({ type: 'FEEDBACK_READY', turn });

  const solvedNow = next.word!.solutions.map(
    (solution, i) => next.word!.solved[i] || solution === guess,
  );
  next = withWord(next, (w) => ({ ...w, solved: solvedNow }));

  if (solvedNow.every(Boolean)) return finishWord(next, true, events, cfg);
  if (currentPool(next) <= 0) return offerEmergency(next, events, cfg);
  return { state: next, events };
}

function finishWord(
  s: GameState,
  solved: boolean,
  events: GameEvent[],
  cfg: Readonly<GameConfig>,
): ReduceResult {
  const word = s.word!;
  const guessesUsed = word.history.length;
  let next = s;

  if (solved) {
    events.push({ type: 'WORD_SOLVED', nodeId: word.nodeId, guessesUsed });
    next = {
      ...next,
      stats: {
        ...next.stats,
        wordsSolved: next.stats.wordsSolved + 1,
        guessesPerWord: [...next.stats.guessesPerWord, guessesUsed],
      },
    };
    const hooked = applyEffects(
      next,
      resolveHook(next, 'onWordSolved', { nodeId: word.nodeId, guessesUsed }, cfg),
      cfg,
    );
    next = hooked.state;
    events.push(...hooked.events);
  } else {
    events.push({ type: 'WORD_FAILED', nodeId: word.nodeId });
    next = { ...next, stats: { ...next.stats, wordsFailed: next.stats.wordsFailed + 1 } };
    const hooked = applyEffects(
      next,
      resolveHook(next, 'onWordFailed', { nodeId: word.nodeId }, cfg),
      cfg,
    );
    next = hooked.state;
    events.push(...hooked.events);
  }

  // Pending refunds are per word (Rule A is per word) and are dropped here.
  next = { ...next, word: null };

  const node = next.map.nodes[word.nodeId]!;
  const isBoss = node.kind === 'BOSS';

  // The Gauntlet: five words back to back, no shop, forge or reward between.
  if (isBoss && next.gauntlet && next.gauntlet.wordIndex + 1 < cfg.gauntlet.words) {
    const advanced: GameState = {
      ...next,
      gauntlet: { ...next.gauntlet, wordIndex: next.gauntlet.wordIndex + 1 },
    };
    const nextWord = startWord(advanced, word.nodeId, cfg);
    return { state: nextWord.state, events: [...events, ...nextWord.events] };
  }

  const reward = grantNodeReward(next, node.kind, word.nodeId, cfg);
  next = reward.state;
  events.push(...reward.events);

  return { state: next, events };
}

// ------------------------------------------------------------------ rewards

function grantNodeReward(
  s: GameState,
  kind: string,
  nodeId: NodeId,
  cfg: Readonly<GameConfig>,
): ReduceResult {
  const events: GameEvent[] = [];
  let next = s;

  const gold =
    kind === 'BOSS'
      ? cfg.rewards.boss
      : kind === 'ELITE'
        ? cfg.rewards.elite
        : cfg.rewards.word[0] +
          drawInt(s.seed, DOMAIN.offer(nodeId), 99, cfg.rewards.word[1] - cfg.rewards.word[0] + 1);

  const golded = applyEffects(next, [{ kind: 'GOLD', delta: gold, reason: `${kind} reward` }], cfg);
  next = golded.state;
  events.push(...golded.events);

  const codes = rollOffer(next, nodeId, cfg);
  if (codes.length > 0) {
    next = {
      ...next,
      phase: 'REWARD',
      pendingOffer: { kind: 'RELIC', codes, sourceNodeId: nodeId, forced: false },
    };
  } else {
    const advanced = advance(next, events, cfg);
    return advanced;
  }

  return { state: next, events };
}

/**
 * Three relics, weighted by MECHANICS.md §6.4 so offers bias toward archetypes
 * the player already holds, with a 0.25 floor so pivoting stays possible.
 * Without weighting, players accumulate anti-synergistic piles.
 */
export function rollOffer(s: GameState, nodeId: NodeId, cfg: Readonly<GameConfig>): string[] {
  const held = s.relics.filter((r) => REGISTRY[r.code]).map((r) => REGISTRY[r.code]!);
  const available = OFFERABLE_RELICS.filter(
    (d) => !d.isConsumable && !s.relics.some((r) => r.code === d.code),
  );
  if (available.length === 0) return [];

  const archetypeWeight = (archetype: string | undefined): number => {
    if (!archetype || held.length === 0) return 1;
    const inArchetype = held.filter((h) => h.archetype === archetype).length;
    return cfg.shopArchetypeFloor + (1 - cfg.shopArchetypeFloor) * (inArchetype / held.length);
  };

  const picked: string[] = [];
  let pool = available;
  for (let slot = 0; slot < 3 && pool.length > 0; slot++) {
    const chosen = drawWeighted(
      s.seed,
      DOMAIN.offer(nodeId),
      slot,
      pool,
      pool.map((d) => archetypeWeight(d.archetype)),
    );
    picked.push(chosen.code);
    pool = pool.filter((d) => d.code !== chosen.code);
  }
  return picked;
}

function acceptOffer(s: GameState, code: string, cfg: Readonly<GameConfig>): ReduceResult {
  const offer = s.pendingOffer!;
  const effect: Effect =
    offer.kind === 'CONSUMABLE'
      ? { kind: 'GRANT_CONSUMABLE', code }
      : { kind: 'GRANT_RELIC', code };
  const granted = applyEffects({ ...s, pendingOffer: null }, [effect], cfg);
  return advance(granted.state, granted.events, cfg);
}

// ------------------------------------------------------------- progression

function advance(s: GameState, events: GameEvent[], cfg: Readonly<GameConfig>): ReduceResult {
  if (s.pendingOffer) return { state: { ...s, phase: 'REWARD' }, events };

  const current = s.map.currentId ? s.map.nodes[s.map.currentId] : null;
  const nextIds = current ? current.next : s.map.available;

  if (nextIds.length > 0) {
    return { state: { ...s, phase: 'MAP', map: { ...s.map, available: nextIds } }, events };
  }
  return endAct(s, events, cfg);
}

function endAct(s: GameState, events: GameEvent[], cfg: Readonly<GameConfig>): ReduceResult {
  const leftover = s.pool;
  let next = s;

  const hooked = applyEffects(
    next,
    resolveHook(next, 'onActEnd', { actIndex: next.actIndex, leftover }, cfg),
    cfg,
  );
  next = hooked.state;
  const out = [...events, ...hooked.events];

  const gold = leftover * cfg.goldPerLeftoverGuess;
  const golded = applyEffects(next, [{ kind: 'GOLD', delta: gold, reason: 'leftover guesses' }], cfg);
  next = golded.state;
  out.push(...golded.events);
  out.push({ type: 'ACT_ENDED', actIndex: next.actIndex, leftover, goldGained: gold });

  if (next.actIndex === 2) {
    return {
      state: { ...next, phase: 'VICTORY', outcome: { result: 'WIN', cause: null } },
      events: [...out, { type: 'RUN_ENDED', outcome: 'WIN', cause: null }],
    };
  }

  const started = startAct(next, (next.actIndex + 1) as 0 | 1 | 2, cfg);
  return { state: started.state, events: [...out, ...started.events] };
}

// ------------------------------------------------------- emergency and death

export function emergencyCost(s: GameState, cfg: Readonly<GameConfig>): number | null {
  return cfg.emergencyCosts[s.emergencyPurchasesThisAct] ?? null;
}

/**
 * MECHANICS.md §2.3: the offer is mandatory, not optional UI. The player must
 * always see the out they did or did not buy — including when they cannot
 * afford it, which is a different death from declining one they could.
 */
function offerEmergency(
  s: GameState,
  events: GameEvent[],
  cfg: Readonly<GameConfig>,
): ReduceResult {
  // The Gauntlet's pool is fixed and separate; there is no emergency ladder
  // inside it, so running it dry is simply death (MECHANICS.md §7.3).
  if (s.word?.poolSource === 'GAUNTLET') return die(s, 'GAUNTLET', cfg, events);

  const cost = emergencyCost(s, cfg);
  if (cost === null) return die(s, 'POOL_EXHAUSTED', cfg, events);

  const affordable = s.gold >= cost;
  const out = [...events, { type: 'EMERGENCY_OFFERED' as const, cost, affordable }];
  if (!affordable) return die(s, 'EMERGENCY_UNAFFORDABLE', cfg, out);

  return { state: { ...s, phase: 'EMERGENCY' }, events: out };
}

function buyEmergency(s: GameState, cfg: Readonly<GameConfig>): ReduceResult {
  const cost = emergencyCost(s, cfg)!;
  let next: GameState = {
    ...s,
    emergencyPurchasesThisAct: s.emergencyPurchasesThisAct + 1,
    stats: { ...s.stats, emergencyPurchases: s.stats.emergencyPurchases + 1 },
  };
  const events: GameEvent[] = [{ type: 'EMERGENCY_BOUGHT', cost }];

  const paid = applyEffects(next, [{ kind: 'GOLD', delta: -cost, reason: 'emergency guess' }], cfg);
  next = paid.state;
  events.push(...paid.events);

  const pooled = addPool(next, 1, 'emergency guess');
  next = pooled.state;
  events.push(...pooled.events);

  return { state: { ...next, phase: 'WORD' }, events };
}

function die(
  s: GameState,
  cause: GameState['stats']['deathCause'] & string,
  _cfg: Readonly<GameConfig>,
  events: GameEvent[] = [],
): ReduceResult {
  const nodeId = s.word?.nodeId ?? s.map.currentId ?? null;
  return {
    state: {
      ...s,
      phase: 'DEATH',
      outcome: { result: 'DEATH', cause },
      stats: { ...s.stats, deathCause: cause, deathNodeId: nodeId },
    },
    events: [...events, { type: 'RUN_ENDED', outcome: 'DEATH', cause }],
  };
}

// ------------------------------------------------------------------- items

function applyItemUse(
  s: GameState,
  instanceId: string,
  payload: Record<string, unknown>,
  cfg: Readonly<GameConfig>,
): ReduceResult {
  const effects = resolveUse(s, instanceId, payload, cfg);
  if (!effects) {
    return {
      state: s,
      events: [],
      error: { code: 'NO_SUCH_ITEM', message: `${instanceId} has no onUse handler.` },
    };
  }
  const code = [...s.relics, ...s.consumables].find((i) => i.instanceId === instanceId)!.code;
  const applied = applyEffects(s, effects, cfg);
  return {
    state: applied.state,
    events: [{ type: 'CONSUMABLE_USED', code }, ...applied.events],
  };
}

// ----------------------------------------------------------------- effects

/**
 * The only writer of state fields. Technical brief §2.4.
 *
 * POOL and GOLD effects re-enter the hook system for onPoolChange /
 * onGoldChange with a depth guard: two relics that each react to the other's
 * change would otherwise loop forever, and a loop in the harness is a hang
 * rather than a stack trace.
 */
export function applyEffects(
  s: GameState,
  effects: readonly Effect[],
  cfg: Readonly<GameConfig> = CONFIG,
  depth = 0,
): { state: GameState; events: GameEvent[] } {
  if (depth > cfg.maxEffectDepth) throw new EffectDepthError(depth);

  let next = s;
  const events: GameEvent[] = [];
  for (const effect of effects) {
    const result = applyEffect(next, effect, cfg, depth);
    next = result.state;
    events.push(...result.events);
  }
  return { state: next, events };
}

function applyEffect(
  s: GameState,
  effect: Effect,
  cfg: Readonly<GameConfig>,
  depth: number,
): { state: GameState; events: GameEvent[] } {
  switch (effect.kind) {
    case 'POOL': {
      const pooled = addPool(s, effect.delta, effect.reason);
      if (pooled.events.length === 0) return pooled;
      const reactions = applyEffects(
        pooled.state,
        resolveHook(pooled.state, 'onPoolChange', { delta: effect.delta, pool: currentPool(pooled.state) }, cfg),
        cfg,
        depth + 1,
      );
      return { state: reactions.state, events: [...pooled.events, ...reactions.events] };
    }

    case 'REFUND': {
      const refunded = offerRefund(s, effect.amount, effect.source, cfg);
      return refunded;
    }

    case 'GOLD': {
      // R-006: gold never goes negative. A penalty larger than the purse takes
      // the purse, not a debt.
      const gold = Math.max(0, s.gold + effect.delta);
      const applied = gold - s.gold;
      if (applied === 0) return { state: s, events: [] };
      const next: GameState = {
        ...s,
        gold,
        stats: {
          ...s.stats,
          goldEarned: s.stats.goldEarned + Math.max(0, applied),
          goldSpent: s.stats.goldSpent + Math.max(0, -applied),
        },
      };
      const reactions = applyEffects(
        next,
        resolveHook(next, 'onGoldChange', { delta: applied, gold }, cfg),
        cfg,
        depth + 1,
      );
      return {
        state: reactions.state,
        events: [
          { type: 'GOLD_CHANGED', delta: applied, gold, reason: effect.reason },
          ...reactions.events,
        ],
      };
    }

    case 'POOL_MAX':
      return addPoolMax(s, effect.delta, effect.reason);

    case 'PRESET_TILE': {
      if (!s.word) return { state: s, events: [] };
      const index = effect.index ?? drawPresetIndex(s);
      if (index === null) return { state: s, events: [] };
      const letter = effect.letter ?? s.word.solutions[0]![index]!;
      if (s.word.presetTiles.some((p) => p.index === index)) return { state: s, events: [] };
      return {
        state: withWord(s, (w) => ({ ...w, presetTiles: [...w.presetTiles, { index, letter }] })),
        events: [{ type: 'TILE_PRESET', index }],
      };
    }

    case 'LOCK_LETTER': {
      if (!s.word) return { state: s, events: [] };
      const locked = effect.letter
        ? { letter: effect.letter, source: effect.source }
        : drawLockedLetter(s, effect.source);
      if (!locked) return { state: s, events: [] };
      if (s.word.lockedLetters.some((l) => l.letter === locked.letter)) {
        return { state: s, events: [] };
      }
      return {
        state: withWord(s, (w) => ({ ...w, lockedLetters: [...w.lockedLetters, locked] })),
        events: [{ type: 'LETTER_LOCKED', letter: locked.letter, source: locked.source }],
      };
    }

    case 'REVEAL_META': {
      if (!s.word) return { state: s, events: [] };
      const solution = s.word.solutions[0]!;
      const revealed = { ...s.word.revealed };
      if (effect.field === 'vowelCount') revealed.vowelCount = vowelCount(solution);
      if (effect.field === 'hasRepeat') revealed.hasRepeat = hasRepeat(solution);
      if (effect.field === 'sharedLetter') {
        // usedSolutions already holds this word's solutions, so step back past
        // them to find the previous word's.
        const previous = s.usedSolutions.at(-1 - s.word.solutions.length) ?? null;
        const shared = previous ? [...solution].find((c) => previous.includes(c)) : undefined;
        revealed.sharedLetter = shared ?? null;
      }
      return {
        state: withWord(s, (w) => ({ ...w, revealed })),
        events: [{ type: 'META_REVEALED', field: effect.field }],
      };
    }

    case 'REVEAL_LETTER': {
      if (!s.word) return { state: s, events: [] };
      const present = s.word.solutions.some((sol) => sol.includes(effect.letter));
      return {
        state: withWord(s, (w) => ({
          ...w,
          revealed: { ...w.revealed, letters: [...w.revealed.letters, { letter: effect.letter, present }] },
        })),
        events: [{ type: 'META_REVEALED', field: `letter:${effect.letter}` }],
      };
    }

    case 'GRANT_RELIC': {
      if (s.relics.some((r) => r.code === effect.code)) return { state: s, events: [] };
      const acquiredAt = nextAcquisitionOrdinal(s);
      return {
        state: {
          ...s,
          relics: [...s.relics, instantiate(effect.code, acquiredAt)],
          stats: { ...s.stats, relicsTaken: [...s.stats.relicsTaken, effect.code] },
        },
        events: [{ type: 'RELIC_GRANTED', code: effect.code }],
      };
    }

    case 'GRANT_CONSUMABLE': {
      if (s.consumables.length >= cfg.consumableSlots) return { state: s, events: [] };
      const acquiredAt = nextAcquisitionOrdinal(s);
      return {
        state: {
          ...s,
          consumables: [
            ...s.consumables,
            { instanceId: `${effect.code}#${acquiredAt}`, code: effect.code, acquiredAt },
          ],
        },
        events: [{ type: 'CONSUMABLE_GRANTED', code: effect.code }],
      };
    }

    case 'CONSUME':
      return {
        state: { ...s, consumables: s.consumables.filter((c) => c.instanceId !== effect.instanceId) },
        events: [],
      };

    case 'SET_RELIC_STATE':
      return {
        state: {
          ...s,
          relics: s.relics.map((r) =>
            r.instanceId === effect.instanceId ? { ...r, state: { ...r.state, ...effect.patch } } : r,
          ),
        },
        events: [],
      };

    case 'SET_COUNTER':
      return { state: { ...s, counters: { ...s.counters, [effect.key]: effect.value } }, events: [] };

    case 'REROLL_TRUTH_MASK': {
      if (!s.word) return { state: s, events: [] };
      const rolls = s.counters['truthRerolls'] ?? 0;
      const mask = Array.from({ length: s.word.length }, (_, i) =>
        draw(s.seed, DOMAIN.truth(s.word!.nodeId), rolls * 100 + i) > 1 / s.word!.length,
      );
      return {
        state: {
          ...withWord(s, (w) => ({ ...w, truthMask: mask })),
          counters: { ...s.counters, truthRerolls: rolls + 1 },
        },
        events: [],
      };
    }

    case 'CLEAR_MODIFIERS': {
      if (!s.word) return { state: s, events: [] };
      return {
        state: withWord(s, (w) => ({
          ...w,
          modifiers: [],
          deferralDepth: 0,
          liarIndex: null,
          truthMask: null,
          // Only the modifier's lock is cleared; a relic's lock is not a modifier.
          lockedLetters: w.lockedLetters.filter((l) => !l.source.startsWith('MOD:')),
        })),
        events: [{ type: 'MODIFIERS_CLEARED' }],
      };
    }

    case 'REVEAL_MAP_MODIFIERS':
      return { state: { ...s, map: { ...s.map, modifiersRevealed: true } }, events: [] };

    case 'FORGE_OPS':
      return {
        state: {
          ...s,
          counters: { ...s.counters, forgeOps: (s.counters['forgeOps'] ?? 0) + effect.delta },
        },
        events: [],
      };

    case 'SET_DEFERRAL':
      if (!s.word) return { state: s, events: [] };
      return { state: withWord(s, (w) => ({ ...w, deferralDepth: effect.depth })), events: [] };

    case 'ADD_MODIFIER':
      if (!s.word) return { state: s, events: [] };
      return {
        state: withWord(s, (w) => ({ ...w, modifiers: [...w.modifiers, effect.id] })),
        events: [],
      };

    case 'END_RUN':
      return {
        state: {
          ...s,
          phase: effect.outcome === 'WIN' ? 'VICTORY' : 'DEATH',
          outcome: { result: effect.outcome, cause: effect.cause },
          stats: { ...s.stats, deathCause: effect.outcome === 'DEATH' ? effect.cause : null },
        },
        events: [{ type: 'RUN_ENDED', outcome: effect.outcome, cause: effect.cause }],
      };
  }
}

// ----------------------------------------------------------------- helpers

function withWord(s: GameState, fn: (w: WordState) => WordState): GameState {
  return s.word ? { ...s, word: fn(s.word) } : s;
}

function nextAcquisitionOrdinal(s: GameState): number {
  return (
    Math.max(0, ...s.relics.map((r) => r.acquiredAt), ...s.consumables.map((c) => c.acquiredAt)) + 1
  );
}

/** R-003, via the shared helper. Never a letter present in any live solution. */
function drawLockedLetter(
  s: GameState,
  source: string,
): { letter: string; source: string } | null {
  const word = s.word;
  if (!word) return null;
  const already = new Set(word.lockedLetters.map((l) => l.letter));
  const eligible = eligibleLettersForRemoval(word.solutions).filter((c) => !already.has(c));
  if (eligible.length === 0) return null;
  const index = drawInt(s.seed, DOMAIN.moth(word.nodeId), already.size, eligible.length);
  return { letter: eligible[index]!, source };
}

function drawPresetIndex(s: GameState): number | null {
  const word = s.word!;
  const taken = new Set(word.presetTiles.map((p) => p.index));
  const free = Array.from({ length: word.length }, (_, i) => i).filter((i) => !taken.has(i));
  if (free.length === 0) return null;
  return free[drawInt(s.seed, DOMAIN.word(word.nodeId), 500 + taken.size, free.length)]!;
}

/** The word served immediately before this one. RL.03 Palimpsest's input. */
function lastSolution(s: GameState): string | null {
  return s.usedSolutions.at(-1) ?? null;
}

export { ALPHABET };
