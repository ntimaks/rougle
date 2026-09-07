import { CONFIG, type GameConfig } from '../core/config';
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
  /**
   * What this boss DOES, in the player's words. It lived inside the ticker
   * component, which meant the only statement of a boss's rule was scrolling
   * and clipped at both edges — see R-033.
   */
  rule: string;
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
    rule: 'NO ANSWER UNTIL THE THIRD GUESS',
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
    rule: 'TWO SOLUTIONS · ONE POOL',
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
    rule: `FIVE WORDS · ITS OWN POOL OF ${CONFIG.gauntlet.pool}`,
    words: CONFIG.gauntlet.words,
    modifiers: [],
    deferralDepth: 0,
    ownPool: CONFIG.gauntlet.pool,
  },
});

/**
 * A boss under a given config.
 *
 * `BOSSES` is frozen at import against the default CONFIG, so three numbers
 * that MECHANICS.md states — the Gauntlet's own pool and word count, the
 * Cipher's deferral depth — reached the engine as constants and ignored the
 * harness's override entirely. A sweep of the Gauntlet pool from 14 down to 8
 * therefore returned six byte-identical rows, which reads exactly like "not a
 * difficulty lever" and is really "not wired up". §13 I-31.
 *
 * The engine takes every boss through here. `BOSSES` stays exported for the UI
 * and the report, which only ever run on the default config and want the names
 * and rule text.
 */
export function bossFor(actIndex: 0 | 1 | 2, cfg: Readonly<GameConfig> = CONFIG): BossDef {
  const def = BOSSES[actIndex];
  switch (def.code) {
    case 'GAUNTLET':
      return {
        ...def,
        words: cfg.gauntlet.words,
        ownPool: cfg.gauntlet.pool,
        rule: `FIVE WORDS · ITS OWN POOL OF ${cfg.gauntlet.pool}`,
      };
    case 'CIPHER':
      return { ...def, deferralDepth: cfg.cipherDeferralDepth };
    default:
      return def;
  }
}
