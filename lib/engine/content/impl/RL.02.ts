import type { RelicImpl } from '../types';

/**
 * THE SIEVE — "Grey letters fall out of the keyboard and stay out for the rest
 * of the word."
 *
 * Chain step 6 (derivation). The mechanism is not a tile transform: it reads
 * the projected board and removes letters from the keyboard, so it lives in
 * `feedback/projection.ts#deriveKeyboard` and is gated by `isLetterAvailable`,
 * which also gates `canDispatch` — a physical keyboard must not bypass the lock.
 */
export default { chainStep: 6 } satisfies RelicImpl;
