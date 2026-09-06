import type { RelicImpl } from '../types';

/**
 * INSURANCE — "The first emergency guess of each act is free." Two at MK.II.
 *
 * Deliberately empty. The price is read by `emergencyCost` from the held relic,
 * because a price is a query and `Effect` is the vocabulary of state change —
 * the same reasoning as RL.08 The Fence and the §2.5 ladder.
 *
 * A free purchase still consumes a rung of the §2.3 ladder. Insurance buys the
 * price, not the cap: letting it also add a fourth out would make it a far
 * bigger relic than its rule describes.
 */
export default {} satisfies RelicImpl;
