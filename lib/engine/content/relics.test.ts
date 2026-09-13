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
const solved = (guessesUsed: number, kind = 'WORD', length = 5) => ({
  nodeId: 'n1',
  guessesUsed,
  length,
  kind,
});
const payout = (guessesUsed: number, openerUniqueLetters = 5, length = 5) => ({
  guessesUsed,
  length,
  openerUniqueLetters,
});

/** Fire a hook on the MK.II tier of a relic. §6.7 — one upgrade, per instance. */
function fireMk2<K extends HookName>(
  code: string,
  hook: K,
  payload: HookPayloads[K],
  relicState = {},
  over: Partial<GameState> = {},
): Effect[] {
  const handler = IMPLEMENTATIONS[code]?.hooks?.[hook];
  if (!handler) throw new Error(`${code} has no ${hook} handler`);
  const c = ctx(code, relicState, over);
  const self = { ...c.self, upgraded: true };
  return (handler as (c: HookContext, p: HookPayloads[K]) => Effect[])(
    { ...c, self, state: { ...c.state, relics: [self] } },
    payload,
  );
}

describe('INFO relics', () => {
  it('RL.01 LEXICON reveals the vowel count at word start', () => {
    expect(fire('RL.01', 'onWordStart', wordStart)).toEqual([
      { kind: 'REVEAL_META', field: 'vowelCount' },
    ]);
  });

  it('RL.03 PALIMPSEST reveals a shared letter', () => {
    expect(fire('RL.03', 'onWordStart', wordStart)).toEqual([
      { kind: 'REVEAL_META', field: 'sharedLetter' },
    ]);
  });

  it('RL.26 THE LANTERN lights after two failed guesses, once, and scales on failure', () => {
    const base = { ...initialState('RELICSED', 'CH.01') };
    const withWord = {
      ...base,
      word: { ...(base.word ?? ({} as never)), nodeId: 'n1' } as never,
    } as Partial<GameState>;
    expect(fire('RL.26', 'onGuessSubmit', { guess: 'CRANE', turn: 0, newUniqueLetters: 5 }, {}, withWord)).toEqual([]);
    expect(fire('RL.26', 'onGuessSubmit', { guess: 'CRANE', turn: 1, newUniqueLetters: 0 }, {}, withWord)).toEqual([]);

    const lit = fire('RL.26', 'onGuessSubmit', { guess: 'CRANE', turn: 2, newUniqueLetters: 0 }, { lit: 0 }, withWord);
    expect(lit.filter((e) => e.kind === 'PRESET_TILE')).toHaveLength(1);
    expect(lit.at(-1)).toMatchObject({ patch: { litNodeId: 'n1', lit: 1 } });

    // Already lit on this node: does not fire again.
    expect(
      fire('RL.26', 'onGuessSubmit', { guess: 'CRANE', turn: 3, newUniqueLetters: 0 }, { litNodeId: 'n1' }, withWord),
    ).toEqual([]);

    // §6.5 — `letters_lit = 1 + floor(counter / 3)`, counter BEFORE this one.
    // So the fourth lighting is the first to give two, not the third.
    const third = fire('RL.26', 'onGuessSubmit', { guess: 'CRANE', turn: 2, newUniqueLetters: 0 }, { lit: 2 }, withWord);
    expect(third.filter((e) => e.kind === 'PRESET_TILE')).toHaveLength(1);
    const fourth = fire('RL.26', 'onGuessSubmit', { guess: 'CRANE', turn: 2, newUniqueLetters: 0 }, { lit: 3 }, withWord);
    expect(fourth.filter((e) => e.kind === 'PRESET_TILE')).toHaveLength(2);

    // MK.II lights after ONE failed guess, not two.
    expect(
      fireMk2('RL.26', 'onGuessSubmit', { guess: 'CRANE', turn: 1, newUniqueLetters: 0 }, { lit: 0 }, withWord),
    ).not.toEqual([]);
  });

  it('RL.02, RL.04 and RL.29 are chain steps, not hooks', () => {
    expect(IMPLEMENTATIONS['RL.02']!.chainStep).toBe(6);
    expect(IMPLEMENTATIONS['RL.04']!.chainStep).toBe(3);
    expect(IMPLEMENTATIONS['RL.29']!.chainStep).toBe(2);
  });

  it('RL.06 CARTOGRAPHER reveals the act map on entering a node', () => {
    // §6.1 dropped onActStart, and onNodeEnter also covers taking the relic
    // mid-act — which is the case that matters, since the map you are standing
    // on is the one you wanted to read.
    expect(fire('RL.06', 'onNodeEnter', { nodeId: 'n1', kind: 'SHOP' })).toEqual([
      { kind: 'REVEAL_MAP_MODIFIERS' },
    ]);
  });
});

describe('payout relics — §2.5 Clamps A and B', () => {
  it('every payout relic bids, and none of them grants', () => {
    // A BANKROLL grant from onPayout would bypass both clamps, which is exactly
    // what §2.5 forbids. This is the rule, stated once, over every relic that
    // has the hook — so a new one cannot get it wrong quietly.
    const payoutRelics = Object.entries(IMPLEMENTATIONS).filter(([, i]) => i.hooks?.onPayout);
    expect(payoutRelics.length).toBeGreaterThan(3);
    for (const [code] of payoutRelics) {
      for (const guesses of [1, 2, 3, 4, 5, 6]) {
        const effects = fire(code, 'onPayout', payout(guesses), { streak: 2 });
        for (const e of effects) {
          expect(
            ['PAYOUT_BONUS', 'PAYOUT_DISCOUNT'].includes(e.kind),
            `${code} returned ${e.kind} from onPayout`,
          ).toBe(true);
        }
      }
    }
  });

  it('RL.11 FLYWHEEL bids +2 on a solve of two or fewer, +3 upgraded', () => {
    expect(fire('RL.11', 'onPayout', payout(2))).toEqual([
      { kind: 'PAYOUT_BONUS', amount: 2, source: 'RL.11' },
    ]);
    // R-048: a `<= 3` trigger is worth 0.43 a word whatever the bonus, which is
    // the boss allowance — so a COMMON cannot use it.
    expect(fire('RL.11', 'onPayout', payout(3))).toEqual([]);
    expect(fireMk2('RL.11', 'onPayout', payout(2))).toEqual([
      { kind: 'PAYOUT_BONUS', amount: 3, source: 'RL.11' },
    ]);
  });

  it('RL.12 HOT STREAK bids the streak so far, capped, and moves it separately', () => {
    // The bonus is the streak BEFORE this solve, so the first fast solve pays
    // nothing. Otherwise it is RL.11 with extra steps.
    expect(fire('RL.12', 'onPayout', payout(2), { streak: 0 })).toEqual([]);
    expect(fire('RL.12', 'onPayout', payout(2), { streak: 1 })).toEqual([
      { kind: 'PAYOUT_BONUS', amount: 1, source: 'RL.12' },
    ]);
    expect(fire('RL.12', 'onPayout', payout(2), { streak: 9 })).toEqual([
      { kind: 'PAYOUT_BONUS', amount: 3, source: 'RL.12' },
    ]);
    expect(fire('RL.12', 'onPayout', payout(3), { streak: 3 })).toEqual([]);

    expect(fire('RL.12', 'onWordSolved', solved(2), { streak: 1 })).toEqual([
      { kind: 'SET_RELIC_STATE', instanceId: 'RL.12#1', patch: { streak: 2 } },
    ]);
    expect(fire('RL.12', 'onWordSolved', solved(3), { streak: 4 })).toEqual([
      { kind: 'SET_RELIC_STATE', instanceId: 'RL.12#1', patch: { streak: 0 } },
    ]);
    // §6.7 rule 1 — MK.II accelerates the counter rather than replacing it:
    // cap 5, and a slow solve HALVES rather than clearing.
    expect(fireMk2('RL.12', 'onPayout', payout(2), { streak: 9 })).toEqual([
      { kind: 'PAYOUT_BONUS', amount: 5, source: 'RL.12' },
    ]);
    expect(fireMk2('RL.12', 'onWordSolved', solved(3), { streak: 5 })).toEqual([
      { kind: 'SET_RELIC_STATE', instanceId: 'RL.12#1', patch: { streak: 2 } },
    ]);
  });

  it('RL.13 OPENING GAMBIT discounts a guess, and never refunds one', () => {
    expect(fire('RL.13', 'onPayout', payout(2, 5))).toEqual([
      { kind: 'PAYOUT_DISCOUNT', guesses: 1, source: 'RL.13' },
    ]);
    // Both gates. The opener gate alone was met essentially always, which made
    // the relic an unconditional +1 worth 0.98 a word.
    expect(fire('RL.13', 'onPayout', payout(2, 3))).toEqual([]);
    expect(fire('RL.13', 'onPayout', payout(3, 5))).toEqual([]);
    expect(fireMk2('RL.13', 'onPayout', payout(3, 3))).toHaveLength(1);
  });

  it('CH.02 THE GAMBLER is the one thing allowed a solve-in-three trigger', () => {
    expect(fire('CH.02', 'onPayout', payout(3))).toEqual([
      { kind: 'PAYOUT_BONUS', amount: 1, source: 'CH.02' },
    ]);
    expect(fire('CH.02', 'onPayout', payout(4))).toEqual([]);
  });

  it('RL.31 ROSETTA SLAB pays for its green with a NEGATIVE bid', () => {
    // Negative, not a BANKROLL charge: Clamp B takes the largest bid, so a
    // negative can never win the clamp and never cancels a relic's bonus.
    expect(fire('RL.31', 'onWordStart', wordStart)).toEqual([{ kind: 'PRESET_TILE' }]);
    expect(fire('RL.31', 'onPayout', payout(3))).toEqual([
      { kind: 'PAYOUT_BONUS', amount: -1, source: 'RL.31' },
    ]);
    // §6.7 rule 2 — a boss relic upgrades by shrinking its drawback.
    expect(fireMk2('RL.31', 'onPayout', payout(3))).toEqual([]);
  });
});

describe('RISK relics', () => {
  it('RL.14 THE GUILLOTINE scales on every head it takes', () => {
    expect(fire('RL.14', 'onWordSolved', solved(2), { heads: 0 })[0]).toMatchObject({ delta: 40 });
    expect(fire('RL.14', 'onWordSolved', solved(2), { heads: 3 })[0]).toMatchObject({ delta: 100 });
    expect(fire('RL.14', 'onWordSolved', solved(2), { heads: 0 }).at(-1)).toMatchObject({
      patch: { heads: 1 },
    });
    expect(fire('RL.14', 'onWordSolved', solved(3))).toEqual([]);
    expect(fire('RL.14', 'onWordSolved', solved(5))[0]).toMatchObject({ delta: -30 });
    // The counter must not tick on the penalty — it is HEADS TAKEN, not solves.
    expect(fire('RL.14', 'onWordSolved', solved(5))).toHaveLength(1);
    expect(fireMk2('RL.14', 'onWordSolved', solved(2), { heads: 2 })[0]).toMatchObject({ delta: 100 });
  });

  it('RL.19 THE MOTH gorges on a schedule, without naming the letters', () => {
    // §6.5 — the counter is the SCHEDULE, not a multiplier. It pays 1 on every
    // fourth word and the payment never grows. It used to pay at every word
    // start: 2.50 a word, more than the entire §2.3 bleed, on an UNCOMMON.
    const quiet = fire('RL.19', 'onWordStart', wordStart, { words: 0 });
    expect(quiet).toEqual([
      { kind: 'SET_RELIC_STATE', instanceId: 'RL.19#1', patch: { words: 1 } },
    ]);

    const gorge = fire('RL.19', 'onWordStart', wordStart, { words: 3 });
    expect(gorge.filter((e) => e.kind === 'LOCK_LETTER')).toHaveLength(2);
    expect(gorge.filter((e) => e.kind === 'BANKROLL')).toEqual([
      { kind: 'BANKROLL', delta: 1, reason: 'RL.19' },
    ]);
    // The relic must not see the solution: the engine draws from
    // eligibleLettersForRemoval, so no letter is specified here.
    for (const e of gorge) expect(e).not.toHaveProperty('letter');

    // MK.II gorges every third word instead of every fourth.
    expect(fireMk2('RL.19', 'onWordStart', wordStart, { words: 2 }).length).toBeGreaterThan(1);
  });

  it('RL.20 BLINDFOLD pays bankroll for a near miss, and only when armed', () => {
    const base = initialState('RELICSED', 'CH.01');
    const withWord = {
      ...base,
      word: { ...(base.word ?? ({} as never)), nodeId: 'n1', solutions: ['CRANE'], history: [] } as never,
    } as Partial<GameState>;
    const armed = { blindNodeId: 'n1', blindTurn: 0 };
    expect(
      fire('RL.20', 'onGuessSubmit', { guess: 'CRANK', turn: 0, newUniqueLetters: 5 }, armed, withWord),
    ).toEqual([{ kind: 'BANKROLL', delta: 4, reason: 'RL.20' }]);
    expect(
      fire('RL.20', 'onGuessSubmit', { guess: 'STOMP', turn: 0, newUniqueLetters: 5 }, armed, withWord),
    ).toEqual([]);
    // Not armed on this turn: nothing, win or lose.
    expect(
      fire('RL.20', 'onGuessSubmit', { guess: 'CRANK', turn: 1, newUniqueLetters: 5 }, armed, withWord),
    ).toEqual([]);
    // MK.II accepts within two.
    expect(
      fireMk2('RL.20', 'onGuessSubmit', { guess: 'CRAMP', turn: 0, newUniqueLetters: 5 }, armed, withWord),
    ).toHaveLength(1);
  });

  it('RL.21 ALL IN returns the stake or takes it, as a bankroll delta', () => {
    const staked = { wager: 3, wagerNodeId: 'n1' };
    expect(fire('RL.21', 'onWordSolved', solved(3), staked)[0]).toEqual({
      kind: 'BANKROLL',
      delta: 3,
      reason: 'RL.21',
    });
    expect(fire('RL.21', 'onWordSolved', solved(4), staked)[0]).toEqual({
      kind: 'BANKROLL',
      delta: -3,
      reason: 'RL.21',
    });
    // MK.II — a lost wager costs half, rounded down.
    expect(fireMk2('RL.21', 'onWordSolved', solved(4), staked)[0]).toEqual({
      kind: 'BANKROLL',
      delta: -1,
      reason: 'RL.21',
    });
  });
});

describe('GREED and ROUTE relics', () => {
  it('RL.23 THE TIN CUP pays its rate on every guess and scales on FAILURE', () => {
    expect(fire('RL.23', 'onGuessSubmit', { guess: 'CRANE', turn: 4, newUniqueLetters: 0 }, { rate: 2 })).toEqual([
      { kind: 'GOLD', delta: 2, reason: 'RL.23' },
    ]);
    expect(fire('RL.23', 'onGuessSubmit', { guess: 'CRANE', turn: 4, newUniqueLetters: 0 }, { rate: 7 })).toEqual([
      { kind: 'GOLD', delta: 7, reason: 'RL.23' },
    ]);
    // §6.5 — one of two failure-scaling relics, and the rate never falls.
    expect(fire('RL.23', 'onWordSolved', solved(4), { rate: 2 })).toEqual([
      { kind: 'SET_RELIC_STATE', instanceId: 'RL.23#1', patch: { rate: 3 } },
    ]);
    expect(fire('RL.23', 'onWordSolved', solved(3), { rate: 2 })).toEqual([]);
    expect(fireMk2('RL.23', 'onWordSolved', solved(4), { rate: 2 })).toEqual([
      { kind: 'SET_RELIC_STATE', instanceId: 'RL.23#1', patch: { rate: 4 } },
    ]);
  });

  it('RL.15 BLOODHOUND trades an elite\'s gold for bankroll', () => {
    const elite = fire('RL.15', 'onWordSolved', solved(3, 'ELITE'));
    expect(elite).toEqual([
      { kind: 'BANKROLL', delta: 1, reason: 'RL.15' },
      { kind: 'GOLD', delta: -CONFIG.rewards.elite, reason: 'RL.15' },
    ]);
    expect(fire('RL.15', 'onWordSolved', solved(3, 'WORD'))).toEqual([]);
    // MK.II reaches bosses — and does NOT take their gold.
    expect(fire('RL.15', 'onWordSolved', solved(3, 'BOSS'))).toEqual([]);
    expect(fireMk2('RL.15', 'onWordSolved', solved(3, 'BOSS'))).toEqual([
      { kind: 'BANKROLL', delta: 1, reason: 'RL.15' },
    ]);
  });

  it('RL.22 POLYGLOT doubles long-word gold and raises the next shop a tier', () => {
    expect(fire('RL.22', 'onWordSolved', solved(3, 'WORD', 6))).toEqual([
      { kind: 'GOLD', delta: CONFIG.rewards.word, reason: 'RL.22' },
    ]);
    expect(fire('RL.22', 'onWordSolved', solved(3, 'WORD', 5))).toEqual([]);
    expect(fire('RL.22', 'onShopOpen', { nodeId: 'n1', afterLength: 7, afterKind: 'WORD' })).toEqual([
      { kind: 'SET_COUNTER', key: 'shop:tierUp', value: 1 },
    ]);
    expect(fire('RL.22', 'onShopOpen', { nodeId: 'n1', afterLength: 5, afterKind: 'WORD' })).toEqual([]);
    // §6.7 rule 2 — no drawback to shrink, so it upgrades on REACH.
    expect(fireMk2('RL.22', 'onWordSolved', solved(3, 'BOSS', 5))).toHaveLength(1);
  });

  it('RL.09 THE ANVIL charges its two once, at run start', () => {
    // Once a RUN, not once an act. Under a per-act pool it cut the cap three
    // times a run; §2.1 has one stake and one start.
    expect(fire('RL.09', 'onRunStart', {})).toEqual([
      { kind: 'BANKROLL', delta: -2, reason: 'RL.09' },
    ]);
    // MK.II pays it back at the first forge, and only the first.
    expect(fire('RL.09', 'onNodeEnter', { nodeId: 'n1', kind: 'FORGE' })).toEqual([]);
    const back = fireMk2('RL.09', 'onNodeEnter', { nodeId: 'n1', kind: 'FORGE' }, { paidBack: false });
    expect(back[0]).toMatchObject({ kind: 'BANKROLL', delta: 2 });
    expect(fireMk2('RL.09', 'onNodeEnter', { nodeId: 'n1', kind: 'FORGE' }, { paidBack: true })).toEqual([]);
    expect(fireMk2('RL.09', 'onNodeEnter', { nodeId: 'n1', kind: 'SHOP' }, { paidBack: false })).toEqual([]);
  });

  it('RL.30 OUROBOROS returns you from zero, once', () => {
    expect(fire('RL.30', 'onBankrollChange', { delta: -1, bankroll: 0 })[0]).toMatchObject({
      kind: 'BANKROLL',
      delta: 8,
    });
    expect(fire('RL.30', 'onBankrollChange', { delta: -1, bankroll: 1 })).toEqual([]);
    expect(fire('RL.30', 'onBankrollChange', { delta: -1, bankroll: 0 }, { spent: true })).toEqual([]);
    expect(fireMk2('RL.30', 'onBankrollChange', { delta: -1, bankroll: 0 })[0]).toMatchObject({
      delta: 12,
    });
  });
});

describe('character innates', () => {
  it('CH.01 THE LINGUIST sees the vowel count on every word', () => {
    expect(fire('CH.01', 'onWordStart', wordStart)).toEqual([
      { kind: 'REVEAL_META', field: 'vowelCount' },
    ]);
  });
});

describe('consumables', () => {
  it('every consumable consumes itself', () => {
    for (const code of ['CN.01', 'CN.02', 'CN.03', 'CN.05']) {
      const effects = fire(code, 'onUse', { instanceId: `${code}#1`, payload: {} });
      expect(effects.some((e) => e.kind === 'CONSUME'), code).toBe(true);
    }
  });

  it('CN.03 THE DECANTER pours 4, and the cap is the bank\'s job', () => {
    const effects = fire('CN.03', 'onUse', { instanceId: 'CN.03#1', payload: {} });
    expect(effects[0]).toEqual({ kind: 'BANKROLL', delta: 4, reason: 'CN.03' });
  });

  it('CN.02 THE POULTICE clears modifiers', () => {
    const effects = fire('CN.02', 'onUse', { instanceId: 'CN.02#1', payload: {} });
    expect(effects[0]).toEqual({ kind: 'CLEAR_MODIFIERS' });
  });
});
