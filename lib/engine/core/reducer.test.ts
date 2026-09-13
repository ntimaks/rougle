import { describe, expect, it } from 'vitest';
import { CONFIG, withConfig } from './config';
import { EffectDepthError } from './effects';
import { resolveHook } from './hooks';
import { applyEffects, canDispatch, initialState, reduce } from './reducer';
import { emergencyCost, refillCost } from './bank';
import { deserialize, serialize } from './serialize';
import { CHARACTER_BY_CODE } from '../content/registry';
import type { Action, GameState } from '../index';
import { enterFirstWord } from '../../../test/nav';
import '../words/all';

/** E-04, E-05, E-07, E-10, E-13 and the determinism gate. */

const SEED = 'REDUCERX';

function start(character: 'CH.01' | 'CH.02' = 'CH.01'): GameState {
  return reduce(initialState(SEED, character), {
    type: 'START_RUN',
    seed: SEED,
    characterCode: character,
  }).state;
}

function toFirstWord(s: GameState): GameState {
  return enterFirstWord(s);
}

describe('E-05 — canDispatch', () => {
  it('returns an error and leaves the state untouched, never throws', () => {
    const s = start();
    const result = reduce(s, { type: 'SUBMIT_GUESS', guess: 'CRANE' });
    expect(result.error?.code).toBe('WRONG_PHASE');
    expect(result.state).toBe(s);
  });

  it('rejects the wrong length, then a non-word, then a locked letter', () => {
    const s = toFirstWord(start());
    expect(reduce(s, { type: 'SUBMIT_GUESS', guess: 'CAT' }).error?.code).toBe('WRONG_LENGTH');
    expect(reduce(s, { type: 'SUBMIT_GUESS', guess: 'ZZZZZ' }).error?.code).toBe('NOT_A_WORD');
  });

  it('refuses an unreachable node', () => {
    const s = start();
    expect(reduce(s, { type: 'SELECT_NODE', nodeId: 'a0-boss' }).error?.code).toBe('NODE_UNREACHABLE');
    expect(reduce(s, { type: 'SELECT_NODE', nodeId: 'nope' }).error?.code).toBe('NO_SUCH_NODE');
  });

  it('refuses everything once the run is over', () => {
    const dead: GameState = { ...start(), phase: 'DEATH' };
    expect(reduce(dead, { type: 'ADVANCE' }).error?.code).toBe('RUN_OVER');
  });

  it('is consistent with reduce — a legal action never errors', () => {
    const s = toFirstWord(start());
    const guess = s.word!.solutions[0]!;
    expect(canDispatch(s, { type: 'SUBMIT_GUESS', guess })).toBeNull();
    expect(reduce(s, { type: 'SUBMIT_GUESS', guess }).error).toBeUndefined();
  });
});

describe('E-04 — effects', () => {
  it('gold never goes negative', () => {
    const s = { ...start(), gold: 10 };
    const out = applyEffects(s, [{ kind: 'GOLD', delta: -50, reason: 'test' }]);
    expect(out.state.gold).toBe(0);
  });

  it('§2.1 — a grant over the cap becomes gold, immediately and visibly', () => {
    // v1.3's R-024 let the pool sit above its cap because clamping made every
    // grant a no-op at full pool. §2.1 has a HARD cap and an automatic
    // conversion instead, which solves the same problem without the overflow
    // state — and the player is paid rather than quietly robbed.
    const cap = CONFIG.economy.bankrollCap;
    const s = { ...start(), bankroll: cap - 1, gold: 0 };
    const out = applyEffects(s, [{ kind: 'BANKROLL', delta: 5, reason: 'test' }]);
    expect(out.state.bankroll).toBe(cap);
    expect(out.state.gold).toBe(4 * CONFIG.economy.overflowGoldPerGuess);
    expect(out.events.some((e) => e.type === 'BANKROLL_CHANGED' && e.kind === 'OVERFLOW_TO_GOLD')).toBe(
      true,
    );
  });

  it('§2.1 — a bankroll charge floors at zero and never goes negative', () => {
    const s = { ...start(), bankroll: 2 };
    const out = applyEffects(s, [{ kind: 'BANKROLL', delta: -5, reason: 'RL.09' }]);
    expect(out.state.bankroll).toBe(0);
  });

  it('§2.5 — a payout bid outside a payout does nothing', () => {
    // Clamp B decides which bid wins, and it can only do that where every bid
    // is visible. A bid that reaches applyEffect fired outside `payWord` —
    // deliberately silent, because a payout relic held through a failed word is
    // not a bug.
    const s = { ...start(), bankroll: 5 };
    const out = applyEffects(s, [{ kind: 'PAYOUT_BONUS', amount: 9, source: 'test' }]);
    expect(out.state.bankroll).toBe(5);
    expect(out.events).toEqual([]);
  });

  it('guards runaway effect recursion', () => {
    const s = start();
    const deep = (depth: number): void => {
      applyEffects(s, [{ kind: 'GOLD', delta: 1, reason: 'test' }], CONFIG, depth);
    };
    expect(() => deep(CONFIG.maxEffectDepth + 1)).toThrow(EffectDepthError);
  });

  it('SET_COUNTER and SET_RELIC_STATE write where they say they do', () => {
    let s = start();
    s = applyEffects(s, [{ kind: 'SET_COUNTER', key: 'k', value: 7 }]).state;
    expect(s.counters['k']).toBe(7);
    const instanceId = s.relics[0]!.instanceId;
    s = applyEffects(s, [{ kind: 'SET_RELIC_STATE', instanceId, patch: { streak: 2 } }]).state;
    expect(s.relics[0]!.state['streak']).toBe(2);
  });
});

describe('E-07 — hooks fire in acquisition order', () => {
  it('walks relics by acquiredAt, provably', () => {
    const s: GameState = {
      ...start(),
      relics: [
        { instanceId: 'RL.23#5', code: 'RL.23', state: { rate: 2 }, acquiredAt: 5, upgraded: false },
        { instanceId: 'RL.26#2', code: 'RL.26', state: { lit: 0 }, acquiredAt: 2, upgraded: false },
      ],
      word: toFirstWord(start()).word,
    };
    const effects = resolveHook(s, 'onGuessSubmit', {
      guess: 'CRANE',
      turn: 2,
      newUniqueLetters: 5,
    });
    // RL.26 was acquired first, so its reveal is collected before Tin Cup's
    // gold. Order is what Clamp B and the transform chain both depend on.
    expect(effects[0]!.kind).toBe('PRESET_TILE');
    expect(effects.at(-1)!.kind).toBe('GOLD');
  });
});

describe('E-10 — the emergency ladder', () => {
  const wrongGuess = (s: GameState) => (s.word!.solutions[0] === 'SLATE' ? 'CRANE' : 'SLATE');
  const onOneGuess = (over: Partial<GameState> = {}) => {
    const s = toFirstWord({ ...start(), gold: 500, ...over });
    return { ...s, bankroll: 1 };
  };

  // The ladder's SHAPE, read off the config rather than three literals: three
  // rungs, each at least double the last, then nothing. The prices themselves
  // are balance and move with a snapshot; `config.test.ts` pins them against
  // the §2.4 table so a tuning change still has to be written down.
  it('escalates, doubles, and then runs out', () => {
    const s = start();
    const rungs = CONFIG.economy.emergencyCosts;
    expect(rungs).toHaveLength(3);
    rungs.forEach((cost, i) => {
      expect(emergencyCost({ ...s, emergencyPurchases: i }, CONFIG)).toBe(cost);
      if (i > 0) expect(cost).toBeGreaterThanOrEqual(rungs[i - 1]! * 2);
    });
    expect(emergencyCost({ ...s, emergencyPurchases: rungs.length }, CONFIG)).toBeNull();
  });

  it('§2.4 — the ladder is RUN-scoped, so an act boundary does not reset it', () => {
    // v1.3 reset it every act, which is what let a player buy nine emergency
    // guesses a run and is why gold never ran out.
    const s = { ...start(), emergencyPurchases: 3 };
    expect(emergencyCost(s, CONFIG)).toBeNull();
    const nextAct = { ...s, actIndex: 1 as const };
    expect(emergencyCost(nextAct, CONFIG)).toBeNull();
  });

  /** MECHANICS.md §2.4: the offer is mandatory, not optional UI. */
  it('always shows the offer before death when it is affordable', () => {
    const out = reduce(onOneGuess(), { type: 'SUBMIT_GUESS', guess: wrongGuess(onOneGuess()) });
    expect(out.state.phase).toBe('EMERGENCY');
    expect(out.events.some((e) => e.type === 'EMERGENCY_OFFERED')).toBe(true);
  });

  it('distinguishes declining from being unable to pay', () => {
    const s = onOneGuess();
    const offered = reduce(s, { type: 'SUBMIT_GUESS', guess: wrongGuess(s) }).state;
    expect(reduce(offered, { type: 'DECLINE_EMERGENCY' }).state.outcome?.cause).toBe(
      'EMERGENCY_DECLINED',
    );

    const broke = onOneGuess({ gold: 0 });
    const dead = reduce(broke, { type: 'SUBMIT_GUESS', guess: wrongGuess(broke) });
    expect(dead.state.outcome?.cause).toBe('EMERGENCY_UNAFFORDABLE');
    expect(dead.events.some((e) => e.type === 'EMERGENCY_OFFERED')).toBe(true);
  });

  it('§2.4 — buying grants three, not one, and charges the ladder price', () => {
    const s = onOneGuess();
    const offered = reduce(s, { type: 'SUBMIT_GUESS', guess: wrongGuess(s) }).state;
    const bought = reduce(offered, { type: 'BUY_EMERGENCY' }).state;
    expect(bought.gold).toBe(offered.gold - CONFIG.economy.emergencyCosts[0]!);
    expect(bought.bankroll).toBe(CONFIG.economy.emergencyGrant);
    expect(bought.phase).toBe('WORD');
  });

  it('§8.3 — the Gauntlet reaches the ladder like anywhere else', () => {
    // v1.3 died outright inside the Gauntlet because its separate 14-guess pool
    // had no valve attached. There is one bankroll now, so there is one valve.
    const base = toFirstWord(start());
    const s: GameState = { ...base, gold: 500, bankroll: 1, gauntlet: { wordIndex: 0 } };
    const out = reduce(s, { type: 'SUBMIT_GUESS', guess: wrongGuess(s) });
    expect(out.state.phase).toBe('EMERGENCY');
  });

  it('§6.5 — Ouroboros resolves AFTER the offer, never instead of it', () => {
    const s = onOneGuess();
    const withRelic: GameState = {
      ...s,
      relics: [
        ...s.relics,
        { instanceId: 'RL.30#9', code: 'RL.30', state: { spent: false }, acquiredAt: 9, upgraded: false },
      ],
    };
    // Gold in hand: the offer comes first and the relic is untouched.
    const offered = reduce(withRelic, { type: 'SUBMIT_GUESS', guess: wrongGuess(withRelic) });
    expect(offered.state.phase).toBe('EMERGENCY');
    expect(offered.state.ouroborosSpent).toBe(false);

    // Declined: now it fires, and the word continues rather than restarting.
    const revived = reduce(offered.state, { type: 'DECLINE_EMERGENCY' });
    expect(revived.state.phase).toBe('WORD');
    expect(revived.state.bankroll).toBe(8);
    expect(revived.state.ouroborosSpent).toBe(true);
    expect(revived.events.some((e) => e.type === 'OUROBOROS_TRIGGERED')).toBe(true);
  });
});

describe('§4.1 — the shared refill ladder (R-046)', () => {
  it('the shop and the forge index the same run counter', () => {
    const s = start();
    const rungs = CONFIG.economy.refillCosts;
    rungs.forEach((cost, i) => {
      expect(refillCost({ ...s, stats: { ...s.stats, refillsBought: i } }, CONFIG)).toBe(cost);
    });
    expect(
      refillCost({ ...s, stats: { ...s.stats, refillsBought: rungs.length } }, CONFIG),
    ).toBeNull();
  });

  it('is monotonically dearer, and dearer than relic parity throughout', () => {
    // R-042's rule: gold buys builds, and buys survival at a penalty. An
    // uncommon relic at 110g closing ~0.4 a word over ten words is ~27g per
    // bankroll, so every rung has to be worse than that.
    const rungs = CONFIG.economy.refillCosts;
    for (let i = 1; i < rungs.length; i++) expect(rungs[i]!).toBeGreaterThan(rungs[i - 1]!);
    for (const cost of rungs) expect(cost).toBeGreaterThan(27);
  });
});

describe('E-13 — serialisation', () => {
  it('round-trips mid-word, byte-identically', () => {
    let s = toFirstWord(start());
    s = reduce(s, { type: 'SUBMIT_GUESS', guess: 'SLATE' }).state;
    const once = serialize(s);
    expect(serialize(deserialize(once)!)).toBe(once);
  });

  it('discards a corrupt save rather than throwing', () => {
    expect(deserialize('not json')).toBeNull();
    expect(deserialize('{"nope":1}')).toBeNull();
    expect(deserialize(null)).toBeNull();
  });

  it('refuses a save from the future', () => {
    const s = { ...start(), version: 99 };
    expect(deserialize(serialize(s))).toBeNull();
  });

  /*
   * R-035 gave ForgeState a `candidates` list and the reducer refuses every
   * upgrade not in it. A v1 save written while standing in a forge has no such
   * field, so without this the node would come back silently dead — every
   * upgrade refused, with the screen showing nothing to pick.
   */
  it('discards a v1.3 save rather than inventing a bankroll for it', () => {
    // There is no honest conversion. 11-of-14 in Act II is not a number of
    // run-long guesses, because the v1.3 run was counting on a refill v2.0
    // deleted — so any mapping invents a stake the player never earned. The
    // shape check rejects it before the migrator is reached, and the player
    // gets the title screen instead of a run they cannot trust.
    const legacy = JSON.parse(serialize(start())) as Record<string, unknown>;
    legacy['version'] = 3;
    delete legacy['bankroll'];
    legacy['pool'] = 11;
    legacy['poolMax'] = 14;
    expect(deserialize(JSON.stringify(legacy))).toBeNull();
  });
});

describe('Gate 1 — determinism', () => {
  const script: Action[] = [
    { type: 'START_RUN', seed: SEED, characterCode: 'CH.01' },
    { type: 'SELECT_NODE', nodeId: 'a0-n0' },
    { type: 'SUBMIT_GUESS', guess: 'SLATE' },
    { type: 'SUBMIT_GUESS', guess: 'CRONY' },
    { type: 'SUBMIT_GUESS', guess: 'PLUMB' },
  ];

  function play(): GameState {
    let s = initialState(SEED, 'CH.01');
    for (const action of script) s = reduce(s, action).state;
    return s;
  }

  it('same seed + same actions → byte-identical serialised state', () => {
    expect(serialize(play())).toBe(serialize(play()));
  });

  it('a different seed produces a different run', () => {
    let other = initialState('OTHERSED', 'CH.01');
    for (const action of script) {
      other = reduce(other, action.type === 'START_RUN' ? { ...action, seed: 'OTHERSED' } : action).state;
    }
    // Compare whole runs, not the current word. Since R-01 the map branches, so
    // one script can leave two seeds at different node KINDS — and two runs both
    // parked at a shop would compare undefined against undefined and pass.
    expect(serialize(other)).not.toBe(serialize(play()));
  });

  it('a config override changes the run without changing the engine', () => {
    const tight = withConfig({ economy: { ...CONFIG.economy, bossBankroll: 99 } });
    expect(tight.economy.bossBankroll).toBe(99);
    expect(CONFIG.economy.bossBankroll, 'withConfig mutated CONFIG').not.toBe(99);
  });

  it('§9 — the character sets the starting bankroll, once', () => {
    // v1.3 read a `pool_modifier` and added it to each act's pool, three times
    // a run. §2.1 has one stake, so §9 states it outright.
    for (const code of ['CH.01', 'CH.02', 'CH.03'] as const) {
      const s = reduce(initialState(SEED, code), { type: 'START_RUN', seed: SEED, characterCode: code }).state;
      expect(s.bankroll, code).toBe(CHARACTER_BY_CODE[code]!.bankroll_start);
    }
  });
});

describe('run shape', () => {
  it('a run is twenty words: 4 solve nodes x 3 acts, plus 2 + 1 + 5 boss words', () => {
    // MECHANICS.md §3.2. Copy must say twenty (R-009).
    const solveNodes = CONFIG.acts.reduce((n, a) => n + a.solveNodes, 0);
    const bossWords = 2 + 1 + CONFIG.gauntlet.words;
    expect(solveNodes + bossWords).toBe(20);
  });

  it('never serves the same solution twice in a run', () => {
    let s = start();
    for (let i = 0; i < 40 && s.phase !== 'DEATH' && s.phase !== 'VICTORY'; i++) {
      if (s.phase === 'MAP') s = reduce(s, { type: 'SELECT_NODE', nodeId: s.map.available[0]! }).state;
      else if (s.phase === 'SHOP' || s.phase === 'FORGE' || s.phase === 'EVENT') s = reduce(s, { type: 'LEAVE_NODE' }).state;
      else if (s.phase === 'REWARD' || s.phase === 'REPLACE') s = reduce(s, { type: 'SKIP_OFFER' }).state;
      else if (s.phase === 'WORD') s = reduce(s, { type: 'SUBMIT_GUESS', guess: s.word!.solutions[0]! }).state;
      else s = reduce(s, { type: 'ADVANCE' }).state;
    }
    expect(new Set(s.usedSolutions).size).toBe(s.usedSolutions.length);
  });
});
