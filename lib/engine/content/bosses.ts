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
  /**
   * Words to clear. The Twins is one word with two solutions, not two words —
   * §3.2's "bosses contain 2, 1 and 5 words" counts its two SOLUTIONS, which
   * §2.3 pays separately, so the run is 20 payouts across 16 words.
   */
  words: number;
  /**
   * What this boss DOES, in the player's words. It lived inside the ticker
   * component, which meant the only statement of a boss's rule was scrolling
   * and clipped at both edges — see R-033.
   */
  rule: string;
  modifiers: ModifierId[];
  deferralDepth: number;
}

/**
 * Act order: the Twins opens, the Cipher is the Act II wall.
 *
 * v1.3's R-019 swapped them, on measurement — the Twins in Act I ended 20.5% of
 * ALL runs, half of every death in the game against 4.3% for the next worst
 * node. Not because Mirror is broken: two solutions for 5.20 guesses beats the
 * ~7.8 two independent words would cost. The problem was variance landing on a
 * hard wall at the END OF THE SHORTEST ACT, with the fewest relics to absorb it
 * and a refill waiting on the other side that a dead run never reached.
 *
 * v2.0 puts the Twins back in Act I, and §12.1 rules that the engine ships that
 * order: a run-long bankroll removes the act boundary the ruling was about, and
 * §2.3 makes a Mirror word TWO payouts rather than one, so a competent solver
 * is paid twice for 5.20 guesses. It changes in the other direction too — there
 * is no refill afterwards to recover from it — which is precisely why it is a
 * thing to measure rather than assert. Watch the Act I death rate against
 * §11.5's 10-20%.
 */
export const BOSSES: Readonly<Record<0 | 1 | 2, BossDef>> = Object.freeze({
  0: {
    actIndex: 0,
    code: 'TWINS',
    name: 'THE TWINS',
    rule: 'TWO SOLUTIONS · ONE BANKROLL',
    // Mirror: two solutions, one bankroll, each guess scored against both,
    // two independent results, no merging (R-005). Each pays out separately.
    words: 1,
    modifiers: ['MIRROR'],
    deferralDepth: 0,
  },
  1: {
    actIndex: 1,
    code: 'CIPHER',
    name: 'THE CIPHER',
    rule: 'NO ANSWER UNTIL THE THIRD GUESS',
    // Deferral at depth 3 instead of Fog's 1 — the identical mechanism.
    words: 1,
    modifiers: [],
    deferralDepth: CONFIG.cipherDeferralDepth,
  },
  2: {
    actIndex: 2,
    code: 'GAUNTLET',
    name: 'THE GAUNTLET',
    rule: 'FIVE WORDS · NO SHOP BETWEEN THEM',
    words: CONFIG.gauntlet.words,
    modifiers: [],
    deferralDepth: 0,
  },
});

/**
 * A boss under a given config.
 *
 * `BOSSES` is frozen at import against the default CONFIG, so the numbers that
 * MECHANICS.md states reached the engine as constants and ignored the harness's
 * override entirely. A sweep of the Gauntlet's pool from 14 down to 8 returned
 * six byte-identical rows, which reads exactly like "not a difficulty lever"
 * and is really "not wired up". §13 I-31.
 *
 * The engine takes every boss through here. `BOSSES` stays exported for the UI
 * and the report, which only ever run on the default config and want the names
 * and rule text.
 */
export function bossFor(actIndex: 0 | 1 | 2, cfg: Readonly<GameConfig> = CONFIG): BossDef {
  const def = BOSSES[actIndex];
  switch (def.code) {
    case 'GAUNTLET':
      return { ...def, words: cfg.gauntlet.words };
    case 'CIPHER':
      return { ...def, deferralDepth: cfg.cipherDeferralDepth };
    default:
      return def;
  }
}
