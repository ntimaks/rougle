import { describe, expect, it } from 'vitest';
import { BOSSES } from './bosses';
import { CONFIG } from '../core/config';
import { SPEC } from '../../../test/spec';

/** "THE TWINS" -> "The Twins", which is how §8's headings write it. */
const title = (name: string) =>
  name
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** MECHANICS.md §8, and the act order §12.1 rules the engine ships. */
describe('boss order (§8, §12.1)', () => {
  it('the Twins opens the run and the Cipher is the Act II wall', () => {
    expect(BOSSES[0].code).toBe('TWINS');
    expect(BOSSES[1].code).toBe('CIPHER');
    expect(BOSSES[2].code).toBe('GAUNTLET');
  });

  it('the order matches the one the spec states', () => {
    // §8's subsection headings ARE the ruling — §12.1 says the engine ships
    // v2.0's order "because it is stated as document structure rather than a
    // table cell". So the test reads the structure.
    const order = [...SPEC.matchAll(/^### 8\.\d Act (I{1,3}) — (.+)$/gm)].map((m) => m[2]);
    expect(order).toEqual([BOSSES[0].name, BOSSES[1].name, BOSSES[2].name].map(title));
  });

  it('each boss declares the act it sits in', () => {
    for (const act of [0, 1, 2] as const) expect(BOSSES[act].actIndex).toBe(act);
  });
});

describe('boss mechanisms are reused, not bespoke', () => {
  it('the Cipher is deferral at the configured depth', () => {
    expect(BOSSES[1].deferralDepth).toBe(CONFIG.cipherDeferralDepth);
    expect(BOSSES[1].modifiers).toEqual([]);
  });

  it('the Twins is the Mirror modifier and nothing else', () => {
    expect(BOSSES[0].modifiers).toEqual(['MIRROR']);
    expect(BOSSES[0].deferralDepth).toBe(0);
  });

  it('the Gauntlet is five words and no separate pool', () => {
    expect(BOSSES[2].words).toBe(CONFIG.gauntlet.words);
    // §8.3 removed it: "the run-long bankroll makes it unnecessary, and a
    // separate pool broke the one-resource principle."
    expect(BOSSES[2]).not.toHaveProperty('ownPool');
    expect(SPEC).toContain('The v1.1 separate 14-guess pool is removed.');
  });
});
