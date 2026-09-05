import { describe, expect, it } from 'vitest';
import { BOSSES } from './bosses';
import { CONFIG } from '../core/config';

/** MECHANICS.md §7, and the R-019 act order. */
describe('boss order (R-019)', () => {
  it('the Cipher opens the run and the Twins is the Act II wall', () => {
    expect(BOSSES[0].code).toBe('CIPHER');
    expect(BOSSES[1].code).toBe('TWINS');
    expect(BOSSES[2].code).toBe('GAUNTLET');
  });

  it('each boss declares the act it sits in', () => {
    for (const act of [0, 1, 2] as const) expect(BOSSES[act].actIndex).toBe(act);
  });
});

describe('boss mechanisms are reused, not bespoke', () => {
  it('the Cipher is deferral at the configured depth', () => {
    expect(BOSSES[0].deferralDepth).toBe(CONFIG.cipherDeferralDepth);
    expect(BOSSES[0].modifiers).toEqual([]);
  });

  it('the Twins is the Mirror modifier and nothing else', () => {
    expect(BOSSES[1].modifiers).toEqual(['MIRROR']);
    expect(BOSSES[1].deferralDepth).toBe(0);
  });

  it('only the Gauntlet runs on its own pool', () => {
    expect(BOSSES[0].ownPool).toBeNull();
    expect(BOSSES[1].ownPool).toBeNull();
    expect(BOSSES[2].ownPool).toBe(CONFIG.gauntlet.pool);
    expect(BOSSES[2].words).toBe(CONFIG.gauntlet.words);
  });
});
