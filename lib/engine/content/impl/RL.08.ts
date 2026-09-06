import type { RelicImpl } from '../types';

/**
 * THE FENCE — "Reveals cost 30% less." (R-020, MECHANICS §2.5)
 *
 * Deliberately empty. The discount is declared as `reveal_discount` in
 * relics.json and read by `revealCost`, because a price is a query and `Effect`
 * is the vocabulary of state *change* — there is nothing here to apply.
 *
 * Reading it from the registry rather than firing a hook also means the next
 * discount relic is a line of JSON: `revealCost` already sums whatever every
 * held relic declares. A hook would have made this one relic work and left the
 * second to reimplement it.
 *
 * The JSON's `hook: "onWordStart"` is nominal — the price is fixed for the
 * duration of a word, so that is when it takes effect — and no handler
 * corresponds to it.
 */
export default {} satisfies RelicImpl;
