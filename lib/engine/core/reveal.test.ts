import { describe, expect, it } from 'vitest';
import { CONFIG, withConfig } from './config';
import { canDispatch, initialState, reduce, revealBlocker, revealCost } from './reducer';
import type { GameState, RelicInstance } from './state';
import { wordList } from '../words';
import { enterFirstWord } from '../../../test/nav';
import '../words/all';

/**
 * R-020 / MECHANICS §2.5 — the reveal ladder.
 *
 * Six rules, one test each, plus the invariants that make the mechanic safe to
 * add: it cannot finish a word, it cannot lock a solution letter, and a refused
 * purchase costs nothing.
 */

const SEED = 'REVEALS';

/** In a word, one guess deep, with gold — the state the ladder opens in. */
function stuck(gold = 500, codes: string[] = []): GameState {
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
  return { ...s, gold, relics: [...s.relics, ...extra] };
}

/**
 * Put one real guess on the board, so the Rule A gate is open.
 *
 * It has to be a genuine guess through `reduce` — faking a history entry would
 * make every test below pass against a board no run can actually reach. The
 * word is drawn from the list rather than hardcoded because the seed decides
 * the length.
 */
function openWith(s: GameState): GameState {
  const list = wordList(s.word!.length);
  const answers = new Set(s.word!.solutions);
  for (const candidate of list.solutions) {
    if (answers.has(candidate)) continue;
    const tried = reduce(s, { type: 'SUBMIT_GUESS', guess: candidate });
    if (!tried.error && tried.state.phase === 'WORD') return tried.state;
  }
  throw new Error('No legal opening guess — the word list is not loaded.');
}

describe('§2.5 the reveal ladder', () => {
  it('Rule A — closed before the first guess, open after it', () => {
    const s = stuck();
    expect(s.word!.history).toHaveLength(0);
    expect(revealBlocker(s, CONFIG)?.code).toBe('REVEAL_UNAVAILABLE');

    const after = openWith(s);
    expect(after.word!.history.length).toBeGreaterThan(0);
    expect(revealBlocker(after, CONFIG)).toBeNull();
  });

  it('Rule B — never hands over the last unknown position', () => {
    const s = openWith(stuck());
    const length = s.word!.length;
    // Preset every position but two, then buy one. The ladder must close before
    // the last one rather than solving the word outright.
    const presets = Array.from({ length: length - 2 }, (_, i) => ({
      index: i,
      letter: s.word!.solutions[0]![i]!,
      solutionIndex: 0,
    }));
    const nearly: GameState = { ...s, word: { ...s.word!, presetTiles: presets } };
    expect(revealBlocker(nearly, CONFIG)).toBeNull();

    const bought = reduce(nearly, { type: 'BUY_REVEAL', index: length - 2 }, CONFIG).state;
    expect(bought.word!.presetTiles).toHaveLength(length - 1);
    expect(revealBlocker(bought, CONFIG)?.code).toBe('REVEAL_UNAVAILABLE');
  });

  it('Rule B — relic presets and purchases count together', () => {
    // Two presets on a five-letter word leave three unknown, so the three-step
    // ladder still cannot reach the last one.
    const s = openWith(stuck());
    let cur: GameState = {
      ...s,
      word: {
        ...s.word!,
        presetTiles: [
          { index: 0, letter: s.word!.solutions[0]![0]!, solutionIndex: 0 },
          { index: 1, letter: s.word!.solutions[0]![1]!, solutionIndex: 0 },
        ],
      },
    };
    let bought = 0;
    for (let i = 2; i < cur.word!.length; i++) {
      if (revealBlocker(cur, CONFIG)) break;
      cur = reduce(cur, { type: 'BUY_REVEAL', index: i }, CONFIG).state;
      bought++;
    }
    const known = cur.word!.presetTiles.length;
    expect(known).toBeLessThan(cur.word!.length);
    expect(bought).toBeGreaterThan(0);
  });

  it('Rule C — an unaffordable purchase is refused, not consumed', () => {
    const s = openWith(stuck(5));
    const before = s.word!.revealsPurchased;
    const out = reduce(s, { type: 'BUY_REVEAL', index: 0 }, CONFIG);
    expect(out.error?.code).toBe('UNAFFORDABLE');
    expect(out.state.word!.revealsPurchased).toBe(before);
    expect(out.state.gold).toBe(5);
    // And the price has not stepped up for the next attempt.
    expect(revealCost(out.state, CONFIG)).toBe(CONFIG.revealCosts[0]);
  });

  it('Rule D — the revealed letter is the true one, whatever the board says', () => {
    const s = openWith(stuck());
    const out = reduce(s, { type: 'BUY_REVEAL', index: 2 }, CONFIG);
    expect(out.error).toBeUndefined();
    const preset = out.state.word!.presetTiles.find((p) => p.index === 2);
    expect(preset?.letter).toBe(s.word!.solutions[0]![2]);
  });

  it('Rule E — a revealed letter is not locked out of the alphabet (R-014)', () => {
    const s = openWith(stuck());
    const before = s.word!.lockedLetters.length;
    const out = reduce(s, { type: 'BUY_REVEAL', index: 0 }, CONFIG).state;
    expect(out.word!.lockedLetters).toHaveLength(before);
  });

  it('the price ladder escalates within a word and resets with it', () => {
    let s = openWith(stuck(1000));
    const paid: number[] = [];
    for (let i = 0; i < CONFIG.revealCosts.length; i++) {
      if (revealBlocker(s, CONFIG)) break;
      const cost = revealCost(s, CONFIG)!;
      const goldBefore = s.gold;
      s = reduce(s, { type: 'BUY_REVEAL', index: i }, CONFIG).state;
      expect(s.gold).toBe(goldBefore - cost);
      paid.push(cost);
    }
    expect(paid.length).toBeGreaterThan(1);
    for (let i = 1; i < paid.length; i++) expect(paid[i]!).toBeGreaterThan(paid[i - 1]!);
    // A fresh word starts the ladder over.
    expect(revealCost(openWith(stuck(1000)), CONFIG)).toBe(CONFIG.revealCosts[0]);
  });

  it('the ladder runs out rather than continuing at the last price', () => {
    const s = openWith(stuck(10_000));
    const spent: GameState = {
      ...s,
      word: { ...s.word!, revealsPurchased: CONFIG.revealCosts.length },
    };
    expect(revealCost(spent, CONFIG)).toBeNull();
    expect(revealBlocker(spent, CONFIG)?.code).toBe('REVEAL_EXHAUSTED');
  });

  it('a position that is already known cannot be bought twice', () => {
    let s = openWith(stuck(1000));
    s = reduce(s, { type: 'BUY_REVEAL', index: 1 }, CONFIG).state;
    const out = reduce(s, { type: 'BUY_REVEAL', index: 1 }, CONFIG);
    expect(out.error?.code).toBe('POSITION_KNOWN');
    expect(out.state.gold).toBe(s.gold);
  });

  it('canDispatch agrees with reduce, so the view never has to guess', () => {
    const fresh = stuck();
    expect(canDispatch(fresh, { type: 'BUY_REVEAL', index: 0 }, CONFIG)?.code).toBe(
      'REVEAL_UNAVAILABLE',
    );
    const open = openWith(stuck());
    expect(canDispatch(open, { type: 'BUY_REVEAL', index: 0 }, CONFIG)).toBeNull();
    expect(canDispatch(open, { type: 'BUY_REVEAL', index: 99 }, CONFIG)?.code).toBe(
      'POSITION_KNOWN',
    );
  });

  it('the ladder is config, not a constant baked into the reducer', () => {
    const cheap = withConfig({ revealCosts: [1, 2] });
    const s = openWith(stuck(100));
    expect(revealCost(s, cheap)).toBe(1);
    const after = reduce(s, { type: 'BUY_REVEAL', index: 0 }, cheap).state;
    expect(revealCost(after, cheap)).toBe(2);
    expect(revealCost({ ...after, word: { ...after.word!, revealsPurchased: 2 } }, cheap)).toBeNull();
  });

  it('emits REVEAL_BOUGHT with what was paid and what was learned', () => {
    const s = openWith(stuck(1000));
    const out = reduce(s, { type: 'BUY_REVEAL', index: 3 }, CONFIG);
    const event = out.events.find((e) => e.type === 'REVEAL_BOUGHT');
    expect(event).toMatchObject({ index: 3, nth: 1, cost: CONFIG.revealCosts[0] });
  });
});

describe('the relics built on the ladder (R-020)', () => {
  it('RL.08 The Fence discounts the whole ladder, not just the first step', () => {
    const plain = openWith(stuck(1000));
    const fenced = openWith(stuck(1000, ['RL.08']));
    expect(revealCost(fenced, CONFIG)!).toBeLessThan(revealCost(plain, CONFIG)!);

    // Every rung, not only the one the player is standing on.
    for (let n = 0; n < CONFIG.revealCosts.length; n++) {
      const at = (s: GameState) => ({ ...s, word: { ...s.word!, revealsPurchased: n } });
      expect(revealCost(at(fenced), CONFIG)!).toBeLessThan(revealCost(at(plain), CONFIG)!);
    }
  });

  it('RL.08 charges the discounted price, not the sticker price', () => {
    const s = openWith(stuck(1000, ['RL.08']));
    const expected = revealCost(s, CONFIG)!;
    const after = reduce(s, { type: 'BUY_REVEAL', index: 0 }, CONFIG).state;
    expect(after.gold).toBe(1000 - expected);
    expect(expected).toBeLessThan(CONFIG.revealCosts[0]!);
  });

  it('no stack of discounts makes a reveal free', () => {
    // Two Fences is not a state the offer system produces, but the floor is
    // what makes that irrelevant rather than something to remember.
    const s = openWith(stuck(1000, ['RL.08', 'RL.08']));
    expect(revealCost(s, CONFIG)!).toBeGreaterThanOrEqual(1);
  });

  it('RL.17 The Holdout pays for solving without buying, and not otherwise', () => {
    const s = openWith(stuck(1000, ['RL.17']));
    const solution = s.word!.solutions[0]!;

    const clean = reduce(s, { type: 'SUBMIT_GUESS', guess: solution }, CONFIG);
    expect(clean.state.gold).toBeGreaterThan(s.gold);

    const bought = reduce(s, { type: 'BUY_REVEAL', index: 0 }, CONFIG).state;
    const paidFor = reduce(bought, { type: 'SUBMIT_GUESS', guess: solution }, CONFIG);
    // Solving still pays a word reward; what must not appear is the bonus on
    // top of it, so compare the two solves rather than the raw totals.
    const cleanGain = clean.state.gold - s.gold;
    const boughtGain = paidFor.state.gold - bought.gold;
    expect(boughtGain).toBeLessThan(cleanGain);
  });
});
