import { BOSSES } from '../content/bosses';
import { lengthFor } from '../content/modifiers';
import {
  CHARACTER_BY_CODE,
  offerableRelics,
  REGISTRY,
  activationFor,
  impl as implFor,
  isImplemented,
  offerableInAct,
  offerableConsumables,
} from '../content/registry';
import { annotateDistances } from '../feedback/chain';
import { activeReveals } from '../feedback/infoCap';
import { projectBoard } from '../feedback/projection';
import { hasRepeat, scoreBase, vowelCount } from '../feedback/scorer';
import { generateAct } from '../map/rows';
import { drawSolution, hasWordList, isValidGuess, type WordLength } from '../words';
import type { Action, EngineError, GameEvent, ReduceResult } from './actions';
import { CONFIG, type GameConfig } from './config';
import { checkActivation } from './activation';
import type { Effect } from './effects';
import { EffectDepthError } from './effects';
import { holdersInOrder, resolveHook, resolveUse } from './hooks';
import { ALPHABET, eligibleLettersForRemoval, isLetterAvailable } from './letters';
import {
  EVENTS,
  FORGE_GOLD_PER_GUESS,
  drawEvent,
  forgeOperations,
  optionAvailable,
  rollShopStock,
} from './nodes';
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
      return declineOffer(state, cfg);
    case 'USE_ITEM':
      return applyItemUse(state, action.instanceId, action.payload ?? {}, cfg);
    case 'BUY_EMERGENCY':
      return buyEmergency(state, cfg);
    case 'BUY_REVEAL':
      return buyReveal(state, action.index, [], cfg);
    case 'BUY_STOCK':
      return buyStock(state, action.slot, cfg);
    case 'LEAVE_NODE':
      return leaveNode(state, cfg);
    case 'FORGE_UPGRADE':
      return forgeUpgrade(state, action.instanceId);
    case 'FORGE_CONVERT':
      return forgeConvert(state, action.guesses, cfg);
    case 'CHOOSE_EVENT_OPTION':
      return chooseEventOption(state, action.key, cfg);
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
      // holdersInOrder normalises consumables into the relic shape, so the
      // activation check does not have to know which list a code came from.
      const holder = holdersInOrder(s).find((i) => i.instanceId === action.instanceId);
      if (!holder) return { code: 'NO_SUCH_ITEM', message: `Not holding ${action.instanceId}.` };
      // Consumables have no activation block and are usable wherever input is
      // accepted (MECHANICS.md §6.5). Relics that declare one are gated by it.
      return checkActivation(s, holder)?.error ?? null;
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
    case 'BUY_STOCK': {
      if (s.phase !== 'SHOP' || !s.shop) return wrongPhase('SHOP');
      const item = s.shop.stock[action.slot];
      if (!item) return { code: 'NO_SUCH_SLOT', message: 'Nothing in that slot.' };
      if (item.sold) return { code: 'SOLD_OUT', message: 'Already bought.' };
      if (s.gold < item.price) return { code: 'UNAFFORDABLE', message: `${item.price}g needed.` };
      if (REGISTRY[item.code]?.isConsumable && s.consumables.length >= cfg.consumableSlots) {
        return { code: 'INVENTORY_FULL', message: `Consumables are capped at ${cfg.consumableSlots}.` };
      }
      return null;
    }
    case 'FORGE_UPGRADE': {
      if (s.phase !== 'FORGE' || !s.forge) return wrongPhase('FORGE');
      if (s.forge.operationsLeft <= 0) return { code: 'NO_OPERATIONS', message: 'No operations left.' };
      const held = s.relics.find((r) => r.instanceId === action.instanceId);
      if (!held) return { code: 'NO_SUCH_ITEM', message: `Not holding ${action.instanceId}.` };
      if (held.upgraded) return { code: 'ALREADY_UPGRADED', message: 'Already MK.II.' };
      if (!REGISTRY[held.code]?.upgrade) return { code: 'NOT_UPGRADEABLE', message: 'No MK.II exists.' };
      return null;
    }
    case 'FORGE_CONVERT': {
      if (s.phase !== 'FORGE' || !s.forge) return wrongPhase('FORGE');
      if (s.forge.operationsLeft <= 0) return { code: 'NO_OPERATIONS', message: 'No operations left.' };
      const cost = Math.max(0, Math.floor(action.guesses)) * FORGE_GOLD_PER_GUESS;
      if (cost === 0 || s.gold < cost) return { code: 'UNAFFORDABLE', message: `${cost}g needed.` };
      return null;
    }
    case 'CHOOSE_EVENT_OPTION': {
      if (s.phase !== 'EVENT' || !s.event) return wrongPhase('EVENT');
      const option = EVENTS[s.event.code]?.options.find((o) => o.key === action.key);
      if (!option) return { code: 'NO_SUCH_OPTION', message: `No option ${action.key}.` };
      if (!optionAvailable(s, option.requires)) {
        return { code: 'REQUIREMENT_UNMET', message: 'You do not meet the terms.' };
      }
      return null;
    }
    case 'LEAVE_NODE':
      if (s.phase !== 'SHOP' && s.phase !== 'FORGE' && s.phase !== 'EVENT') {
        return { code: 'WRONG_PHASE', message: 'Not at a service node.' };
      }
      return null;
    case 'BUY_REVEAL': {
      const blocked = revealBlocker(s, cfg);
      if (blocked) return blocked;
      if (action.index < 0 || action.index >= s.word!.length) {
        return { code: 'POSITION_KNOWN', message: 'No such position.' };
      }
      if (knownPositions(s).has(action.index)) {
        return { code: 'POSITION_KNOWN', message: 'Already revealed.' };
      }
      return null;
    }
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
    shop: null,
    forge: null,
    event: null,
    seenEvents: [],
    pendingChallenge: null,
    actRevivalGuesses: null,
    actStartSnapshot: null,
    ouroborosSpent: false,
    actReceipt: null,
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
    map: generateAct(s.seed, actIndex, cfg).map,
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
    upgraded: false,
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

  // A service node has no word. It opens its own screen and returns to the map
  // via LEAVE_NODE, which is why `advance` already reads current.next.
  if (node.kind === 'SHOP') {
    const stock = rollShopStock(next, nodeId, cfg);
    return {
      state: { ...next, phase: 'SHOP', shop: { nodeId, stock } },
      events: [...events, { type: 'SHOP_OPENED', nodeId, slots: stock.length }],
    };
  }

  if (node.kind === 'FORGE') {
    const operations = forgeOperations(next);
    return {
      state: { ...next, phase: 'FORGE', forge: { nodeId, operationsLeft: operations, upgraded: [] } },
      events: [...events, { type: 'FORGE_OPENED', nodeId, operations }],
    };
  }

  if (node.kind === 'EVENT') {
    const drawn = drawEvent(next, nodeId);
    // §6.8 draws without replacement, so a run long enough to exhaust the act's
    // pool would otherwise hang on an empty screen. Walk on instead.
    if (!drawn) return advance(next, events, cfg);
    return {
      state: {
        ...next,
        phase: 'EVENT',
        event: { nodeId, code: drawn.code },
        seenEvents: [...next.seenEvents, drawn.code],
      },
      events: [...events, { type: 'EVENT_OPENED', nodeId, code: drawn.code }],
    };
  }

  if (node.kind === 'BOSS' && BOSSES[next.actIndex].ownPool !== null) {
    next = { ...next, gauntlet: { pool: BOSSES[next.actIndex].ownPool!, wordIndex: 0 } };
  }

  const started = startWord(next, nodeId, cfg);
  return { state: started.state, events: [...events, ...started.events] };
}

// ------------------------------------------------------------ service nodes

/** Clears whichever service node is open and returns to the map. */
function leaveNode(s: GameState, cfg: Readonly<GameConfig>): ReduceResult {
  const node = s.map.currentId ? s.map.nodes[s.map.currentId] : null;
  // "Used it" is what RL.16 The Pilgrim is paid for NOT doing, so it has to
  // mean the same thing at every node kind: you took what the node offered.
  const usedIt =
    (s.shop?.stock.some((x) => x.sold) ?? false) ||
    (s.forge ? s.forge.operationsLeft < forgeOperations(s) : false);

  const hooked = node
    ? applyEffects(
        s,
        resolveHook(s, 'onNodeLeave', { nodeId: node.id, kind: node.kind, usedIt }, cfg),
        cfg,
      )
    : { state: s, events: [] };

  return advance(
    { ...hooked.state, shop: null, forge: null, event: null },
    hooked.events,
    cfg,
  );
}

function buyStock(s: GameState, slot: number, cfg: Readonly<GameConfig>): ReduceResult {
  const item = s.shop?.stock[slot];
  if (!s.shop || !item) {
    return { state: s, events: [], error: { code: 'NO_SUCH_SLOT', message: 'Nothing in that slot.' } };
  }
  if (item.sold) return { state: s, events: [], error: { code: 'SOLD_OUT', message: 'Already bought.' } };
  if (s.gold < item.price) {
    return { state: s, events: [], error: { code: 'UNAFFORDABLE', message: `${item.price}g needed.` } };
  }
  const def = REGISTRY[item.code];
  if (def?.isConsumable && s.consumables.length >= cfg.consumableSlots) {
    return {
      state: s,
      events: [],
      error: { code: 'INVENTORY_FULL', message: `Consumables are capped at ${cfg.consumableSlots}.` },
    };
  }

  const paid = applyEffects(s, [{ kind: 'GOLD', delta: -item.price, reason: 'shop' }], cfg);
  const granted = applyEffects(
    paid.state,
    [def?.isConsumable ? { kind: 'GRANT_CONSUMABLE', code: item.code } : { kind: 'GRANT_RELIC', code: item.code }],
    cfg,
  );
  const stock = s.shop.stock.map((x, i) => (i === slot ? { ...x, sold: true } : x));
  return {
    state: { ...granted.state, shop: { ...s.shop, stock } },
    events: [
      ...paid.events,
      ...granted.events,
      { type: 'STOCK_BOUGHT', code: item.code, price: item.price },
    ],
  };
}

function forgeUpgrade(s: GameState, instanceId: string): ReduceResult {
  if (!s.forge || s.forge.operationsLeft <= 0) {
    return { state: s, events: [], error: { code: 'NO_OPERATIONS', message: 'No operations left.' } };
  }
  const held = s.relics.find((r) => r.instanceId === instanceId);
  if (!held) {
    return { state: s, events: [], error: { code: 'NO_SUCH_ITEM', message: `Not holding ${instanceId}.` } };
  }
  if (held.upgraded) {
    return { state: s, events: [], error: { code: 'ALREADY_UPGRADED', message: 'Already MK.II.' } };
  }
  if (!REGISTRY[held.code]?.upgrade) {
    return { state: s, events: [], error: { code: 'NOT_UPGRADEABLE', message: 'No MK.II exists.' } };
  }

  return {
    state: {
      ...s,
      relics: s.relics.map((r) => (r.instanceId === instanceId ? { ...r, upgraded: true } : r)),
      forge: {
        ...s.forge,
        operationsLeft: s.forge.operationsLeft - 1,
        upgraded: [...s.forge.upgraded, held.code],
      },
    },
    events: [{ type: 'RELIC_UPGRADED', code: held.code, instanceId }],
  };
}

function forgeConvert(s: GameState, guesses: number, cfg: Readonly<GameConfig>): ReduceResult {
  if (!s.forge || s.forge.operationsLeft <= 0) {
    return { state: s, events: [], error: { code: 'NO_OPERATIONS', message: 'No operations left.' } };
  }
  const wanted = Math.max(0, Math.floor(guesses));
  const cost = wanted * FORGE_GOLD_PER_GUESS;
  if (wanted === 0 || s.gold < cost) {
    return { state: s, events: [], error: { code: 'UNAFFORDABLE', message: `${cost}g needed.` } };
  }

  const paid = applyEffects(s, [{ kind: 'GOLD', delta: -cost, reason: 'forge' }], cfg);
  const poured = applyEffects(paid.state, [{ kind: 'POOL', delta: wanted, reason: 'forge' }], cfg);
  return {
    state: { ...poured.state, forge: { ...s.forge, operationsLeft: s.forge.operationsLeft - 1 } },
    events: [
      ...paid.events,
      ...poured.events,
      { type: 'GOLD_CONVERTED', gold: cost, guesses: wanted },
    ],
  };
}

// -------------------------------------------------------------------- word

function startWord(s: GameState, nodeId: NodeId, cfg: Readonly<GameConfig>): ReduceResult {
  const node = s.map.nodes[nodeId]!;
  const isBoss = node.kind === 'BOSS';
  // From the NODE, never from state.actIndex. The two are meant to agree and a
  // playtest screenshot proved they can drift: the Act II Twins ran the Act I
  // Cipher's 3-turn deferral over a two-solution word, which is six blank rows
  // and no way to read them.
  const boss = BOSSES[node.actIndex];
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

  // R-026, enforced where the word is built rather than only where modifiers
  // roll. The pair exclusion stops FOG meeting MIRROR, but a boss carries its
  // deferral outside the modifier table, so the Cipher could still meet a
  // mirrored word by another route. Two solutions always win: a deferred mirror
  // is unreadable, a mirror is merely hard.
  const mirrored = solutions.length > 1;
  const deferralDepth = mirrored
    ? 0
    : isBoss && boss.deferralDepth > 0
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
    revealsPurchased: 0,
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

  // An event's word_challenge resolves here, and only here. It was set on run
  // state and never read — so EV.01 The Wager staked a relic on a two-guess
  // solve and then neither branch fired. A wager that cannot be lost is not a
  // wager, and one that cannot be won is worse.
  if (next.pendingChallenge) {
    const challenge = next.pendingChallenge;
    const within = challenge.limit === null || guessesUsed <= challenge.limit;
    const branch = solved && within ? challenge.onSuccess : challenge.onFailure;
    next = { ...next, pendingChallenge: null };
    for (const effect of branch) {
      const applied = applyEventEffect(next, effect as Record<string, unknown>, challenge.source, cfg);
      next = applied.state;
      events.push(...applied.events);
    }
    events.push({
      type: 'CHALLENGE_RESOLVED',
      source: challenge.source,
      met: solved && within,
    });
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

  // R-025. A word node pays gold OR a relic and the player picks; an elite or
  // a boss pays both. Granting both everywhere yielded ~15 relics a run, which
  // left gold with nothing to buy that was not already coming for free.
  const bothRewards = kind === 'BOSS' || kind === 'ELITE';
  if (bothRewards) {
    const gold = kind === 'BOSS' ? cfg.rewards.boss : cfg.rewards.elite;
    const golded = applyEffects(next, [{ kind: 'GOLD', delta: gold, reason: `${kind} reward` }], cfg);
    next = golded.state;
    events.push(...golded.events);
  }

  const codes = rollOffer(next, nodeId, cfg);
  if (codes.length > 0) {
    next = {
      ...next,
      phase: 'REWARD',
      pendingOffer: {
        kind: 'RELIC',
        codes,
        sourceNodeId: nodeId,
        forced: false,
        // null on elite and boss nodes: their gold is already paid, so refusing
        // the relic buys nothing and the screen must not offer a trade.
        goldInstead: bothRewards ? null : cfg.rewards.wordGoldInstead,
      },
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
  const available = offerableRelics().filter(
    (d) =>
      !d.isConsumable &&
      !s.relics.some((r) => r.code === d.code) &&
      offerableInAct(d, s.actIndex),
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

/**
 * Resolve one event option (MECHANICS.md §6.8).
 *
 * The effect vocabulary is closed and translated here into the engine's own
 * `Effect` union wherever the two overlap, so an event grants gold or pool
 * through exactly the same path a relic does. The three verbs with no `Effect`
 * equivalent — a challenge on the next word, a map skip, a revival flag — set
 * run state directly, and each is a named field rather than a counter, because
 * a flag nobody can find is a flag nobody maintains.
 */
function chooseEventOption(s: GameState, key: string, cfg: Readonly<GameConfig>): ReduceResult {
  const def = s.event ? EVENTS[s.event.code] : undefined;
  const option = def?.options.find((o) => o.key === key);
  if (!def || !option) {
    return { state: s, events: [], error: { code: 'NO_SUCH_OPTION', message: `No option ${key}.` } };
  }
  if (!optionAvailable(s, option.requires)) {
    return {
      state: s,
      events: [],
      error: { code: 'REQUIREMENT_UNMET', message: 'You do not meet the terms.' },
    };
  }

  let next = s;
  const out: GameEvent[] = [];

  for (const effect of option.effect) {
    const applied = applyEventEffect(next, effect, def.code, cfg);
    next = applied.state;
    out.push(...applied.events);
  }

  out.push({ type: 'EVENT_RESOLVED', code: def.code, option: key });
  // The node is done either way; leaving is not a second decision.
  return advance({ ...next, event: null }, out, cfg);
}

function applyEventEffect(
  s: GameState,
  effect: Record<string, unknown>,
  source: string,
  cfg: Readonly<GameConfig>,
): { state: GameState; events: GameEvent[] } {
  if ('gold_delta' in effect) {
    return applyEffects(s, [{ kind: 'GOLD', delta: effect['gold_delta'] as number, reason: source }], cfg);
  }
  if ('pool_delta' in effect) {
    return applyEffects(s, [{ kind: 'POOL', delta: effect['pool_delta'] as number, reason: source }], cfg);
  }
  if ('consumable_grant' in effect) {
    const spec = effect['consumable_grant'] as { count: number };
    let next = s;
    const events: GameEvent[] = [];
    for (let i = 0; i < spec.count; i++) {
      const pool = offerableConsumables();
      if (pool.length === 0) break;
      const pick = pool[drawInt(s.seed, DOMAIN.offer(source), 800 + i, pool.length)]!;
      const granted = applyEffects(next, [{ kind: 'GRANT_CONSUMABLE', code: pick.code }], cfg);
      next = granted.state;
      events.push(...granted.events);
    }
    return { state: next, events };
  }
  if ('relic_destroy' in effect) {
    const spec = effect['relic_destroy'] as { mode: 'choice' | 'random'; count: number };
    let next = s;
    for (let i = 0; i < spec.count && next.relics.length > 0; i++) {
      // A contingent destroy can resolve with nothing to take — EV.01's wager is
      // deliberately open to a player holding one relic, so this must no-op
      // rather than throw. `choice` resolves to the last acquired until the
      // screen supplies a pick; the UI passes one through by reordering.
      const index =
        spec.mode === 'random'
          ? drawInt(next.seed, DOMAIN.offer(source), 850 + i, next.relics.length)
          : next.relics.length - 1;
      next = { ...next, relics: next.relics.filter((_, j) => j !== index) };
    }
    return { state: next, events: [] };
  }
  if ('word_challenge' in effect) {
    const spec = effect['word_challenge'] as {
      limit: number | null;
      on_success: unknown[];
      on_failure: unknown[];
    };
    return {
      state: {
        ...s,
        pendingChallenge: {
          limit: spec.limit,
          source,
          onSuccess: spec.on_success,
          onFailure: spec.on_failure,
        },
      },
      events: [],
    };
  }
  if ('flag_set' in effect) {
    const spec = effect['flag_set'] as { flag: string; value: number };
    if (spec.flag === 'act_revival_available') {
      return { state: { ...s, actRevivalGuesses: spec.value }, events: [] };
    }
    return { state: { ...s, counters: { ...s.counters, [spec.flag]: spec.value } }, events: [] };
  }
  if ('map_skip' in effect) {
    const spec = effect['map_skip'] as { nodes: number };
    return { state: skipNodes(s, spec.nodes), events: [] };
  }
  if ('reveal' in effect) {
    const spec = effect['reveal'] as { scope: string };
    // act_map is the Cartographer's own effect, so it reuses that flag rather
    // than inventing a parallel one the map screen would also have to read.
    if (spec.scope === 'act_map') {
      return { state: { ...s, map: { ...s.map, modifiersRevealed: true } }, events: [] };
    }
    return { state: { ...s, counters: { ...s.counters, [`reveal:${spec.scope}`]: 1 } }, events: [] };
  }
  // modifier_apply, modifier_reroll and relic_grant need the offer and modifier
  // systems, which Phase 3 wires next. Recorded rather than silently dropped.
  return {
    state: { ...s, counters: { ...s.counters, [`unapplied:${Object.keys(effect)[0]}`]: 1 } },
    events: [],
  };
}

/** Walk the DAG forward without entering the nodes passed. */
function skipNodes(s: GameState, count: number): GameState {
  let current = s.map.currentId;
  for (let i = 0; i < count; i++) {
    const node = current ? s.map.nodes[current] : null;
    const next = node?.next[0];
    if (!next) break;
    current = next;
  }
  return { ...s, map: { ...s.map, currentId: current } };
}

// ------------------------------------------------------------- progression

function advance(s: GameState, events: GameEvent[], cfg: Readonly<GameConfig>): ReduceResult {
  if (s.phase === 'ACT_END') {
    const next = beginNextAct(s, cfg);
    return { state: next.state, events: [...events, ...next.events] };
  }
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
  const goldBefore = s.gold;
  let next = s;

  // Hooks first, so RL.24 The Ledger's top-up is part of the same conversion
  // rather than a second, separate gold event the player has to reconcile.
  const hooked = applyEffects(
    next,
    resolveHook(next, 'onActEnd', { actIndex: next.actIndex, leftover }, cfg),
    cfg,
  );
  next = hooked.state;
  const out = [...events, ...hooked.events];

  const base = leftover * cfg.goldPerLeftoverGuess;
  const golded = applyEffects(next, [{ kind: 'GOLD', delta: base, reason: 'leftover guesses' }], cfg);
  next = golded.state;
  out.push(...golded.events);

  // The leftover guesses are SPENT by the conversion, so the pool empties. The
  // next act refills it anyway, but the receipt is shown in between — and a HUD
  // still reading 19 while the receipt says they all became gold is the kind of
  // contradiction a player notices immediately.
  const drained = addPool(next, -leftover, 'converted to gold');
  next = drained.state;
  out.push(...drained.events);

  // What the conversion was actually worth, base plus any relic top-up. The
  // receipt shows the rate, so a Ledger holder can see the 15g they were
  // promised rather than the 10g the config names.
  const goldGained = next.gold - goldBefore;
  const rate = leftover > 0 ? goldGained / leftover : cfg.goldPerLeftoverGuess;
  out.push({ type: 'ACT_ENDED', actIndex: next.actIndex, leftover, goldGained });

  if (next.actIndex === 2) {
    return {
      state: { ...next, phase: 'VICTORY', outcome: { result: 'WIN', cause: null } },
      events: [...out, { type: 'RUN_ENDED', outcome: 'WIN', cause: null }],
    };
  }

  // Stop at the receipt. The conversion is the moment a player learns what
  // hoarding was worth, and running straight on to the next act's map hides it.
  // ADVANCE from here starts the next act.
  return {
    state: {
      ...next,
      phase: 'ACT_END',
      actReceipt: { actIndex: next.actIndex, leftover, goldGained, rate },
    },
    events: out,
  };
}

/** ADVANCE out of the act-end receipt. */
function beginNextAct(s: GameState, cfg: Readonly<GameConfig>): ReduceResult {
  const started = startAct({ ...s, actReceipt: null }, (s.actIndex + 1) as 0 | 1 | 2, cfg);
  return { state: started.state, events: started.events };
}

// ------------------------------------------------------- emergency and death

/**
 * How many emergency guesses are free this act. RL.25 Insurance grants one, two
 * at MK.II. Read from held relics rather than fired as a hook, for the same
 * reason `revealCost` reads `reveal_discount`: a price is a query.
 */
function freeEmergencies(s: GameState): number {
  const held = s.relics.find((r) => r.code === 'RL.25');
  if (!held) return 0;
  return held.upgraded ? 2 : 1;
}

export function emergencyCost(
  s: GameState,
  cfg: Readonly<GameConfig> = CONFIG,
): number | null {
  // Free purchases still consume a rung. Insurance buys the price, not the cap
  // — otherwise it would quietly raise the §2.3 ladder from three outs to four.
  if (s.emergencyPurchasesThisAct < freeEmergencies(s)) {
    return cfg.emergencyCosts[s.emergencyPurchasesThisAct] === undefined ? null : 0;
  }
  return cfg.emergencyCosts[s.emergencyPurchasesThisAct] ?? null;
}

/**
 * R-025 — refusing the relic takes the gold instead.
 *
 * Not a "skip". On a word node the two rewards are one choice, so declining is
 * a purchase: it is how gold enters a run in any quantity, and therefore how
 * the shop and both ladders get funded. `goldInstead` is null on elite and boss
 * nodes, where the gold is already paid and refusing really is just refusing.
 */
function declineOffer(s: GameState, cfg: Readonly<GameConfig>): ReduceResult {
  const instead = s.pendingOffer?.goldInstead ?? null;
  let next: GameState = { ...s, pendingOffer: null };
  const events: GameEvent[] = [];
  if (instead !== null && instead > 0) {
    const paid = applyEffects(next, [{ kind: 'GOLD', delta: instead, reason: 'relic declined' }], cfg);
    next = paid.state;
    events.push(...paid.events);
  }
  return advance(next, events, cfg);
}

// ------------------------------------------------------------ reveal ladder

/**
 * The price of the next §2.5 reveal, or null when the ladder is spent.
 *
 * Discounts are read from `reveal_discount` on every held relic rather than
 * fired as hooks: a price is a query and `Effect` is the vocabulary of state
 * change. Reading the registry generically also means a second discount relic
 * needs no engine change — which is the difference between data-driven and a
 * special case.
 *
 * Discounts multiply rather than sum, so two of them cannot reach zero, and the
 * floor of 1 catches the rest. A free reveal is not a decision.
 */
export function revealCost(
  s: GameState,
  cfg: Readonly<GameConfig> = CONFIG,
): number | null {
  if (!s.word) return null;
  const base = cfg.revealCosts[s.word.revealsPurchased];
  if (base === undefined) return null;
  let price = base;
  for (const held of s.relics) {
    const discount = REGISTRY[held.code]?.reveal_discount;
    if (discount) price *= 1 - discount;
  }
  return Math.max(1, Math.round(price));
}

/** Positions whose letter the player already knows for certain. */
function knownPositions(s: GameState): Set<number> {
  return new Set((s.word?.presetTiles ?? []).map((p) => p.index));
}

/**
 * Why the ladder is closed right now, or null if it is open. Split out because
 * `canDispatch` and the view need the same answer, and a view that re-derives
 * legality is a view that will eventually disagree with the engine.
 */
export function revealBlocker(
  s: GameState,
  cfg: Readonly<GameConfig> = CONFIG,
): EngineError | null {
  if (s.phase !== 'WORD' || !s.word) return { code: 'WRONG_PHASE', message: 'Not in a word.' };
  // Rule A. Engage with the word before buying your way through it.
  if (s.word.history.length === 0) {
    return { code: 'REVEAL_UNAVAILABLE', message: 'Guess once before buying a reveal.' };
  }
  // Rule B. Bought reveals and relic presets count together, so the ladder can
  // never hand over the last unknown position.
  if (knownPositions(s).size >= s.word.length - 1) {
    return { code: 'REVEAL_UNAVAILABLE', message: 'Only one position left to find.' };
  }
  const cost = revealCost(s, cfg);
  if (cost === null) return { code: 'REVEAL_EXHAUSTED', message: 'No reveals left this word.' };
  // Rule C. Refused, not consumed: this returns before revealsPurchased moves.
  if (s.gold < cost) return { code: 'UNAFFORDABLE', message: `${cost}g needed.` };
  return null;
}

function buyReveal(
  s: GameState,
  index: number,
  events: GameEvent[],
  cfg: Readonly<GameConfig>,
): ReduceResult {
  const blocked = revealBlocker(s, cfg);
  if (blocked) return { state: s, events, error: blocked };
  const word = s.word!;
  if (index < 0 || index >= word.length) {
    return { state: s, events, error: { code: 'POSITION_KNOWN', message: 'No such position.' } };
  }
  if (knownPositions(s).has(index)) {
    return { state: s, events, error: { code: 'POSITION_KNOWN', message: 'Already revealed.' } };
  }

  const cost = revealCost(s, cfg)!;
  // Rule D. Read from the solution directly, not through the transform chain:
  // a bought reveal is not corrupted by Liar Letter and does not decay. That is
  // the whole product. Under Mirror this is the first unsolved solution, so the
  // purchase applies to the board the player is currently working.
  const solutionIndex = Math.max(0, word.solved.findIndex((v) => !v));
  const letter = word.solutions[solutionIndex]![index]!;

  const paid = applyEffects(s, [{ kind: 'GOLD', delta: -cost, reason: 'reveal' }], cfg);
  let next = paid.state;
  const out = [...events, ...paid.events];

  // Rule E is satisfied by construction: PRESET_TILE fixes the letter at this
  // position and never touches lockedLetters, so the letter stays typable
  // elsewhere in the word (R-014).
  const revealed = applyEffects(next, [{ kind: 'PRESET_TILE', index, letter }], cfg);
  next = revealed.state;
  out.push(...revealed.events);

  next = withWord(next, (w) => ({ ...w, revealsPurchased: w.revealsPurchased + 1 }));
  out.push({ type: 'REVEAL_BOUGHT', index, letter, cost, nth: word.revealsPurchased + 1 });
  return { state: next, events: out };
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
  const holder = [...s.relics, ...s.consumables].find((i) => i.instanceId === instanceId)!;
  const events: GameEvent[] = [{ type: 'CONSUMABLE_USED', code: holder.code }];

  // The cost is charged by the engine from the declared block, not by the
  // relic, so every activation pays the same way and a relic cannot forget to.
  let next = s;
  const activation = activationFor(holder.code);
  if (activation?.cost.gold) {
    const paid = applyEffects(
      next,
      [{ kind: 'GOLD', delta: -activation.cost.gold, reason: holder.code }],
      cfg,
    );
    next = paid.state;
    events.push(...paid.events);
  }
  if (activation?.cost.guesses) {
    const paid = applyEffects(
      next,
      [{ kind: 'POOL', delta: -activation.cost.guesses, reason: holder.code }],
      cfg,
    );
    next = paid.state;
    events.push(...paid.events);
  }

  const applied = applyEffects(next, effects, cfg);
  next = applied.state;
  events.push(...applied.events);

  // Spending a guess can empty the pool. The offer is mandatory even when the
  // player emptied it themselves (MECHANICS.md §2.3).
  if (next.word && !next.word.solved.every(Boolean) && currentPool(next) <= 0) {
    return offerEmergency(next, events, cfg);
  }
  return { state: next, events };
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
