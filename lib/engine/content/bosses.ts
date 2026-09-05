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

/**
 * Act order, R-019. The Cipher opens; the Twins is the Act II wall.
 *
 * The Twins was the Act I boss and accounted for 20.5% of ALL runs ending —
 * half of every death in the game, against 4.3% for the next worst node. Not
 * because Mirror is broken: two solutions for 5.20 guesses beats the ~7.8 two
 * independent words would cost, exactly as §13 I-10 predicted. The problem is
 * variance landing on a hard wall at the end of the shortest act, with the
 * fewest relics to absorb it. Raising Act I's pool to 28 barely moved it.
 *
 * The Cipher is the better opener despite costing more when cleared (6.53 vs
 * 5.20): its cost is nearly fixed — commit three guesses, read three rows — so
 * it teaches the pool's arithmetic instead of gambling with it.
 */
export const BOSSES: Readonly<Record<0 | 1 | 2, BossDef>> = Object.freeze({
  0: {
    actIndex: 0,
    code: 'CIPHER',
    name: 'THE CIPHER',
    // Deferral at depth 3 instead of Fog's 1 — the identical mechanism.
    words: 1,
    modifiers: [],
    deferralDepth: CONFIG.cipherDeferralDepth,
    ownPool: null,
  },
  1: {
    actIndex: 1,
    code: 'TWINS',
    name: 'THE TWINS',
    // Mirror: two solutions, one pool, each guess scored against both,
    // two independent results, no merging (R-005).
    words: 1,
    modifiers: ['MIRROR'],
    deferralDepth: 0,
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
