import { describe, expect, it } from 'vitest';
import { annotateDistances, legalDistances, liesAt, runChain, CHAIN } from './chain';
import { scoreBase } from './scorer';
import { freezeFeedback, renderStates } from './types';
import { initialState } from '../core/reducer';
import type { GameState, WordState } from '../core/state';
import '../words/all';

/** E-08 — the transform chain. MECHANICS.md §4.4 fixes the order. */

function word(over: Partial<WordState> = {}): WordState {
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
    nodeId: 'n1',
    poolSource: 'ACT',
    ...over,
  };
}

function state(over: Partial<GameState> = {}): GameState {
  return { ...initialState('CHAINSEED', 'CH.01'), relics: [], ...over };
}

function relic(code: string, at = 1) {
  return { instanceId: `${code}#${at}`, code, state: {}, acquiredAt: at };
}

describe('chain order', () => {
  it('is declared, not registered', () => {
    expect(CHAIN.map((s) => s.order)).toEqual([...CHAIN.map((s) => s.order)].sort((a, b) => a - b));
    expect(CHAIN.map((s) => s.id)).toEqual([
      'suppression',
      'truth-roll',
      'corruption',
      'distance',
      'injection',
    ]);
  });
});

describe('step 2 — corruption (Liar Letter)', () => {
  const w = word({ modifiers: ['LIAR_LETTER'], liarIndex: 2 });

  it('flips exactly the lying position and marks it untrustworthy', () => {
    const raw = scoreBase('CRANE', 'CRANE');
    const out = runChain({ state: state(), word: w, turn: 0, solutionIndex: 0 }, raw);
    expect(out.tiles.filter((t) => !t.trustworthy)).toHaveLength(1);
    expect(out.tiles[2]!.trustworthy).toBe(false);
    expect(out.tiles[2]!.state).not.toBe('GREEN');
    expect(out.tiles.filter((t, i) => i !== 2).every((t) => t.state === 'GREEN')).toBe(true);
  });

  it('is skipped entirely by RL.29 The Mask', () => {
    const s = state({ relics: [relic('RL.29')] });
    const out = runChain({ state: s, word: w, turn: 0, solutionIndex: 0 }, scoreBase('CRANE', 'CRANE'));
    expect(renderStates(out)).toBe('GGGGG');
    expect(out.tiles.every((t) => t.trustworthy)).toBe(true);
  });

  it('is deterministic — the same address gives the same lie', () => {
    const a = runChain({ state: state(), word: w, turn: 1, solutionIndex: 0 }, scoreBase('SLATE', 'CRANE'));
    const b = runChain({ state: state(), word: w, turn: 1, solutionIndex: 0 }, scoreBase('SLATE', 'CRANE'));
    expect(renderStates(a)).toBe(renderStates(b));
  });

  it('liesAt prefers the truth mask over the fixed liar index', () => {
    expect(liesAt(word({ liarIndex: 1 }), 1)).toBe(true);
    expect(liesAt(word({ liarIndex: 1, truthMask: [true, true, false, true, true] }), 1)).toBe(false);
    expect(liesAt(word({ liarIndex: 1, truthMask: [true, true, false, true, true] }), 2)).toBe(true);
  });
});

describe('step 3 — distance (Rangefinder)', () => {
  it('withholds the letter and reports the distance on yellows only', () => {
    const s = state({ relics: [relic('RL.04')] });
    const raw = annotateDistances(scoreBase('ARISE', 'CRANE'), 'CRANE');
    const out = runChain({ state: s, word: word(), turn: 0, solutionIndex: 0 }, raw);
    out.tiles.forEach((tile) => {
      if (tile.state === 'YELLOW') {
        expect(tile.letter).toBeNull();
        expect(tile.distance).not.toBeNull();
      } else {
        expect(tile.distance).toBeNull();
      }
    });
  });

  it('strips the stored distance when the relic is not held', () => {
    const raw = annotateDistances(scoreBase('ARISE', 'CRANE'), 'CRANE');
    expect(raw.tiles.some((t) => t.distance !== null)).toBe(true);
    const out = runChain({ state: state(), word: word(), turn: 0, solutionIndex: 0 }, raw);
    expect(out.tiles.every((t) => t.distance === null)).toBe(true);
  });

  /**
   * The interaction the ordering exists for. Corruption runs first, so a
   * corrupted tile yields a legal-looking distance rather than a visible
   * contradiction (MECHANICS.md §4.4).
   */
  it('a corrupted tile still yields a legal distance', () => {
    const s = state({ relics: [relic('RL.04'), relic('RL.29', 99)] });
    // Hold RL.04 only for this one, so corruption is not skipped.
    const withRangefinder = state({ relics: [relic('RL.04')] });
    const w = word({ modifiers: ['LIAR_LETTER'], liarIndex: 0 });
    const raw = annotateDistances(scoreBase('SLATE', 'CRANE'), 'CRANE');
    const out = runChain({ state: withRangefinder, word: w, turn: 0, solutionIndex: 0 }, raw);
    const lied = out.tiles[0]!;
    expect(lied.trustworthy).toBe(false);
    if (lied.state === 'YELLOW') {
      expect(legalDistances(0, 5)).toContain(lied.distance!);
      expect(lied.letter).toBeNull();
    }
    expect(s.relics).toHaveLength(2); // the Mask fixture is unused but documented
  });

  it('legalDistances only offers offsets that fit the word', () => {
    expect(legalDistances(0, 5)).toEqual([1, 2, 3, 4]);
    expect(legalDistances(2, 5)).toEqual([1, 2]);
    expect(legalDistances(4, 5)).toEqual([1, 2, 3, 4]);
  });
});

describe('step 4 — injection', () => {
  it('applies pre-set greens to every row', () => {
    const w = word({ presetTiles: [{ index: 0, letter: 'C' }] });
    const out = runChain({ state: state(), word: w, turn: 0, solutionIndex: 0 }, scoreBase('SLATE', 'CRANE'));
    expect(out.tiles[0]!.state).toBe('GREEN');
    expect(out.tiles[0]!.letter).toBe('C');
  });
});

describe('step 0 — Silent Start', () => {
  it('withholds yellows on the first guess only', () => {
    const w = word({ modifiers: ['SILENT_START'] });
    const first = runChain({ state: state(), word: w, turn: 0, solutionIndex: 0 }, scoreBase('ARISE', 'CRANE'));
    expect(first.tiles.some((t) => t.state === 'YELLOW')).toBe(false);
    const second = runChain({ state: state(), word: w, turn: 1, solutionIndex: 0 }, scoreBase('ARISE', 'CRANE'));
    expect(second.tiles.some((t) => t.state === 'YELLOW')).toBe(true);
  });
});

describe('E-02 — stored feedback is the truth', () => {
  it('a transform that mutates its input throws in dev', () => {
    const raw = freezeFeedback(scoreBase('CRANE', 'SLATE'));
    expect(() => {
      raw.tiles[0]!.state = 'GREEN';
    }).toThrow();
  });

  it('the chain never mutates the raw result it was handed', () => {
    const raw = scoreBase('SLATE', 'CRANE');
    const before = renderStates(raw);
    runChain(
      { state: state({ relics: [relic('RL.04')] }), word: word({ presetTiles: [{ index: 0, letter: 'C' }] }), turn: 0, solutionIndex: 0 },
      raw,
    );
    expect(renderStates(raw)).toBe(before);
  });
});

describe('annotateDistances', () => {
  it('measures to the nearest unmatched occurrence', () => {
    const fb = annotateDistances(scoreBase('EARNS', 'CRANE'), 'CRANE');
    const e = fb.tiles[0]!;
    expect(e.state).toBe('YELLOW');
    expect(e.distance).toBe(4); // E at index 0 of the guess, index 4 of CRANE
  });
});
