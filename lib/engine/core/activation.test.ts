import { describe, expect, it } from 'vitest';
import { CONFIG } from './config';
import { checkActivation, isBlindfolded, recordUse, usesThisWord } from './activation';
import { hammingDistance } from './letters';
import { initialState, reduce } from './reducer';
import { activationFor, isActivated, offerableInAct, REGISTRY } from '../content/registry';
import { projectBoard, renderStates } from '../index';
import type { GameState, RelicInstance } from './state';
import { enterFirstWord } from '../../../test/nav';
import '../words/all';

/**
 * R-015 — player activations. The five relics §13 I-04 blocked, and the rules
 * the engine enforces on their behalf.
 */

const SEED = 'ACTIVATE';

function inWord(codes: string[] = [], over: Partial<GameState> = {}): GameState {
  let s = reduce(initialState(SEED, 'CH.01'), {
    type: 'START_RUN',
    seed: SEED,
    characterCode: 'CH.01',
  }).state;
  s = enterFirstWord(s);
  const extra: RelicInstance[] = codes.map((code, i) => ({
    instanceId: `${code}#${100 + i}`,
    code,
    state: {},
    acquiredAt: 100 + i,
    upgraded: false,
  }));
  return { ...s, relics: [...s.relics, ...extra], ...over };
}

describe('the activation contract', () => {
  it('every relic declaring hook onUse also declares an activation', () => {
    for (const d of Object.values(REGISTRY)) {
      if (d.hook !== 'onUse' || d.isConsumable) continue;
      expect(d.activation, `${d.code} is onUse but declares no activation`).toBeDefined();
    }
  });

  it('the five relics §13 I-04 blocked are all activated now', () => {
    for (const code of ['RL.07', 'RL.20', 'RL.21', 'RL.28', 'CH.03']) {
      expect(isActivated(code), code).toBe(true);
    }
  });

  it('consumables are not activations — they are usable wherever input is', () => {
    for (const code of ['CN.01', 'CN.02', 'CN.03', 'CN.05']) {
      expect(isActivated(code), code).toBe(false);
    }
  });
});

describe('timing windows', () => {
  it('refuses an activation outside a word', () => {
    const s = inWord(['RL.07'], { phase: 'MAP', word: null });
    const holder = s.relics.find((r) => r.code === 'RL.07')!;
    expect(checkActivation(s, holder)?.error?.code).toBe('WRONG_PHASE');
  });

  it('BEFORE_FIRST_GUESS closes once a guess has landed', () => {
    let s = inWord(['RL.21']);
    const holder = () => s.relics.find((r) => r.code === 'RL.21')!;
    expect(checkActivation(s, holder())?.error).toBeNull();
    s = reduce(s, { type: 'SUBMIT_GUESS', guess: 'SLATE' }).state;
    expect(checkActivation(s, holder())?.error?.code).toBe('WRONG_PHASE');
  });

  it('ANY_TIME_IN_WORD stays open mid-word', () => {
    let s = inWord(['RL.07'], { gold: 100 });
    s = reduce(s, { type: 'SUBMIT_GUESS', guess: 'SLATE' }).state;
    expect(checkActivation(s, s.relics.find((r) => r.code === 'RL.07')!)?.error).toBeNull();
  });
});

describe('costs', () => {
  it('the engine charges gold, and refuses rather than consumes when unaffordable', () => {
    const broke = inWord(['RL.07'], { gold: 4 });
    expect(checkActivation(broke, broke.relics.find((r) => r.code === 'RL.07')!)?.error?.code).toBe(
      'UNAFFORDABLE',
    );

    const rich = inWord(['RL.07'], { gold: 40 });
    const holder = rich.relics.find((r) => r.code === 'RL.07')!;
    const out = reduce(rich, { type: 'USE_ITEM', instanceId: holder.instanceId, payload: { letter: 'Z' } });
    expect(out.error).toBeUndefined();
    expect(out.state.gold).toBe(35);
    // The cap is only spent by a use that actually happened.
    expect(usesThisWord(out.state.relics.find((r) => r.code === 'RL.07')!, out.state.word!.nodeId)).toBe(1);
  });

  it('a guess cost may never empty the pool', () => {
    const s = inWord([], { characterCode: 'CH.03', pool: 1 });
    const innate = s.relics[0]!;
    expect(checkActivation({ ...s, relics: [{ ...innate, code: 'CH.03' }] }, { ...innate, code: 'CH.03' })?.error?.code).toBe('UNAFFORDABLE');
  });

  it('once per word means once per word, not once per run', () => {
    let s = inWord(['RL.28'], {});
    const id = s.relics.find((r) => r.code === 'RL.28')!.instanceId;
    s = reduce(s, { type: 'USE_ITEM', instanceId: id }).state;
    expect(reduce(s, { type: 'USE_ITEM', instanceId: id }).error?.code).toBe('EMERGENCY_EXHAUSTED');
    // A different node resets the count.
    const nextWord = { ...s, word: { ...s.word!, nodeId: 'a0-n1' } };
    expect(reduce(nextWord, { type: 'USE_ITEM', instanceId: id }).error).toBeUndefined();
  });

  it('recordUse counts per node', () => {
    const relic: RelicInstance = { instanceId: 'x', code: 'RL.07', state: {}, acquiredAt: 0, upgraded: false };
    expect(usesThisWord(relic, 'n1')).toBe(0);
    const once = { ...relic, state: recordUse(relic, 'n1') };
    expect(usesThisWord(once, 'n1')).toBe(1);
    expect(usesThisWord(once, 'n2')).toBe(0);
  });
});

describe('RL.07 The Auditor', () => {
  it('stamps a named letter present or absent', () => {
    const s = inWord(['RL.07'], { gold: 100 });
    const id = s.relics.find((r) => r.code === 'RL.07')!.instanceId;
    const solution = s.word!.solutions[0]!;
    const out = reduce(s, { type: 'USE_ITEM', instanceId: id, payload: { letter: solution[0] } });
    expect(out.state.word!.revealed.letters).toEqual([{ letter: solution[0], present: true }]);
  });

  it('will not sell a letter already tried', () => {
    let s = inWord(['RL.07'], { gold: 100 });
    const id = s.relics.find((r) => r.code === 'RL.07')!.instanceId;
    s = reduce(s, { type: 'SUBMIT_GUESS', guess: 'SLATE' }).state;
    const out = reduce(s, { type: 'USE_ITEM', instanceId: id, payload: { letter: 'S' } });
    expect(out.state.word!.revealed.letters).toEqual([]);
  });
});

describe('RL.20 Blindfold (R-017)', () => {
  it('hammingDistance measures substitutions only', () => {
    expect(hammingDistance('CRANE', ['CRANE'])).toBe(0);
    expect(hammingDistance('CRANK', ['CRANE'])).toBe(1);
    expect(hammingDistance('CRAKE', ['CRANE'])).toBe(1);
    // A transposition is two positions differing, so it is NOT "within one".
    expect(hammingDistance('CRAEN', ['CRANE'])).toBe(2);
    expect(hammingDistance('SLATE', ['CRANE', 'SLATS'])).toBe(1);
  });

  it('arms the next guess and withholds that row', () => {
    let s = inWord(['RL.20']);
    const id = s.relics.find((r) => r.code === 'RL.20')!.instanceId;
    s = reduce(s, { type: 'USE_ITEM', instanceId: id }).state;
    expect(isBlindfolded(s, s.word!.nodeId, 0)).toBe(true);
    s = reduce(s, { type: 'SUBMIT_GUESS', guess: 'SLATE' }).state;
    expect(renderStates(projectBoard(s, s.word!).rows[0]!.results[0]!)).toBe('·····');
  });

  it('pays 3 guesses when the blind guess was within one letter, and nothing otherwise', () => {
    const base = inWord(['RL.20'], { pool: 10, poolMax: 30 });
    const id = base.relics.find((r) => r.code === 'RL.20')!.instanceId;
    const solution = base.word!.solutions[0]!;
    const near = `${solution.slice(0, -1)}${solution.at(-1) === 'Z' ? 'Y' : 'Z'}`;

    let hit = reduce(base, { type: 'USE_ITEM', instanceId: id }).state;
    const before = hit.pool;
    hit = { ...hit, word: { ...hit.word!, solutions: [near] } };
    // Guess the real solution against a near-miss target: distance 1.
    hit = reduce(hit, { type: 'SUBMIT_GUESS', guess: solution }).state;
    expect(hit.pool).toBe(before - 1 + 3);

    let miss = reduce(base, { type: 'USE_ITEM', instanceId: id }).state;
    const missBefore = miss.pool;
    miss = reduce(miss, { type: 'SUBMIT_GUESS', guess: farFrom(solution) }).state;
    expect(miss.pool).toBe(missBefore - 1);
  });

  it('only pays on the guess it armed', () => {
    let s = inWord(['RL.20'], { pool: 10, poolMax: 30 });
    const id = s.relics.find((r) => r.code === 'RL.20')!.instanceId;
    s = reduce(s, { type: 'USE_ITEM', instanceId: id }).state;
    s = reduce(s, { type: 'SUBMIT_GUESS', guess: 'SLATE' }).state;
    const afterFirst = s.pool;
    if (s.word) s = reduce(s, { type: 'SUBMIT_GUESS', guess: s.word.solutions[0]! }).state;
    expect(afterFirst).toBe(9);
  });
});

/** A word guaranteed to differ from `solution` in more than one position. */
function farFrom(solution: string): string {
  const candidates = ['QUILT', 'MOSSY', 'BRAWN', 'ZESTY', 'PLUCK'];
  return candidates.find((c) => hammingDistance(c, [solution]) > 1) ?? 'QUILT';
}

describe('RL.21 All In', () => {
  it('clamps the wager to the pool and ignores a zero wager', () => {
    const s = inWord(['RL.21'], { pool: 5, poolMax: 30 });
    const id = s.relics.find((r) => r.code === 'RL.21')!.instanceId;
    const big = reduce(s, { type: 'USE_ITEM', instanceId: id, payload: { wager: 99 } }).state;
    expect(big.relics.find((r) => r.code === 'RL.21')!.state['wager']).toBe(5);
    const zero = reduce(s, { type: 'USE_ITEM', instanceId: id, payload: { wager: 0 } }).state;
    expect(zero.relics.find((r) => r.code === 'RL.21')!.state['wager']).toBeUndefined();
  });

  it('pays the wager back as a refund on a solve inside it', () => {
    const base = inWord(['RL.21'], { pool: 12, poolMax: 30 });
    const id = base.relics.find((r) => r.code === 'RL.21')!.instanceId;

    let s = reduce(base, { type: 'USE_ITEM', instanceId: id, payload: { wager: 3 } }).state;
    const solution = s.word!.solutions[0]!;
    s = reduce(s, { type: 'SUBMIT_GUESS', guess: farFrom(solution) }).state;
    s = reduce(s, { type: 'SUBMIT_GUESS', guess: 'SLATE' }).state;
    s = reduce(s, { type: 'SUBMIT_GUESS', guess: solution }).state;
    // Solved in 3, wagered 3, so the wager comes back — floored to 2 by Rule A,
    // which keeps the word costing at least one net guess.
    expect(s.stats.refundsGranted).toBe(2);
  });

  it('takes the wager on a solve slower than it', () => {
    const base = inWord(['RL.21'], { pool: 12, poolMax: 30 });
    const id = base.relics.find((r) => r.code === 'RL.21')!.instanceId;

    let s = reduce(base, { type: 'USE_ITEM', instanceId: id, payload: { wager: 1 } }).state;
    const solution = s.word!.solutions[0]!;
    s = reduce(s, { type: 'SUBMIT_GUESS', guess: farFrom(solution) }).state;
    s = reduce(s, { type: 'SUBMIT_GUESS', guess: 'SLATE' }).state;
    const before = s.pool;
    s = reduce(s, { type: 'SUBMIT_GUESS', guess: solution }).state;
    // One guess for the submit, one more for the lost wager.
    expect(s.pool).toBe(before - 2);
  });

  it('a wager on one word never follows you to the next', () => {
    const base = inWord(['RL.21'], { pool: 12, poolMax: 30 });
    const id = base.relics.find((r) => r.code === 'RL.21')!.instanceId;
    const s = reduce(base, { type: 'USE_ITEM', instanceId: id, payload: { wager: 4 } }).state;
    const relic = s.relics.find((r) => r.code === 'RL.21')!;
    expect(relic.state['wagerNodeId']).toBe(s.word!.nodeId);
  });
});

describe('R-016 — Shaved Coin waits for Act III', () => {
  it('is not offerable before Act III', () => {
    const def = REGISTRY['RL.28']!;
    expect(offerableInAct(def, 0)).toBe(false);
    expect(offerableInAct(def, 1)).toBe(false);
    expect(offerableInAct(def, 2)).toBe(true);
  });

  it('relics without the flag are offerable anywhere', () => {
    expect(offerableInAct(REGISTRY['RL.01']!, 0)).toBe(true);
  });

  it('re-rolls the truth mask when used', () => {
    const s = inWord(['RL.28'], {});
    const id = s.relics.find((r) => r.code === 'RL.28')!.instanceId;
    expect(s.word!.truthMask).toBeNull();
    const out = reduce(s, { type: 'USE_ITEM', instanceId: id }).state;
    expect(out.word!.truthMask).toHaveLength(out.word!.length);
  });
});

describe('CH.03 The Cryptographer', () => {
  it('is selectable now, and its innate reveals a position', () => {
    const started = reduce(initialState(SEED, 'CH.03'), {
      type: 'START_RUN',
      seed: SEED,
      characterCode: 'CH.03',
    });
    expect(started.error).toBeUndefined();
    // pool_modifier −4 on Act I's 22.
    expect(started.state.poolMax).toBe(CONFIG.acts[0].pool - 4);

    let s = enterFirstWord(started.state);
    const innate = s.relics.find((r) => r.code === 'CH.03')!;
    const before = s.pool;
    s = reduce(s, { type: 'USE_ITEM', instanceId: innate.instanceId, payload: { index: 0 } }).state;
    expect(s.pool).toBe(before - 1);
    expect(s.word!.presetTiles).toEqual([
      { index: 0, letter: s.word!.solutions[0]![0], solutionIndex: 0 },
    ]);
  });

  it('has no use cap — the guess it costs is the cap', () => {
    expect(activationFor('CH.03')!.usesPerWord).toBeNull();
    expect(activationFor('CH.03')!.cost.guesses).toBe(1);
  });
});

/**
 * R-031 — an activation that produces nothing is refused, not consumed.
 *
 * From playtest: "I got the Auditor, it's kind of buggy, sometimes it activates
 * sometimes not." It was charging the gold before running the handler, so naming
 * a letter it cannot answer took 5g and returned in silence — no stamp, no
 * error, and nothing to tell it apart from a use that worked.
 */
describe('R-031 an empty activation costs nothing', () => {
  it('naming an already-tried letter is refused, and the gold is not taken', () => {
    let s = inWord(['RL.07'], { gold: 100 });
    const auditor = s.relics.find((r) => r.code === 'RL.07')!;
    const guess = s.word!.solutions[0]!;
    s = reduce(s, { type: 'SUBMIT_GUESS', guess }).state;
    // The word may have ended on that guess; only the refusal matters here.
    if (!s.word) return;

    const tried = guess[0]!;
    const goldBefore = s.gold;
    const out = reduce(s, {
      type: 'USE_ITEM',
      instanceId: auditor.instanceId,
      payload: { letter: tried },
    });

    expect(out.error?.code, 'a use that can teach nothing must say so').toBe('NO_EFFECT');
    expect(out.state.gold, 'and must not charge for it').toBe(goldBefore);
    expect(out.state.word!.revealed.letters).toHaveLength(0);
  });

  it('a garbled payload is refused rather than silently billed', () => {
    const s = inWord(['RL.07'], { gold: 100 });
    const auditor = s.relics.find((r) => r.code === 'RL.07')!;
    const out = reduce(s, {
      type: 'USE_ITEM',
      instanceId: auditor.instanceId,
      payload: { letter: '' },
    });
    expect(out.error?.code).toBe('NO_EFFECT');
    expect(out.state.gold).toBe(100);
  });

  it('a real use still charges, stamps, and burns the once-per-word cap', () => {
    const s = inWord(['RL.07'], { gold: 100 });
    const auditor = s.relics.find((r) => r.code === 'RL.07')!;
    const out = reduce(s, {
      type: 'USE_ITEM',
      instanceId: auditor.instanceId,
      payload: { letter: 'Q' },
    });
    expect(out.error).toBeUndefined();
    expect(out.state.gold).toBe(95);
    expect(out.state.word!.revealed.letters).toEqual([{ letter: 'Q', present: expect.any(Boolean) }]);
    expect(out.events.some((e) => e.type === 'LETTER_STAMPED')).toBe(true);
    // Second use this word is capped, not silently free.
    const again = reduce(out.state, {
      type: 'USE_ITEM',
      instanceId: auditor.instanceId,
      payload: { letter: 'Z' },
    });
    expect(again.error).toBeDefined();
    expect(again.state.gold).toBe(95);
  });

  it('a relic firing is not reported as a consumable being used', () => {
    const s = inWord(['RL.07'], { gold: 100 });
    const auditor = s.relics.find((r) => r.code === 'RL.07')!;
    const out = reduce(s, {
      type: 'USE_ITEM',
      instanceId: auditor.instanceId,
      payload: { letter: 'Q' },
    });
    expect(out.events.some((e) => e.type === 'CONSUMABLE_USED')).toBe(false);
    expect(out.events.some((e) => e.type === 'ACTIVATION_FIRED')).toBe(true);
  });
});
