import type { RelicImpl } from '../types';

/**
 * THE MASK — "Fully immune to the Liar Letter modifier. Corruption transforms
 * are skipped entirely."
 *
 * Chain step 2: the corruption step checks for this relic and returns its input
 * untouched. Implemented in `feedback/chain.ts`.
 */
export default { chainStep: 2 } satisfies RelicImpl;
