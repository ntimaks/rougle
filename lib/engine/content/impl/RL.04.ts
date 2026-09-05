import type { RelicImpl } from '../types';

/**
 * RANGEFINDER — "Yellow tiles report how many positions off the letter sits,
 * and stop reporting which letter it is."
 *
 * Chain step 3, after corruption, so distance is read off the *reported* state
 * and a lie stays plausible (MECHANICS.md §4.4). Implemented in
 * `feedback/chain.ts`.
 */
export default { chainStep: 3 } satisfies RelicImpl;
