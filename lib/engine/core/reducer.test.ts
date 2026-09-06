import { describe, expect, it } from 'vitest';
import { CONFIG, withConfig } from './config';
import { EffectDepthError } from './effects';
import { resolveHook } from './hooks';
import { applyEffects, canDispatch, emergencyCost, initialState, reduce } from './reducer';
import { refillPool } from './pool';
import { deserialize, serialize } from './serialize';
import { SAVE_VERSION } from './state';
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

  it('a granted guess may push the pool above poolMax (R-024)', () => {
    // This asserted the opposite until R-024. Clamping made every mechanic that
    // GRANTS guesses a no-op at full pool — the forge conversion, the Decanter,
    // the Infirmary, Blindfold's payout, the Vault (§13 I-15) — and did it
    // silently, in exactly the situation you would want the grant.
    const s = { ...start(), pool: 5, poolMax: 10 };
    const out = applyEffects(s, [{ kind: 'POOL', delta: 99, reason: 'test' }]);
    expect(out.state.pool).toBe(104);
    expect(out.state.poolMax, 'a grant does not raise the cap').toBe(10);
  });

  it('poolMax is still the refill target at act start', () => {
    // The other half of R-024: the cap governs the REFILL. An overflow is a
    // thing you carry, not a new ceiling.
    const s = { ...start(), pool: 40, poolMax: 10 };
    const refilled = refillPool(s, 10, 'act start');
    expect(refilled.state.pool).toBe(10);
  });

  it('POOL_MAX cuts the live pool too, clamped at 1 (§13 I-07 / ADR-0004)', () => {
    const s = { ...start(), pool: 2, poolMax: 20 };
    const out = applyEffects(s, [{ kind: 'POOL_MAX', delta: -3, reason: 'RL.31' }]);
    expect(out.state.poolMax).toBe(17);
    expect(out.state.pool).toBe(1);
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
        { instanceId: 'RL.23#5', code: 'RL.23', state: {}, acquiredAt: 5, upgraded: false },
        { instanceId: 'RL.13#2', code: 'RL.13', state: {}, acquiredAt: 2, upgraded: false },
      ],
      word: toFirstWord(start()).word,
    };
    const effects = resolveHook(s, 'onGuessSubmit', {
      guess: 'CRANE',
      turn: 0,
      newUniqueLetters: 5,
    });
    // RL.13 was acquired first, so its refund is collected before Tin Cup's gold.
    expect(effects[0]!.kind).toBe('REFUND');
    expect(effects[1]!.kind).toBe('GOLD');
  });
});

describe('E-10 — the emergency ladder', () => {
  it('escalates 25 / 50 / 100 and then runs out', () => {
    const s = start();
    expect(emergencyCost({ ...s, emergencyPurchasesThisAct: 0 }, CONFIG)).toBe(25);
    expect(emergencyCost({ ...s, emergencyPurchasesThisAct: 1 }, CONFIG)).toBe(50);
    expect(emergencyCost({ ...s, emergencyPurchasesThisAct: 2 }, CONFIG)).toBe(100);
    expect(emergencyCost({ ...s, emergencyPurchasesThisAct: 3 }, CONFIG)).toBeNull();
  });

  /** MECHANICS.md §2.3: the offer is mandatory, not optional UI. */
  it('always shows the offer before death when it is affordable', () => {
    let s = toFirstWord({ ...start(), gold: 500 });
    s = { ...s, pool: 1, poolMax: 22 };
    const wrong = s.word!.solutions[0] === 'SLATE' ? 'CRANE' : 'SLATE';
    const out = reduce(s, { type: 'SUBMIT_GUESS', guess: wrong });
    expect(out.state.phase).toBe('EMERGENCY');
    expect(out.events.some((e) => e.type === 'EMERGENCY_OFFERED')).toBe(true);
  });

  it('distinguishes declining from being unable to pay', () => {
    let s = toFirstWord({ ...start(), gold: 500 });
    s = { ...s, pool: 1 };
    const wrong = s.word!.solutions[0] === 'SLATE' ? 'CRANE' : 'SLATE';
    const offered = reduce(s, { type: 'SUBMIT_GUESS', guess: wrong }).state;
    expect(reduce(offered, { type: 'DECLINE_EMERGENCY' }).state.outcome?.cause).toBe(
      'EMERGENCY_DECLINED',
    );

    let broke = toFirstWord({ ...start(), gold: 0 });
    broke = { ...broke, pool: 1 };
    const dead = reduce(broke, { type: 'SUBMIT_GUESS', guess: wrong });
    expect(dead.state.outcome?.cause).toBe('EMERGENCY_UNAFFORDABLE');
    expect(dead.events.some((e) => e.type === 'EMERGENCY_OFFERED')).toBe(true);
  });

  it('buying returns a guess and charges the ladder price', () => {
    let s = toFirstWord({ ...start(), gold: 500 });
    s = { ...s, pool: 1 };
    const wrong = s.word!.solutions[0] === 'SLATE' ? 'CRANE' : 'SLATE';
    const offered = reduce(s, { type: 'SUBMIT_GUESS', guess: wrong }).state;
    const bought = reduce(offered, { type: 'BUY_EMERGENCY' }).state;
    expect(bought.gold).toBe(offered.gold - 25);
    expect(bought.pool).toBe(1);
    expect(bought.phase).toBe('WORD');
  });

  it('the Gauntlet has no ladder — its pool is fixed and separate', () => {
    const base = toFirstWord(start());
    const s: GameState = {
      ...base,
      gold: 500,
      gauntlet: { pool: 1, wordIndex: 0 },
      word: { ...base.word!, poolSource: 'GAUNTLET' },
    };
    const wrong = s.word!.solutions[0] === 'SLATE' ? 'CRANE' : 'SLATE';
    const out = reduce(s, { type: 'SUBMIT_GUESS', guess: wrong });
    expect(out.state.outcome?.cause).toBe('GAUNTLET');
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
  it('backfills a v1 forge with the offer R-035 added', () => {
    const s = start();
    const legacy = JSON.parse(serialize(s)) as Record<string, unknown>;
    legacy['version'] = 1;
    legacy['phase'] = 'FORGE';
    legacy['forge'] = { nodeId: 'n1', operationsLeft: 1, upgraded: [] };
    const loaded = deserialize(JSON.stringify(legacy));
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(SAVE_VERSION);
    expect(Array.isArray(loaded!.forge!.candidates)).toBe(true);
  });

  it('leaves a v1 save with no forge alone', () => {
    const legacy = JSON.parse(serialize(start())) as Record<string, unknown>;
    legacy['version'] = 1;
    const loaded = deserialize(JSON.stringify(legacy));
    expect(loaded!.version).toBe(SAVE_VERSION);
    expect(loaded!.forge).toBeNull();
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
    const tight = withConfig({ acts: [{ ...CONFIG.acts[0], pool: 5 }, CONFIG.acts[1], CONFIG.acts[2]] });
    const s = reduce(initialState(SEED, 'CH.01'), script[0]!, tight).state;
    expect(s.poolMax).toBe(5 + 2); // CH.01's +2
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
      else if (s.phase === 'REWARD') s = reduce(s, { type: 'SKIP_OFFER' }).state;
      else if (s.phase === 'WORD') s = reduce(s, { type: 'SUBMIT_GUESS', guess: s.word!.solutions[0]! }).state;
      else s = reduce(s, { type: 'ADVANCE' }).state;
    }
    expect(new Set(s.usedSolutions).size).toBe(s.usedSolutions.length);
  });
});
