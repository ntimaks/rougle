import { CONFIG } from '../core/config';
import type { ModifierId } from '../core/state';

/**
 * Bosses. MECHANICS.md §7. All three reuse mechanisms built earlier; none needs
 * bespoke rules code, which is the test of whether those mechanisms are right.
 */
export interface BossDef {
  actIndex: 0 | 1 | 2;
  code: 'TWINS' | 'CIPHER' | 'GAUNTLET';
  name: string;
  /** Words to clear. The Twins is one word with two solutions, not two words. */
  words: number;
  modifiers: ModifierId[];
  deferralDepth: number;
  /** The Gauntlet runs on its own pool, untouched by and untouching the act pool. */
  ownPool: number | null;
}

export const BOSSES: Readonly<Record<0 | 1 | 2, BossDef>> = Object.freeze({
  0: {
    actIndex: 0,
    code: 'TWINS',
    name: 'THE TWINS',
    // Mirror: two solutions, one pool, each guess scored against both,
    // two independent results, no merging (R-005).
    words: 1,
    modifiers: ['MIRROR'],
    deferralDepth: 0,
    ownPool: null,
  },
  1: {
    actIndex: 1,
    code: 'CIPHER',
    name: 'THE CIPHER',
    // Deferral at depth 3 instead of Fog's 1 — the identical mechanism.
    words: 1,
    modifiers: [],
    deferralDepth: CONFIG.cipherDeferralDepth,
    ownPool: null,
  },
  2: {
    actIndex: 2,
    code: 'GAUNTLET',
    name: 'THE GAUNTLET',
    words: CONFIG.gauntlet.words,
    modifiers: [],
    deferralDepth: 0,
    ownPool: CONFIG.gauntlet.pool,
  },
});
