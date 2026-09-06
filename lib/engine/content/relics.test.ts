import { describe, expect, it } from 'vitest';
import { IMPLEMENTATIONS } from './impl';
import { CONFIG } from '../core/config';
import { initialState } from '../core/reducer';
import type { Effect } from '../core/effects';
import type { GameState, RelicInstance } from '../core/state';
import type { HookContext, HookName, HookPayloads } from './types';
import '../words/all';

/**
 * AGENTS.md §3: every relic gets a unit test firing its hook. A relic that
 * cannot be tested in three lines is a relic that has leaked into the reducer.
 */

function ctx(code: string, relicState: Record<string, unknown> = {}, over: Partial<GameState> = {}): HookContext {
  const self: RelicInstance = { instanceId: `${code}#1`, code, state: relicState, acquiredAt: 1, upgraded: false };
  return {
    state: { ...initialState('RELICSED', 'CH.01'), relics: [self], ...over },
    self,
    rng: () => 0.25,
    cfg: CONFIG,
  };
}

function fire<K extends HookName>(code: string, hook: K, payload: HookPayloads[K], relicState = {}, over: Partial<GameState> = {}): Effect[] {
  const handler = IMPLEMENTATIONS[code]?.hooks?.[hook];
  if (!handler) throw new Error(`${code} has no ${hook} handler`);
  return (handler as (c: HookContext, p: HookPayloads[K]) => Effect[])(ctx(code, relicState, over), payload);
}

const wordStart = { nodeId: 'n1', solutions: ['CRANE'], previousSolution: null };

describe('INFO relics', () => {
  it('RL.01 LEXICON reveals the vowel count at word start', () => {
    expect(fire('RL.01', 'onWordStart', wordStart)).toEqual([
      { kind: 'REVEAL_META', field: 'vowelCount' },
    ]);
  });

  it('RL.05 THE CONCORDANCE reveals the repeat flag', () => {
    expect(fire('RL.05', 'onWordStart', wordStart)).toEqual([
      { kind: 'REVEAL_META', field: 'hasRepeat' },
    ]);
  });

  it('RL.03 PALIMPSEST reveals a shared letter', () => {
    expect(fire('RL.03', 'onWordStart', wordStart)).toEqual([
      { kind: 'REVEAL_META', field: 'sharedLetter' },
    ]);
  });

  it('RL.26 THE LANTERN lights the first letter after two failed guesses, once', () => {
    const base = { ...initialState('RELICSED', 'CH.01') };
    const withWord = {
      ...base,
      word: { ...(base.word ?? ({} as never)), nodeId: 'n1' } as never,
    } as Partial<GameState>;
    expect(fire('RL.26', 'onGuessSubmit', { guess: 'CRANE', turn: 0, newUniqueLetters: 5 }, {}, withWord)).toEqual([]);
    expect(fire('RL.26', 'onGuessSubmit', { guess: 'CRANE', turn: 1, newUniqueLetters: 0 }, {}, withWord)).toEqual([]);
    const lit = fire('RL.26', 'onGuessSubmit', { guess: 'CRANE', turn: 2, newUniqueLetters: 0 }, {}, withWord);
    expect(lit[0]).toEqual({ kind: 'PRESET_TILE', index: 0 });
    // Already lit on this node: does not fire again.
    expect(
      fire('RL.26', 'onGuessSubmit', { guess: 'CRANE', turn: 3, newUniqueLetters: 0 }, { litNodeId: 'n1' }, withWord),
    ).toEqual([]);
  });

  it('RL.02 and RL.04 are chain steps, not hooks', () => {
    expect(IMPLEMENTATIONS['RL.02']!.chainStep).toBe(6);
    expect(IMPLEMENTATIONS['RL.04']!.chainStep).toBe(3);
    expect(IMPLEMENTATIONS['RL.29']!.chainStep).toBe(2);
  });
});

describe('TEMPO relics', () => {
  it('RL.11 FLYWHEEL refunds one on a solve of three or fewer', () => {
    expect(fire('RL.11', 'onWordSolved', { nodeId: 'n1', guessesUsed: 3 })).toEqual([
      { kind: 'REFUND', amount: 1, source: 'RL.11' },
    ]);
    expect(fire('RL.11', 'onWordSolved', { nodeId: 'n1', guessesUsed: 4 })).toEqual([]);
  });

  it('RL.10 THE METRONOME pays only on exactly three', () => {
    expect(fire('RL.10', 'onWordSolved', { nodeId: 'n1', guessesUsed: 3 })).toHaveLength(1);
    expect(fire('RL.10', 'onWordSolved', { nodeId: 'n1', guessesUsed: 2 })).toEqual([]);
  });

  it('RL.13 OPENING GAMBIT refunds the first guess when it is wide enough', () => {
    expect(fire('RL.13', 'onGuessSubmit', { guess: 'CRANE', turn: 0, newUniqueLetters: 5 })).toHaveLength(1);
    expect(fire('RL.13', 'onGuessSubmit', { guess: 'GEESE', turn: 0, newUniqueLetters: 3 })).toEqual([]);
    expect(fire('RL.13', 'onGuessSubmit', { guess: 'CRANE', turn: 1, newUniqueLetters: 5 })).toEqual([]);
  });

  it('RL.12 HOT STREAK counts consecutive fast solves and resets on a slow one', () => {
    expect(fire('RL.12', 'onWordSolved', { nodeId: 'n1', guessesUsed: 3 }, { streak: 1 })).toEqual([
      { kind: 'SET_RELIC_STATE', instanceId: 'RL.12#1', patch: { streak: 2 } },
    ]);
    expect(fire('RL.12', 'onWordSolved', { nodeId: 'n1', guessesUsed: 5 }, { streak: 4 })).toEqual([
      { kind: 'SET_RELIC_STATE', instanceId: 'RL.12#1', patch: { streak: 0 } },
    ]);
    expect(fire('RL.12', 'onWordStart', wordStart, { streak: 3 })).toEqual([{ kind: 'PRESET_TILE' }]);
    expect(fire('RL.12', 'onWordStart', wordStart, { streak: 2 })).toEqual([]);
  });
});

describe('RISK relics', () => {
  it('RL.18 THE WISHBONE is a coin flip on the addressed roll', () => {
    expect(fire('RL.18', 'onGuessSubmit', { guess: 'CRANE', turn: 0, newUniqueLetters: 5 })).toHaveLength(1);
  });

  it('RL.14 THE GUILLOTINE pays fast and punishes slow, per R-004', () => {
    expect(fire('RL.14', 'onWordSolved', { nodeId: 'n1', guessesUsed: 2 })[0]).toMatchObject({ delta: 40 });
    expect(fire('RL.14', 'onWordSolved', { nodeId: 'n1', guessesUsed: 3 })).toEqual([]);
    expect(fire('RL.14', 'onWordSolved', { nodeId: 'n1', guessesUsed: 5 })[0]).toMatchObject({ delta: -20 });
  });

  it('RL.19 THE MOTH eats a letter and pays for it, without naming the letter', () => {
    const effects = fire('RL.19', 'onWordStart', wordStart);
    expect(effects[0]).toEqual({ kind: 'LOCK_LETTER', source: 'RL.19' });
    // The relic must not see the solution: the engine draws from
    // eligibleLettersForRemoval, so no letter is specified here.
    expect(effects[0]).not.toHaveProperty('letter');
    expect(effects[1]).toMatchObject({ kind: 'REFUND', amount: 1 });
  });
});

describe('GREED and ROUTE relics', () => {
  it('RL.23 THE TIN CUP pays on every guess', () => {
    expect(fire('RL.23', 'onGuessSubmit', { guess: 'CRANE', turn: 4, newUniqueLetters: 0 })).toEqual([
      { kind: 'GOLD', delta: 5, reason: 'RL.23' },
    ]);
  });

  it('RL.24 THE LEDGER tops leftover conversion up from 10g to 15g', () => {
    expect(fire('RL.24', 'onActEnd', { actIndex: 0, leftover: 4 })).toEqual([
      { kind: 'GOLD', delta: 20, reason: 'RL.24' },
    ]);
    expect(fire('RL.24', 'onActEnd', { actIndex: 0, leftover: 0 })).toEqual([]);
  });

  it('RL.06 CARTOGRAPHER reveals the act map modifiers', () => {
    expect(fire('RL.06', 'onActStart', { actIndex: 0 })).toEqual([{ kind: 'REVEAL_MAP_MODIFIERS' }]);
  });
});

describe('character innates', () => {
  it('CH.01 THE LINGUIST sees the vowel count on every word', () => {
    expect(fire('CH.01', 'onWordStart', wordStart)).toEqual([
      { kind: 'REVEAL_META', field: 'vowelCount' },
    ]);
  });

  it('CH.02 THE GAMBLER refunds two, which Rule B stops stacking with Flywheel', () => {
    const gambler = fire('CH.02', 'onWordSolved', { nodeId: 'n1', guessesUsed: 3 })[0]!;
    const flywheel = fire('RL.11', 'onWordSolved', { nodeId: 'n1', guessesUsed: 3 })[0]!;
    expect(gambler).toMatchObject({ amount: 2 });
    expect(flywheel).toMatchObject({ amount: 1 });
    // The pool reducer takes the larger; see pool.test.ts for the composed case.
  });
});

describe('consumables', () => {
  it('every consumable consumes itself', () => {
    for (const code of ['CN.01', 'CN.02', 'CN.03', 'CN.05']) {
      const effects = fire(code, 'onUse', { instanceId: `${code}#1`, payload: {} });
      expect(effects.some((e) => e.kind === 'CONSUME'), code).toBe(true);
    }
  });

  it('CN.03 THE DECANTER pours a POOL effect, not a REFUND', () => {
    const effects = fire('CN.03', 'onUse', { instanceId: 'CN.03#1', payload: {} });
    expect(effects[0]).toEqual({ kind: 'POOL', delta: 3, reason: 'CN.03' });
  });

  it('CN.02 THE POULTICE clears modifiers', () => {
    const effects = fire('CN.02', 'onUse', { instanceId: 'CN.02#1', payload: {} });
    expect(effects[0]).toEqual({ kind: 'CLEAR_MODIFIERS' });
  });
});
