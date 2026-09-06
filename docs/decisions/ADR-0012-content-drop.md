# ADR-0012 · Integrating forge upgrades and events

**Status:** Accepted. Ruled as MECHANICS.md R-021, R-022, R-023 (§6.7, §6.8).
**Source:** three authored files supplied by the designer — a `relics.json` carrying an `upgrade` block per relic, a new `events.json`, and a MECHANICS delta.

## Context

Phase 3 could not be finished as specified. The forge and the event node were named in §3.1's weight table and the S.01–S.12 screen map, and then nowhere else: no upgrade existed for any relic, and exactly one event existed. A node type with one piece of content repeats inside a single run, and a forge with nothing to offer is a dead node on 10% of the map.

The supplied files close both gaps. They also arrived authored against a snapshot of the repo taken **before** the last two merges, which is the interesting part of this decision.

## Decision

**Merge the new content in; do not replace the files.** Applying the supplied `relics.json` wholesale would have reverted, silently:

- all five R-015 activations (`RL.07`, `RL.20`, `RL.21`, `RL.28` back to their pre-activation hooks, `activation` blocks gone)
- `offer_from_act` on `RL.28`, and its R-016 ruling reference
- the R-017 Hamming note on `RL.20`
- the `rule` / `engine_note` split on `RL.02` and `RL.04` — engine instructions back in the text a player reads mid-run
- `RL.08` The Fence and `RL.17` The Holdout, deleted outright, along with `reveal_discount` and therefore the §2.5 ladder's only discount path

So the `upgrade` blocks were inserted into the current file and nothing else was taken from the supplied one. The result is a 159-line pure addition with no deletions, which is the shape a content drop should have.

**Renumber rather than collide.** The delta specified §6.6, §6.7 and rulings R-014, R-015, R-016. All six identifiers were already taken — §6.6 is Activations, and R-014 through R-020 are the rulings from the last two phases. Renumbered to §6.7, §6.8 and R-021, R-022, R-023. R-013 was left alone for the same reason as always: it is cited from the technical brief, and a ruling that moves is a ruling nobody can cite.

**Write the two missing upgrades.** `RL.08` and `RL.17` post-date the supplied file. Both were written to the §6.7 contract — one axis, no new `pre_guess_reveal`, and magnitude because a discount and a bonus are both numbers a player reads mid-run.

## Consequences

**The count in prose is now wrong in a third place, so R-023 stops chasing it.** The delta's own clarification said 29 relics with `RL.08`/`RL.17` unassigned; R-020 had already assigned both. Rather than correct 29 to 31 and wait for it to go stale again, R-023 states the rule — count the array, never the codes — and the registry test asserts the rule instead of the number.

**Two content rules are now enforced by tests rather than trusted.** §6.7's "no upgrade may introduce a `pre_guess_reveal`" and "boss relics upgrade on cost or reach" are exactly the kind of constraint that holds on the day it is written and quietly breaks on the fortieth relic. Same for §6.8's content rules: every event has a way out, every wager prints its failure branch, no event moves gold alone.

**One inconsistency in the supplied content was corrected.** `EV.02` The Pawnbroker's SELL ONE destroys a chosen relic with no `requires`, while the three sibling events that destroy a relic (`EV.04`, `EV.05`, `EV.06`) all gate at `relics_min: 2`. Ungated, it lets a player sell their last relic for 90g. Gated to match. `EV.01`'s destroy is deliberately left ungated: it fires on the failure branch of a stated wager, and gating it would stop a player with one relic taking a bet they fully understand — so the requirement there is that it no-ops safely at zero relics, which the test asserts instead.

**§13 I-15 is not resolved by this drop, despite appearances.** `RL.27` The Vault's rule now reads "Does not raise the act cap", which restates the constraint that made it unimplementable rather than resolving it: with the cap unchanged and `refillPool` setting the pool absolutely, a carry still has nowhere to land. The only reading that leaves a RARE relic doing anything is that `poolMax` governs the refill and is not a hard ceiling. That is an engine change, so it is being made deliberately in Phase 3 rather than assumed here.

## Alternatives rejected

**Replace the files and re-apply the lost work.** Cleaner in principle, and it would have meant re-deriving five activation blocks and two relics from memory against a file that looks authoritative. The failure mode is silent and the diff would have hidden it: a large replacement diff reads as "new content", not "seven rulings reverted".

**Keep the delta's numbering and renumber my own rulings instead.** Rejected on the R-013 principle. The existing numbers are cited from `relics.json`, from ADRs, and from commit messages already in `main`.
