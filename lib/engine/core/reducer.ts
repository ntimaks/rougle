import { bossFor } from '../content/bosses';
import { lengthFor, rollModifiers } from '../content/modifiers';
import {
  CHARACTER_BY_CODE,
  offerableRelics,
  REGISTRY,
  activationFor,
  impl as implFor,
  isImplemented,
  offerableConsumables,
} from '../content/registry';
import { annotateDistances } from '../feedback/chain';
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
  drawEvent,
  drawForgeCandidates,
  forgeOperations,
  optionAvailable,
  rerollCost,
  rollShopStock,
  sellPrice,
} from './nodes';
import {
  applyPayout,
  buyEmergency as bankBuyEmergency,
  buyRefill,
  charge,
  emergencyCost as bankEmergencyCost,
  grant,
  refillCost,
  spendGuess,
} from './bank';
import { DOMAIN, draw, drawInt } from './rng';
import {
  SAVE_VERSION,
  emptyActEffects,
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
    case 'BUY_STOCK':
      return buyStock(state, action.slot, cfg);
    case 'BUY_REFILL':
      return buyShopRefill(state, cfg);
    case 'REROLL_SHOP':
      return rerollShop(state, cfg);
    case 'SELL_RELIC':
      return sellRelic(state, action.instanceId, cfg);
    case 'REPLACE_RELIC':
      return replaceRelic(state, action.instanceId, cfg);
    case 'LEAVE_NODE':
      return leaveNode(state, cfg);
    case 'FORGE_UPGRADE':
      return forgeUpgrade(state, action.instanceId);
    case 'FORGE_REFILL':
      return forgeRefill(state, cfg);
    case 'CHOOSE_EVENT_OPTION':
      return chooseEventOption(state, action.key, cfg);
    case 'DECLINE_EMERGENCY':
      return reviveOrDie(state, 'EMERGENCY_DECLINED', [], cfg);
    case 'ADVANCE':
      return advance(state, [], cfg);
    case 'ABANDON_RUN':
      return die(state, 'BANKROLL_EXHAUSTED', cfg);
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
        const provenGrey = new Set(projectBoard(s, s.word, undefined, cfg).provenGrey);
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
    case 'REPLACE_RELIC': {
      if (!s.pendingReplace) return { code: 'NO_OFFER', message: 'Nothing waiting for a slot.' };
      if (!heldRelics(s).some((r) => r.instanceId === action.instanceId)) {
        return { code: 'NO_SUCH_ITEM', message: `Not holding ${action.instanceId}.` };
      }
      return null;
    }
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
      const cost = bankEmergencyCost(s, cfg);
      if (cost === null) {
        return { code: 'EMERGENCY_EXHAUSTED', message: 'The ladder is spent for this run.' };
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
    case 'BUY_REFILL': {
      if (s.phase !== 'SHOP' || !s.shop) return wrongPhase('SHOP');
      if (s.shop.refillsSold >= cfg.economy.refillsPerShop) {
        return { code: 'REFILL_EXHAUSTED', message: 'This shop has sold its refill.' };
      }
      return refillBlocker(s, cfg);
    }
    case 'REROLL_SHOP': {
      if (s.phase !== 'SHOP' || !s.shop) return wrongPhase('SHOP');
      const cost = rerollCost(s.shop.rerolls, cfg);
      if (s.gold < cost) return { code: 'UNAFFORDABLE', message: `${cost}g needed.` };
      return null;
    }
    case 'SELL_RELIC': {
      if (s.phase !== 'SHOP' || !s.shop) return wrongPhase('SHOP');
      if (!heldRelics(s).some((r) => r.instanceId === action.instanceId)) {
        return { code: 'NO_SUCH_ITEM', message: `Not holding ${action.instanceId}.` };
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
      // R-035: a forge works on the three relics it drew, not on everything you
      // hold. Enforced here rather than by rendering fewer buttons, because a
      // restriction only the screen knows is not a rule.
      if (!s.forge.candidates.includes(action.instanceId)) {
        return { code: 'NOT_IN_OFFER', message: 'This forge does not take that one.' };
      }
      return null;
    }
    case 'FORGE_REFILL': {
      if (s.phase !== 'FORGE' || !s.forge) return wrongPhase('FORGE');
      if (s.forge.operationsLeft <= 0) return { code: 'NO_OPERATIONS', message: 'No operations left.' };
      return refillBlocker(s, cfg);
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
    bankroll: 0,
    gold: 0,
    emergencyPurchases: 0,
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
    actEffects: emptyActEffects(),
    bonusRelicSlots: 0,
    pendingReplace: null,
    revivalBankroll: null,
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
  // never occupying a slot. `heldRelics` is what §6.2's five counts.
  s = { ...s, relics: [instantiate(characterCode, 0)] };

  // §2.1 + §9 — the ONE stake, set once. v1.3 read a `pool_modifier` off the
  // character and added it to each act's pool three times a run; §9 states a
  // starting bankroll outright, so there is nothing to add it to.
  s = { ...s, bankroll: character.bankroll_start };

  const events: GameEvent[] = [
    { type: 'RUN_STARTED', seed, characterCode },
    {
      type: 'BANKROLL_CHANGED',
      delta: character.bankroll_start,
      bankroll: s.bankroll,
      reason: 'run start',
      kind: 'BANKROLL_GRANTED',
    },
  ];
  // `RL.09` The Anvil charges 2 here, so the order is: stake, then costs.
  const runStart = applyEffects(s, resolveHook(s, 'onRunStart', {}, cfg), cfg);
  s = runStart.state;
  events.push(...runStart.events);

  const act = startAct(s, 0, cfg);
  return { state: act.state, events: [...events, ...act.events] };
}

/**
 * A new act: a new map and nothing else.
 *
 * v1.3 refilled the pool here, reset the emergency ladder here, and wrote a
 * snapshot for Ouroboros to restore. §2.1 removes the refill, §2.4 makes the
 * ladder run-scoped, and §6.5's Ouroboros returns a number rather than
 * restarting an act — so all three are gone, and an act boundary is now purely
 * structural. That is exactly what §2.2 is asking for: "one continuous curve
 * rather than three resets, which is what lets a bad Act I actually matter in
 * Act III."
 */
function startAct(s: GameState, actIndex: 0 | 1 | 2, cfg: Readonly<GameConfig>): ReduceResult {
  const next: GameState = {
    ...s,
    actIndex,
    gauntlet: null,
    word: null,
    pendingOffer: null,
    // §6.8 — every act-scoped event effect dies here. `EV.09`'s Liar Letter on
    // "every word this act" must not follow you into the next one.
    actEffects: emptyActEffects(),
    map: generateAct(s.seed, actIndex, cfg).map,
    phase: 'MAP',
  };
  return { state: next, events: [{ type: 'ACT_STARTED', actIndex, bankroll: next.bankroll }] };
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
  if (node.kind === 'FORGE') {
    const operations = forgeOperations(next);
    return {
      state: {
        ...next,
        phase: 'FORGE',
        forge: {
          nodeId,
          operationsLeft: operations,
          upgraded: [],
          candidates: drawForgeCandidates(next, nodeId),
        },
      },
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

  // §8.3 — the Gauntlet is five words back to back. It no longer runs on its
  // own pool; the index is all that survives.
  if (node.kind === 'BOSS' && bossFor(node.actIndex, cfg).code === 'GAUNTLET') {
    next = { ...next, gauntlet: { wordIndex: 0 } };
  }

  const started = startWord(next, nodeId, cfg);
  return { state: started.state, events: [...events, ...started.events] };
}

// ------------------------------------------------------------ service nodes

/**
 * Clears whichever service screen is open and returns to the map.
 *
 * `shop:tierUp` is cleared here rather than when the shop opens: `RL.22`
 * Polyglot sets it on `onShopOpen`, and a flag cleared at the same moment it is
 * set is a flag that never applies. Closing the shop is the one point at which
 * it has certainly been read.
 */
function leaveNode(s: GameState, cfg: Readonly<GameConfig>): ReduceResult {
  const { 'shop:tierUp': _spent, ...counters } = s.counters;
  return advance({ ...s, shop: null, forge: null, event: null, counters }, [], cfg);
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
  const bought = def?.isConsumable ? 0 : 1;
  return {
    state: {
      ...granted.state,
      shop: { ...s.shop, stock },
      stats: { ...granted.state.stats, relicsBought: granted.state.stats.relicsBought + bought },
    },
    events: [
      ...paid.events,
      ...granted.events,
      { type: 'STOCK_BOUGHT', code: item.code, price: item.price },
    ],
  };
}

/**
 * §4.1 — the one guess refill this shop will sell, off the run-long ladder.
 *
 * R-046: the shop and the forge index the SAME `stats.refillsBought`, so six is
 * six however the run splits them, and neither venue can undercut the other.
 */
function buyShopRefill(s: GameState, cfg: Readonly<GameConfig>): ReduceResult {
  if (!s.shop) return { state: s, events: [], error: { code: 'WRONG_PHASE', message: 'Not in a shop.' } };
  if (s.shop.refillsSold >= cfg.economy.refillsPerShop) {
    return { state: s, events: [], error: { code: 'REFILL_EXHAUSTED', message: 'This shop has sold its refill.' } };
  }
  const blocked = refillBlocker(s, cfg);
  if (blocked) return { state: s, events: [], error: blocked };

  const cost = refillCost(s, cfg)!;
  const bought = buyRefill(s, cfg)!;
  return {
    state: { ...bought.state, shop: { ...s.shop, refillsSold: s.shop.refillsSold + 1 } },
    events: [...bought.events, { type: 'REFILL_BOUGHT', cost, nth: s.stats.refillsBought + 1 }],
  };
}

/** §4.2 — 20g, +10g per reroll within the same shop. */
function rerollShop(s: GameState, cfg: Readonly<GameConfig>): ReduceResult {
  if (!s.shop) return { state: s, events: [], error: { code: 'WRONG_PHASE', message: 'Not in a shop.' } };
  const cost = rerollCost(s.shop.rerolls, cfg);
  if (s.gold < cost) {
    return { state: s, events: [], error: { code: 'UNAFFORDABLE', message: `${cost}g needed.` } };
  }
  const paid = applyEffects(s, [{ kind: 'GOLD', delta: -cost, reason: 'reroll' }], cfg);
  const rerolls = s.shop.rerolls + 1;
  return {
    state: {
      ...paid.state,
      shop: {
        ...s.shop,
        rerolls,
        stock: rollShopStock(paid.state, s.shop.nodeId, cfg, rerolls),
      },
    },
    events: [...paid.events, { type: 'SHOP_REROLLED', cost, nth: rerolls }],
  };
}

/**
 * §4.2 — sell a held relic for half its price, rounded down.
 *
 * The character innate is not sellable: it is a hidden registry entry rather
 * than a relic the player acquired, and `heldRelics` is the list §6.2 counts.
 */
function sellRelic(s: GameState, instanceId: string, cfg: Readonly<GameConfig>): ReduceResult {
  const held = heldRelics(s).find((r) => r.instanceId === instanceId);
  if (!held) {
    return { state: s, events: [], error: { code: 'NO_SUCH_ITEM', message: `Not holding ${instanceId}.` } };
  }
  const gold = sellPrice(held.code, cfg);
  const paid = applyEffects(
    { ...s, relics: s.relics.filter((r) => r.instanceId !== instanceId) },
    [{ kind: 'GOLD', delta: gold, reason: 'sold' }],
    cfg,
  );
  return {
    state: paid.state,
    events: [...paid.events, { type: 'RELIC_SOLD', code: held.code, gold }],
  };
}

/**
 * §6.2 — destroy one of the five to let the sixth in.
 *
 * The choice is made "at the moment of acquisition, with the incoming relic
 * visible alongside the five held", so the grant is held in `pendingReplace`
 * and the phase is `REPLACE` until the player picks. Declining is `SKIP_OFFER`,
 * which drops the incoming relic and keeps the board.
 */
function replaceRelic(s: GameState, instanceId: string, cfg: Readonly<GameConfig>): ReduceResult {
  const pending = s.pendingReplace;
  if (!pending) {
    return { state: s, events: [], error: { code: 'NO_OFFER', message: 'Nothing waiting for a slot.' } };
  }
  const held = heldRelics(s).find((r) => r.instanceId === instanceId);
  if (!held) {
    return { state: s, events: [], error: { code: 'NO_SUCH_ITEM', message: `Not holding ${instanceId}.` } };
  }
  const freed: GameState = {
    ...s,
    relics: s.relics.filter((r) => r.instanceId !== instanceId),
    pendingReplace: null,
  };
  const granted = applyEffects(freed, [{ kind: 'GRANT_RELIC', code: pending.code }], cfg);
  return advance(granted.state, [
    { type: 'RELIC_DESTROYED', code: held.code, instanceId },
    ...granted.events,
  ], cfg);
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
  if (!s.forge.candidates.includes(instanceId)) {
    return {
      state: s,
      events: [],
      error: { code: 'NOT_IN_OFFER', message: 'This forge does not take that one.' },
    };
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

/**
 * §6.7 operation B — convert gold to bankroll, off the SAME §4.1 ladder the
 * shop sells from (R-046).
 *
 * It used to be a flat 20g for "any quantity affordable", with a forge
 * guaranteed every act. Once R-042 and R-043 repriced the other two valves,
 * that made the forge the cheapest bankroll in the game and the only uncapped
 * one: switching it on took a relic-less run from 34.3% to 63.5%, undoing most
 * of both fixes. One ladder, one run cap, wherever you buy it — pricing it
 * separately would re-open the arbitrage the moment either number moved again.
 */
function forgeRefill(s: GameState, cfg: Readonly<GameConfig>): ReduceResult {
  if (!s.forge || s.forge.operationsLeft <= 0) {
    return { state: s, events: [], error: { code: 'NO_OPERATIONS', message: 'No operations left.' } };
  }
  const blocked = refillBlocker(s, cfg);
  if (blocked) return { state: s, events: [], error: blocked };

  const cost = refillCost(s, cfg)!;
  const bought = buyRefill(s, cfg)!;
  return {
    state: { ...bought.state, forge: { ...s.forge, operationsLeft: s.forge.operationsLeft - 1 } },
    events: [...bought.events, { type: 'REFILL_BOUGHT', cost, nth: s.stats.refillsBought + 1 }],
  };
}

/**
 * Why the shared refill ladder is closed right now, or null if it is open.
 * `canDispatch`, the shop and the forge all need the same answer, and a screen
 * that re-derives legality is a screen that will eventually disagree.
 */
function refillBlocker(s: GameState, cfg: Readonly<GameConfig>): EngineError | null {
  const cost = refillCost(s, cfg);
  if (cost === null) {
    return { code: 'REFILL_EXHAUSTED', message: 'All six refills are spent.' };
  }
  if (s.bankroll >= cfg.economy.bankrollCap) {
    return { code: 'BANKROLL_FULL', message: `The bankroll is capped at ${cfg.economy.bankrollCap}.` };
  }
  if (s.gold < cost) return { code: 'UNAFFORDABLE', message: `${cost}g needed.` };
  return null;
}

// -------------------------------------------------------------------- word

function startWord(s: GameState, nodeId: NodeId, cfg: Readonly<GameConfig>): ReduceResult {
  const node = s.map.nodes[nodeId]!;
  const isBoss = node.kind === 'BOSS';
  // From the NODE, never from state.actIndex. The two are meant to agree and a
  // playtest screenshot proved they can drift: the Act II Twins ran the Act I
  // Cipher's 3-turn deferral over a two-solution word, which is six blank rows
  // and no way to read them.
  const boss = bossFor(node.actIndex, cfg);
  const modifiers: ModifierId[] = applyActEffects(s, node.modifiers);
  const baseLength = cfg.acts[s.actIndex].wordLength;
  const length: WordLength = isBoss
    ? boss.code === 'GAUNTLET'
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
    guessesSpent: 0,
    deferralDepth,
    revealed: { vowelCount: null, hasRepeat: null, sharedLetter: null, letters: [] },
    nodeId,
    wagered: null,
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

  // §6.8 — a forced modifier that counts words ticks here, once per word,
  // whether or not the word is ever solved. `EV.11`'s three Locked Keys are
  // three words of Locked Key even if two of them end the run.
  next = { ...next, actEffects: tickActEffects(next.actEffects) };

  // `EV.01` B — the first letter of every remaining word this act. Bought once
  // and applied on every word start after it, which is what "every remaining
  // word" means and is why it lives on the act rather than on a word.
  if (next.actEffects.firstLettersRevealed) {
    const revealed = applyEffects(next, [{ kind: 'PRESET_TILE', index: 0 }], cfg);
    next = revealed.state;
    events.push(...revealed.events);
  }

  // MECHANICS.md §5: the Locked Key modifier never takes a solution letter.
  if (modifiers.includes('LOCKED_KEY')) {
    const locked = drawLockedLetter(next, 'MOD:LOCKED_KEY');
    if (locked) {
      next = withWord(next, (w) => ({ ...w, lockedLetters: [...w.lockedLetters, locked] }));
      events.push({ type: 'LETTER_LOCKED', letter: locked.letter, source: locked.source });
    }
  }

  // §6.2 — v1.1's information cap is gone. Five relic slots is itself the cap
  // on how much a board can know, and the old rule suppressed the THIRD reveal
  // by acquisition order, which meant a `RL.31` Rosetta Slab bought at a boss
  // charged its payout penalty and did nothing (§13 I-03). Nothing suppresses
  // anything now, so every relic the player paid for fires.
  const payload = {
    nodeId,
    solutions: [...solutions],
    previousSolution: lastSolution(s),
  };
  const hooked = applyEffects(next, resolveHook(next, 'onWordStart', payload, cfg), cfg);
  next = hooked.state;
  events.push(...hooked.events);

  return { state: next, events };
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

  // §2.1 — the decrement lands BEFORE feedback resolves, and before the hooks
  // that react to the guess. `RL.23` The Tin Cup's gold is emitted in the same
  // batch, which the UI drains atomically, so the two counters move on one
  // frame rather than competing for attention.
  const spent = spendGuess(next);
  next = spent.state;
  events.push(...spent.events);

  const applied = applyEffects(
    next,
    resolveHook(next, 'onGuessSubmit', { guess, turn, newUniqueLetters: newUnique }, cfg),
    cfg,
  );
  next = applied.state;
  events.push(...applied.events);

  events.push({ type: 'FEEDBACK_READY', turn });

  const solvedNow = next.word!.solutions.map(
    (solution, i) => next.word!.solved[i] || solution === guess,
  );
  next = withWord(next, (w) => ({ ...w, solved: solvedNow }));

  if (solvedNow.every(Boolean)) return finishWord(next, true, events, cfg);
  if (next.bankroll <= 0) return offerEmergency(next, events, cfg);
  return { state: next, events };
}

/**
 * A word is over. §2.3's payout is computed here and nowhere else.
 *
 * Order, and it is load-bearing:
 *   1. `onWordSolved` — gold and counters. `RL.12` Hot Streak's streak moves
 *      here, which is why `onPayout` reads it FIRST: the bonus is the streak
 *      before this solve, so the first fast solve pays nothing.
 *   2. `onPayout` — collect `PAYOUT_BONUS` bids and `PAYOUT_DISCOUNT`s. These
 *      are not applied; they are inputs to the clamps.
 *   3. `bank.applyPayout` — Clamp B picks the largest bid, Clamp A caps the
 *      word's net gain at +5.
 *
 * Under Mirror the word carries two solutions and §8.1 says "each pays out
 * separately", so the payout runs once per solution against the same guess
 * count. That is what makes the Twins two payouts for one word's guesses, and
 * it is the arithmetic §12.1 says could change the boss order.
 */
function finishWord(
  s: GameState,
  solved: boolean,
  events: GameEvent[],
  cfg: Readonly<GameConfig>,
): ReduceResult {
  const word = s.word!;
  const guessesUsed = word.history.length;
  const node = s.map.nodes[word.nodeId]!;
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
      resolveHook(
        next,
        'onWordSolved',
        { nodeId: word.nodeId, guessesUsed, length: word.length, kind: node.kind },
        cfg,
      ),
      cfg,
    );
    next = hooked.state;
    events.push(...hooked.events);

    const paid = payWord(next, word, guessesUsed, cfg);
    next = paid.state;
    events.push(...paid.events);
  } else {
    events.push({ type: 'WORD_FAILED', nodeId: word.nodeId });
    next = { ...next, stats: { ...next.stats, wordsFailed: next.stats.wordsFailed + 1 } };
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

  next = { ...next, word: null };
  const isBoss = node.kind === 'BOSS';

  // §8.3 — the Gauntlet is five words back to back, no shop between them.
  if (isBoss && next.gauntlet && next.gauntlet.wordIndex + 1 < cfg.gauntlet.words) {
    const advanced: GameState = {
      ...next,
      gauntlet: { wordIndex: next.gauntlet.wordIndex + 1 },
    };
    const nextWord = startWord(advanced, word.nodeId, cfg);
    return { state: nextWord.state, events: [...events, ...nextWord.events] };
  }

  const reward = grantNodeReward(next, node.kind, word.nodeId, word.length, cfg);
  next = reward.state;
  events.push(...reward.events);

  return { state: next, events };
}

/**
 * §2.3 + §2.5 — what the solve is worth, once per solution.
 *
 * `RL.21` All In resolves through `onWordSolved` as a plain `BANKROLL` delta
 * rather than as a bid here, because a wager you won is your own stake coming
 * back rather than a payout bonus, and Clamp B would otherwise make it compete
 * with Flywheel for the one bonus slot.
 */
function payWord(
  s: GameState,
  word: WordState,
  guessesUsed: number,
  cfg: Readonly<GameConfig>,
): { state: GameState; events: GameEvent[] } {
  const opener = word.history[0];
  const openerUniqueLetters = opener ? new Set(opener.guess).size : 0;
  const bids = resolveHook(
    s,
    'onPayout',
    { guessesUsed, length: word.length, openerUniqueLetters },
    cfg,
  );

  const bonuses = bids
    .filter((e): e is Extract<Effect, { kind: 'PAYOUT_BONUS' }> => e.kind === 'PAYOUT_BONUS')
    .map((e) => ({ amount: e.amount, source: e.source }));
  const discount = bids
    .filter((e): e is Extract<Effect, { kind: 'PAYOUT_DISCOUNT' }> => e.kind === 'PAYOUT_DISCOUNT')
    .reduce((n, e) => n + e.guesses, 0);
  // Anything else a payout handler returned is a normal effect and is applied.
  const others = bids.filter((e) => e.kind !== 'PAYOUT_BONUS' && e.kind !== 'PAYOUT_DISCOUNT');

  let next = s;
  const events: GameEvent[] = [];
  const effective = Math.max(0, guessesUsed - discount);

  for (let i = 0; i < word.solutions.length; i++) {
    const paid = applyPayout(next, word.length, effective, bonuses, cfg);
    next = paid.state;
    events.push(...paid.events);
  }

  const applied = applyEffects(next, others, cfg);
  return { state: applied.state, events: [...events, ...applied.events] };
}

// ------------------------------------------------------------------ rewards

/**
 * §3.3 — what clearing a node pays.
 *
 * | Node  | Gold | Other                                           |
 * | Word  | 40g  | Shop opens on clear                             |
 * | Elite | 70g  | Shop opens on clear                             |
 * | Boss  | 120g | +4 bankroll, and choice of 1 of 2 boss relics   |
 *
 * v1.3 offered three relics FREE at every word node and paid 20g to decline —
 * ~15 relics a run, and gold with nothing to buy that was not already coming
 * for free. That is what §4 exists to fix: relics are bought now, and the shop
 * that opens here is the only place a non-boss relic enters a run.
 *
 * The shop is not a map node and cannot be routed around (§4), which is why it
 * opens from the reward path rather than from `enterNode`.
 */
function grantNodeReward(
  s: GameState,
  kind: string,
  nodeId: NodeId,
  length: number,
  cfg: Readonly<GameConfig>,
): ReduceResult {
  const events: GameEvent[] = [];
  let next = s;

  const gold =
    kind === 'BOSS' ? cfg.rewards.boss : kind === 'ELITE' ? cfg.rewards.elite : cfg.rewards.word;
  const golded = applyEffects(next, [{ kind: 'GOLD', delta: gold, reason: `${kind} reward` }], cfg);
  next = golded.state;
  events.push(...golded.events);

  if (kind === 'BOSS') {
    // §3.3 — the boss's +4 lands on CLEARING it, once, not once per word. The
    // Gauntlet is five words and the Twins is two solutions; paying per word
    // would invent 20 bankroll a run.
    const granted = grant(next, cfg.economy.bossBankroll, 'boss cleared', cfg);
    next = granted.state;
    events.push(...granted.events);

    const codes = rollBossOffer(next, nodeId);
    if (codes.length > 0) {
      return {
        state: {
          ...next,
          phase: 'REWARD',
          pendingOffer: { kind: 'RELIC', codes, sourceNodeId: nodeId, forced: false },
        },
        events,
      };
    }
    return advance(next, events, cfg);
  }

  // §4 — a shop after every solve node, elites included. Twelve per run.
  const opened = applyEffects(
    next,
    resolveHook(next, 'onShopOpen', { nodeId, afterLength: length, afterKind: kind }, cfg),
    cfg,
  );
  next = opened.state;
  events.push(...opened.events);

  const stock = rollShopStock(next, nodeId, cfg);
  return {
    state: { ...next, phase: 'SHOP', shop: { nodeId, stock, rerolls: 0, refillsSold: 0 } },
    events: [...events, { type: 'SHOP_OPENED', nodeId, slots: stock.length }],
  };
}

/**
 * §3.3 — a boss offers a choice of 1 of 2 BOSS relics, and both may be
 * declined. They are the only relics not sold in a shop, which is what makes
 * clearing a boss the only way to get one.
 */
function rollBossOffer(s: GameState, nodeId: NodeId): string[] {
  const available = offerableRelics().filter(
    (d) => d.rarity === 'BOSS' && !s.relics.some((r) => r.code === d.code),
  );
  if (available.length <= 2) return available.map((d) => d.code);
  const first = drawInt(s.seed, DOMAIN.offer(nodeId), 0, available.length);
  const rest = available.filter((_d, i) => i !== first);
  const second = drawInt(s.seed, DOMAIN.offer(nodeId), 1, rest.length);
  return [available[first]!.code, rest[second]!.code];
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
  if ('bankroll_delta' in effect || 'pool_delta' in effect) {
    const delta = (effect['bankroll_delta'] ?? effect['pool_delta']) as number;
    return applyEffects(s, [{ kind: 'BANKROLL', delta, reason: source }], cfg);
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
    for (let i = 0; i < spec.count; i++) {
      // §6.2 — `heldRelics`, never `relics`. The character innate lives in the
      // same array so its hooks fire in acquisition order, and an event that
      // took it would silently delete the thing the player chose the character
      // for. It is not a relic they acquired and it does not occupy a slot.
      const held = heldRelics(next);
      if (held.length === 0) break;
      // A contingent destroy can resolve with nothing to take — EV.01's wager is
      // deliberately open to a player holding one relic, so this must no-op
      // rather than throw. `choice` resolves to the last acquired until the
      // screen supplies a pick; the UI passes one through by reordering.
      const victim =
        spec.mode === 'random'
          ? held[drawInt(next.seed, DOMAIN.offer(source), 850 + i, held.length)]!
          : held[held.length - 1]!;
      next = { ...next, relics: next.relics.filter((r) => r.instanceId !== victim.instanceId) };
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
    // `undertaker_revival` is the name events.json uses. The engine checked for
    // two other spellings and neither existed, so `EV.08` charged 160g and
    // armed nothing — a purchased revival that silently did not exist. All
    // three names are honoured rather than only the current one, because the
    // failure mode of getting this wrong is invisible in exactly the moment it
    // matters.
    const REVIVAL = ['undertaker_revival', 'act_revival_available', 'revival_available'];
    if (REVIVAL.includes(spec.flag)) {
      return { state: { ...s, revivalBankroll: spec.value }, events: [] };
    }
    return { state: { ...s, counters: { ...s.counters, [spec.flag]: spec.value } }, events: [] };
  }

  if ('relic_grant' in effect) {
    const spec = effect['relic_grant'] as {
      rarity: string;
      choose: boolean;
      count: number;
    };
    const pool = offerableRelics().filter(
      (d) => d.rarity === spec.rarity && !s.relics.some((r) => r.code === d.code),
    );
    if (pool.length === 0) return { state: s, events: [] };

    // `choose: true` draws `count` and keeps ONE — "DRAW 2 RARE, KEEP 1". It is
    // the same screen as a boss offer, so it is the same `pendingOffer`.
    if (spec.choose) {
      const codes: string[] = [];
      let remaining = pool;
      for (let i = 0; i < spec.count && remaining.length > 0; i++) {
        const pick = remaining[drawInt(s.seed, DOMAIN.offer(source), 900 + i, remaining.length)]!;
        codes.push(pick.code);
        remaining = remaining.filter((d) => d.code !== pick.code);
      }
      return {
        state: {
          ...s,
          pendingOffer: {
            kind: 'RELIC',
            codes,
            sourceNodeId: s.map.currentId ?? source,
            forced: false,
          },
        },
        events: [],
      };
    }

    // `choose: false` grants outright — "UNSEEN UNTIL TAKEN".
    let next = s;
    const events: GameEvent[] = [];
    let remaining = pool;
    for (let i = 0; i < spec.count && remaining.length > 0; i++) {
      const pick = remaining[drawInt(next.seed, DOMAIN.offer(source), 920 + i, remaining.length)]!;
      const granted = applyEffects(next, [{ kind: 'GRANT_RELIC', code: pick.code }], cfg);
      next = granted.state;
      events.push(...granted.events);
      remaining = remaining.filter((d) => d.code !== pick.code);
    }
    return { state: next, events };
  }

  if ('modifier_apply' in effect) {
    const spec = effect['modifier_apply'] as {
      modifier: string;
      scope: 'next_word' | 'next_n_words' | 'rest_of_act';
      n?: number;
    };
    // `EV.12` B pays to CLEAR every modifier for the rest of the act, and says
    // so as `modifier: "NONE"`. It is the absence of a modifier, not one.
    if (spec.modifier === 'NONE') {
      return {
        state: { ...s, actEffects: { ...s.actEffects, modifiersSuppressed: true } },
        events: [],
      };
    }
    const words =
      spec.scope === 'rest_of_act' ? null : spec.scope === 'next_n_words' ? (spec.n ?? 1) : 1;
    return {
      state: {
        ...s,
        actEffects: {
          ...s.actEffects,
          forcedModifiers: [
            ...s.actEffects.forcedModifiers,
            { id: spec.modifier as ModifierId, words, source },
          ],
        },
      },
      events: [],
    };
  }

  if ('modifier_reroll' in effect) {
    // "REROLL EVERY MODIFIER ON THE REST OF THE ACT. IT MAY GET WORSE." — and
    // it must be able to. Addressed off a counter so the reroll is
    // reproducible and so a second Compositor in one run rolls differently.
    const roll = (s.counters['modifierRerolls'] ?? 0) + 1;
    const nodes = { ...s.map.nodes };
    for (const node of Object.values(s.map.nodes)) {
      if (node.visited || node.kind === 'BOSS') continue;
      if (node.kind !== 'WORD' && node.kind !== 'ELITE') continue;
      nodes[node.id] = {
        ...node,
        modifiers: rollModifiers(s.seed, `${node.id}:reroll${roll}`, node.actIndex, node.kind),
      };
    }
    return {
      state: {
        ...s,
        map: { ...s.map, nodes },
        counters: { ...s.counters, modifierRerolls: roll },
      },
      events: [],
    };
  }

  if ('slot_delta' in effect) {
    const delta = effect['slot_delta'] as number;
    return { state: { ...s, bonusRelicSlots: s.bonusRelicSlots + delta }, events: [] };
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
    if (spec.scope === 'act_first_letters') {
      return {
        state: { ...s, actEffects: { ...s.actEffects, firstLettersRevealed: true } },
        events: [],
      };
    }
    return { state: { ...s, counters: { ...s.counters, [`reveal:${spec.scope}`]: 1 } }, events: [] };
  }
  // Nothing in `effect_vocabulary` reaches here any more. An unknown verb is
  // recorded rather than silently dropped, so a new one added to events.json
  // without an implementation shows up in the report instead of doing nothing.
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
  if (s.pendingReplace) return { state: { ...s, phase: 'REPLACE' }, events };
  if (s.pendingOffer) return { state: { ...s, phase: 'REWARD' }, events };

  const current = s.map.currentId ? s.map.nodes[s.map.currentId] : null;
  const nextIds = current ? current.next : s.map.available;

  if (nextIds.length > 0) {
    return { state: { ...s, phase: 'MAP', map: { ...s.map, available: nextIds } }, events };
  }
  return endAct(s, events, cfg);
}

/**
 * The act's last node is behind us.
 *
 * v1.3 stopped here on an ACT_END receipt, because the act converted its
 * leftover guesses to gold and that trade was the moment a player learned what
 * hoarding was worth. §2.1 has no leftover and no conversion — the bankroll
 * simply continues — so there is nothing to show and the run walks straight on
 * to the next act's map.
 */
function endAct(s: GameState, events: GameEvent[], cfg: Readonly<GameConfig>): ReduceResult {
  const out = [...events, { type: 'ACT_ENDED' as const, actIndex: s.actIndex }];

  if (s.actIndex === 2) {
    return {
      state: { ...s, phase: 'VICTORY', outcome: { result: 'WIN', cause: null } },
      events: [...out, { type: 'RUN_ENDED', outcome: 'WIN', cause: null }],
    };
  }
  const started = startAct(s, (s.actIndex + 1) as 0 | 1 | 2, cfg);
  return { state: started.state, events: [...out, ...started.events] };
}

// ------------------------------------------------------- emergency and death

/**
 * §3.3 — "the player may decline both". Also §6.2's exit from a full board:
 * declining the replacement drops the incoming relic and keeps the five held.
 */
function declineOffer(s: GameState, cfg: Readonly<GameConfig>): ReduceResult {
  return advance({ ...s, pendingOffer: null, pendingReplace: null }, [], cfg);
}

/**
 * §2.4 — the offer is mandatory UI, not optional. "The player must always see
 * the exit they did or did not buy", including when they cannot afford it,
 * which is a different death from declining one they could.
 *
 * The Gauntlet no longer has its own pool (§8.3), so its words reach the ladder
 * like any other. v1.3 died outright inside it because the separate 14-guess
 * pool had no valve attached.
 */
function offerEmergency(
  s: GameState,
  events: GameEvent[],
  cfg: Readonly<GameConfig>,
): ReduceResult {
  const cost = bankEmergencyCost(s, cfg);
  if (cost === null) return reviveOrDie(s, 'BANKROLL_EXHAUSTED', events, cfg);

  const affordable = s.gold >= cost;
  const out = [...events, { type: 'EMERGENCY_OFFERED' as const, cost, affordable }];
  if (!affordable) return reviveOrDie(s, 'EMERGENCY_UNAFFORDABLE', out, cfg);

  return { state: { ...s, phase: 'EMERGENCY' }, events: out };
}

function buyEmergency(s: GameState, cfg: Readonly<GameConfig>): ReduceResult {
  const cost = bankEmergencyCost(s, cfg)!;
  const bought = bankBuyEmergency(s, cfg);
  if (!bought) {
    return { state: s, events: [], error: { code: 'UNAFFORDABLE', message: `${cost}g needed.` } };
  }
  return {
    state: { ...bought.state, phase: 'WORD' },
    events: [{ type: 'EMERGENCY_BOUGHT', cost }, ...bought.events],
  };
}

/**
 * The last thing between a spent bankroll and the end of the run.
 *
 * `RL.30` Ouroboros and `EV.08` The Undertaker both return you from zero, and
 * both are explicitly ordered AFTER the §2.4 offer: a player who can pay gold
 * pays gold first and keeps the revival. That ordering is why the zero-crossing
 * is resolved here rather than as an `onBankrollChange` reaction inside
 * `spendGuess` — only this path knows whether the offer was made, taken or
 * refused, and a hook firing on the decrement would fire before it.
 *
 * Ouroboros goes first: it is a relic the player chose to carry, and the
 * Undertaker is a one-shot an event left behind. Whichever fires, the word
 * continues rather than restarting.
 */
function reviveOrDie(
  s: GameState,
  cause: 'BANKROLL_EXHAUSTED' | 'EMERGENCY_DECLINED' | 'EMERGENCY_UNAFFORDABLE',
  events: GameEvent[],
  cfg: Readonly<GameConfig>,
): ReduceResult {
  const relic = resolveHook(s, 'onBankrollChange', { delta: 0, bankroll: s.bankroll }, cfg);
  if (relic.length > 0) {
    const revived = applyEffects(s, relic, cfg);
    if (revived.state.bankroll > 0) {
      return {
        state: { ...revived.state, phase: s.word ? 'WORD' : revived.state.phase, ouroborosSpent: true },
        events: [
          ...events,
          ...revived.events,
          { type: 'OUROBOROS_TRIGGERED', bankroll: revived.state.bankroll },
        ],
      };
    }
  }

  if (s.revivalBankroll !== null && s.revivalBankroll > 0) {
    const granted = grant({ ...s, revivalBankroll: null }, s.revivalBankroll, 'EV.08', cfg);
    return {
      state: { ...granted.state, phase: s.word ? 'WORD' : granted.state.phase },
      events: [...events, ...granted.events],
    };
  }

  return die(s, cause, cfg, events);
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

  // R-031. An activation that produces nothing is REFUSED, not consumed.
  //
  // The cost was charged before the handler ran, so naming a letter the Auditor
  // cannot answer — one already tried — took 5g and returned silently: no
  // stamp, no error, no way to tell it from a use that worked. R-015 already
  // says an unaffordable activation is refused rather than consumed; this is
  // the same rule for a different reason, and it belongs in the engine so no
  // relic has to remember it.
  if (effects.length === 0) {
    return {
      state: s,
      events: [],
      error: { code: 'NO_EFFECT', message: 'Nothing to learn from that.' },
    };
  }

  const events: GameEvent[] = [
    // A relic is not a consumable. The event said CONSUMABLE_USED for both,
    // which is what the relic chips read to know they fired.
    holder.code.startsWith('CN.')
      ? { type: 'CONSUMABLE_USED', code: holder.code }
      : { type: 'ACTIVATION_FIRED', code: holder.code },
  ];

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
      [{ kind: 'BANKROLL', delta: -activation.cost.guesses, reason: holder.code }],
      cfg,
    );
    next = paid.state;
    events.push(...paid.events);
  }

  const applied = applyEffects(next, effects, cfg);
  next = applied.state;
  events.push(...applied.events);

  // Spending a guess can empty the bankroll. §2.4's offer is mandatory even
  // when the player emptied it themselves.
  if (next.word && !next.word.solved.every(Boolean) && next.bankroll <= 0) {
    return offerEmergency(next, events, cfg);
  }
  return { state: next, events };
}

// ----------------------------------------------------------------- effects

/**
 * The only writer of state fields. Technical brief §2.4.
 *
 * BANKROLL and GOLD effects re-enter the hook system for onBankrollChange /
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
    case 'BANKROLL': {
      const moved =
        effect.delta >= 0
          ? grant(s, effect.delta, effect.reason, cfg)
          : charge(s, -effect.delta, effect.reason);
      if (moved.events.length === 0) return moved;
      // A reaction to reaching zero is NOT resolved here: §2.4's offer has to
      // come first, and `reviveOrDie` is the only path that knows whether it
      // did. Firing Ouroboros from the decrement would jump the queue.
      if (moved.state.bankroll <= 0) return moved;
      const reactions = applyEffects(
        moved.state,
        resolveHook(
          moved.state,
          'onBankrollChange',
          { delta: effect.delta, bankroll: moved.state.bankroll },
          cfg,
        ),
        cfg,
        depth + 1,
      );
      return { state: reactions.state, events: [...moved.events, ...reactions.events] };
    }

    // §2.5's clamps are applied in `payWord`, which collects every bid before
    // deciding. A bid that reaches here fired outside a payout and does nothing
    // — deliberately silent rather than an error, because a payout relic held
    // through a failed word is not a bug.
    case 'PAYOUT_BONUS':
    case 'PAYOUT_DISCOUNT':
      return { state: s, events: [] };

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

    case 'PRESET_TILE': {
      if (!s.word) return { state: s, events: [] };
      const index = effect.index ?? drawPresetIndex(s);
      if (index === null) return { state: s, events: [] };
      const letter = effect.letter ?? s.word.solutions[0]![index]!;
      if (s.word.presetTiles.some((p) => p.index === index)) return { state: s, events: [] };
      // Solution 0. Under Mirror that means a reveal buys a letter of ONE twin,
      // which is a live economic question (§13 I-28) but not a licence to claim
      // the letter of the other — that was the R-036 bug.
      return {
        state: withWord(s, (w) => ({
          ...w,
          presetTiles: [...w.presetTiles, { index, letter, solutionIndex: 0 }],
        })),
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
        events: [{ type: 'LETTER_STAMPED', letter: effect.letter, present }],
      };
    }

    case 'GRANT_RELIC': {
      if (s.relics.some((r) => r.code === effect.code)) return { state: s, events: [] };
      // §6.2 — five slots, hard cap. A sixth is held in `pendingReplace` until
      // the player names which of the five it destroys. That is the rule that
      // "turns every subsequent offer into a comparison", so it must not
      // silently drop the relic and it must not silently exceed the cap.
      if (heldRelics(s).length >= relicSlots(s, cfg)) {
        return { state: { ...s, pendingReplace: { code: effect.code } }, events: [] };
      }
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

/**
 * The relics §6.2's five slots count.
 *
 * The character innate is a hidden registry entry granted at run start — it is
 * in `state.relics` so its hooks fire in acquisition order, but it never
 * occupied a slot and must not now that slots are scarce. A Linguist who could
 * hold four bought relics to a Gambler's five would be a balance change nobody
 * wrote down.
 */
/**
 * §6.2's five, plus anything `EV.13` The Sixth Shelf added. Read this, never
 * `cfg.relicSlots`, or the shelf is a 4-bankroll purchase that does nothing.
 */
export function relicSlots(s: GameState, cfg: Readonly<GameConfig> = CONFIG): number {
  return cfg.relicSlots + s.bonusRelicSlots;
}

/**
 * The modifiers a word actually carries: the node's own, plus anything §6.8's
 * events forced on it, minus everything if `EV.12` B was paid.
 *
 * Suppression wins over forcing, and it is the later purchase in every ordering
 * that can occur — you cannot pay the Compositor to clear the act and then have
 * an earlier Liar's Bargain re-impose itself, because the Bargain is already in
 * `forcedModifiers` when the payment lands.
 */
function applyActEffects(s: GameState, nodeModifiers: readonly ModifierId[]): ModifierId[] {
  if (s.actEffects.modifiersSuppressed) return [];
  const out = [...nodeModifiers];
  for (const forced of s.actEffects.forcedModifiers) {
    if (forced.words !== null && forced.words <= 0) continue;
    if (!out.includes(forced.id)) out.push(forced.id);
  }
  return out;
}

/** One word has passed: count down the word-limited forced modifiers. */
function tickActEffects(effects: GameState['actEffects']): GameState['actEffects'] {
  if (effects.forcedModifiers.length === 0) return effects;
  const forcedModifiers = effects.forcedModifiers
    .map((f) => (f.words === null ? f : { ...f, words: f.words - 1 }))
    .filter((f) => f.words === null || f.words >= 0);
  return { ...effects, forcedModifiers };
}

export function heldRelics(s: GameState): readonly RelicInstance[] {
  return s.relics.filter((r) => r.code !== s.characterCode);
}

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
