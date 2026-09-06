import { describe, expect, it } from 'vitest';
import { CONFIG } from './config';
import { grantableRefund, highestRefund, spendGuess } from './pool';
import { initialState, reduce } from './reducer';
import type { GameState, WordState } from './state';
import '../words/all';

/**
 * E-06 — the refund floor. Technical brief §3 lists five cases that must pass
 * before ANY refund relic is implemented. They are the first five here.
 */

function wordFixture(over: Partial<WordState> = {}): WordState {
  return {
    solutions: ['CRANE'],
    solved: [false],
    length: 5,
    modifiers: [],
    history: [],
    presetTiles: [],
    revealsPurchased: 0,
    lockedLetters: [],
    liarIndex: null,
    truthMask: null,
    netGuessesSpent: 0,
    refundsAppliedThisWord: 0,
    pendingRefunds: [],
    deferralDepth: 0,
    revealed: { vowelCount: null, hasRepeat: null, sharedLetter: null, letters: [] },
    nodeId: 'test-node',
    poolSource: 'ACT',
    ...over,
  };
}

function stateFixture(over: Partial<GameState> = {}): GameState {
  return { ...initialState('TESTSEED', 'CH.01'), pool: 20, poolMax: 20, word: wordFixture(), ...over };
}

describe('Rule B — highest refund only, never summed', () => {
  it('takes the largest of several refunds on one event', () => {
    const best = highestRefund([
      { kind: 'REFUND', amount: 1, source: 'RL.11' },
      { kind: 'REFUND', amount: 2, source: 'CH.02' },
      { kind: 'REFUND', amount: 1, source: 'RL.18' },
    ]);
    expect(best?.amount).toBe(2);
    expect(best?.source).toBe('CH.02');
  });

  it('ignores zero and negative refunds', () => {
    expect(highestRefund([{ kind: 'REFUND', amount: 0, source: 'x' }])).toBeNull();
  });
});

describe('Rule A — a word costs at least one net guess', () => {
  it('grants a refund in full when the word can afford it', () => {
    expect(grantableRefund(3, 0, 1)).toBe(1);
  });

  it('truncates a refund that would take net spend below 1', () => {
    expect(grantableRefund(2, 1, 1)).toBe(0);
    expect(grantableRefund(3, 0, 3)).toBe(2);
  });

  it('never returns a negative grant', () => {
    expect(grantableRefund(1, 0, 5)).toBe(0);
  });
});

describe('technical brief §3 — the five required cases', () => {
  it('CH.02 Gambler + RL.11 Flywheel, solve in 3 → +2, not +3', () => {
    const s = stateFixture({ word: wordFixture({ netGuessesSpent: 3 }), pool: 17 });
    const best = highestRefund([
      { kind: 'REFUND', amount: 2, source: 'CH.02' },
      { kind: 'REFUND', amount: 1, source: 'RL.11' },
    ])!;
    expect(grantableRefund(s.word!.netGuessesSpent, 0, best.amount)).toBe(2);
  });

  it('RL.18 Wishbone refunds every guess, solve in 4 → net spend >= 1', () => {
    let s = stateFixture();
    for (let i = 0; i < 4; i++) {
      s = spendGuess(s, [{ kind: 'REFUND', amount: 1, source: 'RL.18' }]).state;
    }
    const net = s.word!.netGuessesSpent - s.word!.refundsAppliedThisWord;
    expect(net).toBeGreaterThanOrEqual(CONFIG.minNetGuessesPerWord);
    expect(20 - s.pool).toBe(net);
  });

  it('RL.13 Opening Gambit on a 1-guess solve → net spend = 1', () => {
    const s = spendGuess(stateFixture(), [{ kind: 'REFUND', amount: 1, source: 'RL.13' }]).state;
    expect(s.word!.netGuessesSpent - s.word!.refundsAppliedThisWord).toBe(1);
    expect(s.pool).toBe(19);
  });

  it('RL.18 + RL.13 both firing on guess 1 → the larger only', () => {
    let s = stateFixture();
    s = spendGuess(s, [
      { kind: 'REFUND', amount: 1, source: 'RL.13' },
      { kind: 'REFUND', amount: 1, source: 'RL.18' },
    ]).state;
    // Both are 1, so at most 1 can ever be granted; on guess 1 the floor
    // truncates it to 0 and queues it.
    expect(s.word!.refundsAppliedThisWord).toBe(0);
    expect(s.word!.pendingRefunds).toHaveLength(1);
  });

  it('refunds exceeding spend across a word never push pool above poolMax', () => {
    let s = stateFixture({ pool: 20, poolMax: 20 });
    for (let i = 0; i < 8; i++) {
      s = spendGuess(s, [{ kind: 'REFUND', amount: 3, source: 'test' }]).state;
      expect(s.pool).toBeLessThanOrEqual(s.poolMax);
    }
    expect(s.word!.netGuessesSpent - s.word!.refundsAppliedThisWord).toBeGreaterThanOrEqual(1);
  });
});

describe('Rule C — free guesses are refunds, never skipped decrements', () => {
  it('ticks the pool down before any refund is considered', () => {
    const result = spendGuess(stateFixture(), [{ kind: 'REFUND', amount: 1, source: 'RL.13' }]);
    const poolEvents = result.events.filter((e) => e.type === 'POOL_CHANGED');
    expect(poolEvents[0]).toMatchObject({ delta: -1, reason: 'guess' });
  });
});

describe('pending refunds (ADR-0005)', () => {
  it('grants a queued word-start refund on a later guess of the same word', () => {
    let s = stateFixture();
    // The Moth pays at word start, when nothing has been spent.
    s = { ...s, word: { ...s.word!, pendingRefunds: [{ amount: 1, source: 'RL.19' }] } };
    s = spendGuess(s).state;
    expect(s.word!.refundsAppliedThisWord).toBe(0); // net would be 0, below the floor
    s = spendGuess(s).state;
    expect(s.word!.refundsAppliedThisWord).toBe(1); // net 1, allowed
    expect(s.word!.pendingRefunds).toHaveLength(0);
  });

  it('drops pending refunds when the word ends — Rule A is per word', () => {
    const seed = 'POOLTEST';
    let s = reduce(initialState(seed, 'CH.01'), {
      type: 'START_RUN',
      seed,
      characterCode: 'CH.01',
    }).state;
    s = reduce(s, { type: 'SELECT_NODE', nodeId: s.map.available[0]! }).state;
    const solution = s.word!.solutions[0]!;
    s = reduce(s, { type: 'SUBMIT_GUESS', guess: solution }).state;
    expect(s.word).toBeNull();
  });
});

describe('the pool is the only resource', () => {
  it('the gauntlet pool is separate and never touches the act pool', () => {
    let s = stateFixture({
      gauntlet: { pool: 14, wordIndex: 0 },
      word: wordFixture({ poolSource: 'GAUNTLET' }),
    });
    const before = s.pool;
    s = spendGuess(s).state;
    expect(s.pool).toBe(before);
    expect(s.gauntlet!.pool).toBe(13);
  });
});
