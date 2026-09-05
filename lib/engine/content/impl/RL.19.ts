import type { RelicImpl } from '../types';

/**
 * THE MOTH — "At every word start it eats one letter off your keyboard and
 * hands you a guess for it. It never eats a letter present in the solution."
 *
 * The letter is omitted so the engine draws it from the shared
 * `eligibleLettersForRemoval(solution)` helper (R-003) — the relic must not
 * see the solution.
 *
 * The refund cannot be granted at word start (nothing has been spent, so Rule A
 * truncates it to nothing); it is queued and granted on a later guess of the
 * same word. See ADR-0005.
 */
export default {
  hooks: {
    onWordStart: () => [
      { kind: 'LOCK_LETTER', source: 'RL.19' },
      { kind: 'REFUND', amount: 1, source: 'RL.19' },
    ],
  },
} satisfies RelicImpl;
