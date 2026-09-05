import { describe, expect, it } from 'vitest';
import { annotateDistances, scoreBase } from '../index';
import { decayGreens, deriveKeyboard, deriveLocked, isDeferred, projectBoard, withhold } from './projection';
import { renderStates } from './types';
import { initialState } from '../core/reducer';
import { eligibleLettersForRemoval, isLetterAvailable } from '../core/letters';
import type { GameState, GuessRecord, WordState } from '../core/state';
import '../words/all';

/** E-09 — board projection: deferral gating and Decay (technical brief §4.3). */

function record(guess: string, solution: string, turn: number): GuessRecord {
  return { guess, raw: [annotateDistances(scoreBase(guess, solution), solution)], turn };
}

function word(over: Partial<WordState> = {}): WordState {
  return {
    solutions: ['CRANE'],
    solved: [false],
    length: 5,
    modifiers: [],
    history: [],
    presetTiles: [],
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
  return { ...initialState('PROJSEED', 'CH.01'), ...over };
}

const relic = (code: string, at = 1) => ({ instanceId: `${code}#${at}`, code, state: {}, acquiredAt: at });

describe('deferral', () => {
  it('Fog hides row n until n+1 is submitted', () => {
    expect(isDeferred(word({ deferralDepth: 1 }), 0, 1)).toBe(true);
    expect(isDeferred(word({ deferralDepth: 1 }), 0, 2)).toBe(false);
  });

  it('the Cipher is the same mechanism at depth 3', () => {
    const w = word({ deferralDepth: 3 });
    expect(isDeferred(w, 0, 1)).toBe(true);
    expect(isDeferred(w, 0, 3)).toBe(true);
    expect(isDeferred(w, 0, 4)).toBe(false);
  });

  it('withholding hides state and identity but keeps the row', () => {
    const hidden = withhold(scoreBase('CRANE', 'CRANE'));
    expect(renderStates(hidden)).toBe('·····');
    expect(hidden.tiles.every((t) => t.letter === null)).toBe(true);
    expect(hidden.meta.deferred).toBe(true);
  });

  it('projects a deferred board as hidden and then reveals it', () => {
    const w = word({ deferralDepth: 1, history: [record('SLATE', 'CRANE', 0)] });
    expect(renderStates(projectBoard(state(), w, 1).rows[0]!.results[0]!)).toBe('·····');
    expect(renderStates(projectBoard(state(), w, 2).rows[0]!.results[0]!)).not.toBe('·····');
  });
});

describe('decay', () => {
  it('reverts GREEN to UNKNOWN and leaves everything else alone', () => {
    const decayed = decayGreens(scoreBase('CRANE', 'CRAVE'));
    expect(renderStates(decayed)).toBe('???X?'.replace(/\?/g, '?'));
    expect(decayed.tiles.filter((t) => t.state === 'UNKNOWN')).toHaveLength(4);
  });

  it('is a function of when you look, not of the guess', () => {
    const w = word({ modifiers: ['DECAY'], history: [record('CRAVE', 'CRANE', 0)] });
    // Fresh at turn 1, decayed by turn 3.
    expect(renderStates(projectBoard(state(), w, 1).rows[0]!.results[0]!)).toContain('G');
    expect(renderStates(projectBoard(state(), w, 3).rows[0]!.results[0]!)).not.toContain('G');
  });
});

describe('keyboard derivation', () => {
  it('keeps the best state per letter', () => {
    const w = word({ history: [record('SLATE', 'CRANE', 0), record('CRANE', 'CRANE', 1)] });
    const view = projectBoard(state(), w, 2);
    expect(view.keyboard['C']).toBe('GREEN');
    expect(view.keyboard['S']).toBe('GREY');
  });

  it('falls back to the typed letter when Rangefinder withholds identity', () => {
    const s = state({ relics: [relic('RL.04')] });
    const w = word({ history: [record('ARISE', 'CRANE', 0)] });
    const view = projectBoard(s, w, 1);
    expect(view.keyboard['A']).toBeDefined();
  });

  it('shows the best state across both solutions under Mirror', () => {
    const raw = ['CRANE', 'PLUMB'].map((sol) => annotateDistances(scoreBase('CRANE', sol), sol));
    const w = word({
      solutions: ['CRANE', 'PLUMB'],
      solved: [false, false],
      modifiers: ['MIRROR'],
      history: [{ guess: 'CRANE', raw, turn: 0 }],
    });
    const view = projectBoard(state(), w, 1);
    expect(view.keyboard['C']).toBe('GREEN'); // green in A, absent in B
  });
});

describe('E-12 — every solution letter stays typable', () => {
  it('R-003: eligibleLettersForRemoval never offers a solution letter', () => {
    for (const solutions of [['CRANE'], ['CRANE', 'PLUMB'], ['SPHINX']]) {
      const eligible = eligibleLettersForRemoval(solutions);
      for (const sol of solutions) {
        for (const c of sol) expect(eligible).not.toContain(c);
      }
    }
  });

  /**
   * The invariant that separates a hard word from an unwinnable run. Three
   * systems remove letters — RL.02 The Sieve, the Locked Key modifier and
   * RL.19 The Moth — and after all three have applied, every letter of every
   * solution must still be typable (§13 I-12).
   */
  it('holds after Sieve, Locked Key and The Moth have all applied', () => {
    const solution = 'CRANE';
    const eligible = eligibleLettersForRemoval([solution]);
    const w = word({
      lockedLetters: [
        { letter: eligible[0]!, source: 'MOD:LOCKED_KEY' },
        { letter: eligible[1]!, source: 'RL.19' },
      ],
      history: [
        record('SLOTS', solution, 0),
        record('DUMPY', solution, 1),
        record('WHIZZ', solution, 2),
      ],
    });
    const s = state({ relics: [relic('RL.02')] });
    const view = projectBoard(s, w, 3);
    const provenGrey = new Set(view.provenGrey);
    for (const letter of solution) {
      expect(isLetterAvailable(s, w, letter, provenGrey), `${letter} must stay typable`).toBe(true);
      expect(view.locked).not.toContain(letter);
    }
  });

  /**
   * §13 I-18. A corrupted GREY is not evidence of absence, and neither is a
   * Silent Start GREY, and neither is a GREEN that has since decayed. Letting
   * the Sieve act on any of them hard-locks a letter the solution needs.
   */
  it('the Sieve ignores greys produced by Liar Letter', () => {
    const s = state({ relics: [relic('RL.02')] });
    const w = word({ modifiers: ['LIAR_LETTER'], liarIndex: 0, history: [record('CRANE', 'CRANE', 0)] });
    const view = projectBoard(s, w, 1);
    for (const letter of 'CRANE') expect(view.locked).not.toContain(letter);
  });

  it('the Sieve ignores greys produced by Silent Start', () => {
    const s = state({ relics: [relic('RL.02')] });
    const w = word({ modifiers: ['SILENT_START'], history: [record('ARISE', 'CRANE', 0)] });
    const view = projectBoard(s, w, 1);
    for (const letter of 'CRANE') expect(view.locked).not.toContain(letter);
  });

  it('the Sieve ignores a green that has since decayed', () => {
    const s = state({ relics: [relic('RL.02')] });
    // SASSY against CRANE-like solution with a duplicate: a letter green in one
    // position and grey in another.
    const w = word({
      solutions: ['SPACE'],
      modifiers: ['DECAY'],
      history: [record('SEEDS', 'SPACE', 0)],
    });
    const view = projectBoard(s, w, 3);
    expect(view.locked).not.toContain('S');
  });
});

describe('deriveLocked', () => {
  it('locks nothing without a lock source', () => {
    expect(deriveLocked(state(), word(), new Set(['Q', 'Z']))).toEqual([]);
  });

  it('locks proven greys once RL.02 is held', () => {
    const s = state({ relics: [relic('RL.02')] });
    expect(deriveLocked(s, word(), new Set(['Q', 'Z']))).toEqual(['Q', 'Z']);
  });
});

describe('deriveKeyboard is pure', () => {
  it('produces the same result for the same rows', () => {
    const w = word({ history: [record('SLATE', 'CRANE', 0)] });
    const rows = projectBoard(state(), w, 1).rows;
    expect(deriveKeyboard(rows, w)).toEqual(deriveKeyboard(rows, w));
  });
});
