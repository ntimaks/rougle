import { describe, expect, it } from 'vitest';
import { CONFIG } from '../core/config';
import { initialState } from '../core/reducer';
import { activeReveals, orderForSuppression, revealAllowed } from './infoCap';
import type { GameState } from '../core/state';
import '../words/all';

/** R-10 / MECHANICS.md §6.3 — at most two pre-guess reveals on any word. */

function holding(...codes: string[]): GameState {
  return {
    ...initialState('CAPSEED1', 'CH.01'),
    relics: codes.map((code, i) => ({
      instanceId: `${code}#${i}`,
      code,
      state: {},
      acquiredAt: i,
    })),
  };
}

describe('the information cap', () => {
  it('lets two reveals through and suppresses the rest', () => {
    // CH.01's innate is itself a reveal, so it competes for a slot.
    const s = holding('CH.01', 'RL.01', 'RL.05', 'RL.03');
    const { active, suppressed } = activeReveals(s);
    expect(active).toHaveLength(CONFIG.preGuessRevealCap);
    expect(suppressed).toHaveLength(2);
  });

  it('ignores relics that are not pre-guess reveals', () => {
    const s = holding('RL.02', 'RL.04', 'RL.26', 'RL.01');
    const { active, suppressed } = activeReveals(s);
    expect(active).toEqual(['RL.01#3']);
    expect(suppressed).toEqual([]);
  });

  it('suppresses in acquisition order, earliest wins — the spec as written', () => {
    const s = holding('RL.01', 'RL.05', 'RL.03');
    expect(activeReveals(s).active).toEqual(['RL.01#0', 'RL.05#1']);
    expect(activeReveals(s).suppressed).toEqual(['RL.03#2']);
  });

  /**
   * §13 I-03. Acquisition order means a BOSS relic taken late is suppressed by
   * two COMMONs taken early — and RL.31 Rosetta Slab costs 3 act pool for the
   * privilege. The proposed fix (suppress by ascending rarity) is a RULES
   * change, so it is not implemented here; this test pins the current, spec-
   * faithful behaviour so the change is visible when the ruling lands.
   */
  it('documents the I-03 trap rather than quietly fixing it', () => {
    const s = holding('RL.01', 'RL.05', 'RL.31');
    expect(activeReveals(s).suppressed).toEqual(['RL.31#2']);
    expect(revealAllowed(s, 'RL.31#2')).toBe(false);
  });

  it('orderForSuppression is a stable sort on acquiredAt', () => {
    const items = [
      { instanceId: 'c', code: 'RL.05', acquiredAt: 3 },
      { instanceId: 'a', code: 'RL.01', acquiredAt: 1 },
      { instanceId: 'b', code: 'RL.03', acquiredAt: 2 },
    ];
    expect(orderForSuppression(items).map((i) => i.instanceId)).toEqual(['a', 'b', 'c']);
  });

  it('a suppressed reveal does not fire at word start', () => {
    // Three reveal relics; the third never gets to reveal anything.
    const s = holding('RL.01', 'RL.05', 'RL.03');
    expect(revealAllowed(s, 'RL.01#0')).toBe(true);
    expect(revealAllowed(s, 'RL.05#1')).toBe(true);
    expect(revealAllowed(s, 'RL.03#2')).toBe(false);
  });
});
