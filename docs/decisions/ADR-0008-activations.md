# ADR-0008 · Activations are `onUse` with a declared block

**Status:** Accepted. Ruled as MECHANICS.md R-015 (§6.6).
**Ticket:** C-06. Closes §13 I-04, I-05 and I-06.

## Context

Five entries describe something the player *does* at a moment of their choosing,
and each had been assigned a reactive hook it does not fit — The Auditor's "at
any time" on `onGuessSubmit`, All In's wager on `onWordStart`. `onUse` already
had exactly the right shape and `relics.json` scoped it to consumables.

## Decision

`onUse` is open to relics that declare an `activation` block. The block is data;
`lib/engine/core/activation.ts` is the only code that reads it.

Three rules live in the engine rather than in any relic, because a relic that
forgets one is a bug you find in a balance report three weeks later:

1. **The engine charges the cost.** A relic never debits gold or pool for its own
   activation.
2. **An unaffordable activation is refused, not consumed.** The Auditor's "if you
   cannot pay, he does not answer" *is* this rule — and it means a failed attempt
   does not burn the once-per-word cap.
3. **A guess cost may never empty the pool.** Dying to an optional action is
   precisely what the emergency ladder exists to prevent.

Per-word bookkeeping goes in `RelicInstance.state`, keyed by node id — the
generic mechanism relics already use for counters, so `WordState` does not grow
a field per relic and everything survives save/load for free.

Two sub-rulings were needed to finish the work:

- **R-016** — RL.28 Shaved Coin is offered from Act III only. It re-rolls which
  positions lie, and nothing lies before Liar Letter exists. Withholding it beat
  inventing a second clause: a relic that does nothing is a worse reward than a
  relic you were not offered.
- **R-017** — RL.20 Blindfold's "within one letter" is Hamming distance ≤ 1.
  Guess and solution are always the same length, so at most one position may
  differ; transpositions do not count, because "within one letter" reads as one
  letter wrong and a Damerau reading would make the relic stronger than the
  phrase promises.

## Consequences

Five relics move from `PENDING_IMPLEMENTATION` to implemented, taking the
registry from 23 codes to 28 of 36. Three of them are RISK — the archetype had
only Wishbone, Guillotine and The Moth, which made §6.4's archetype weighting
close to meaningless for a RISK build.

Two registry validations were added: a non-consumable on `onUse` must declare an
activation and vice versa, and an uncapped activation must cost something.

**The harness does not yet model activations.** The solver holds these relics
without firing them, so their pick rates and their contribution to the win rate
are understated. The report says so with every sweep.

`registry.ts`'s offerable lists became functions rather than module constants:
relic modules import engine helpers that import the registry, and evaluating
`IMPLEMENTATIONS` mid-cycle read it as undefined. Deferring the filter to call
time removes the hazard instead of relying on import order staying lucky.
