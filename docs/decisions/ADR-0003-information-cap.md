# ADR-0003 · The information cap is implemented as specified

**Status:** Accepted. The underlying problem (§13 I-03) is raised, not resolved.
**Ticket:** R-10 (partial — the chip state is Phase 3).

## Context

MECHANICS.md §6.3 caps pre-guess reveals at two and suppresses the excess "in
acquisition order (earliest acquired wins)".

Technical brief §13 I-03 points out that this is a trap: RL.31 Rosetta Slab is a
BOSS relic that costs 3 act pool, so a player already holding two COMMON reveals
pays the cost and receives nothing, permanently. It proposes suppressing by
ascending rarity instead.

## Decision

Implement the spec as written. `orderForSuppression` in
`lib/engine/feedback/infoCap.ts` sorts by acquisition order and nothing else.

Changing the suppression order is a rules change, and rules are MECHANICS.md's
to make (AGENTS.md §1). The proposed fix is recorded in the function's comment
so the ruling has one place to land, and `infoCap.test.ts` pins the current
behaviour with a test named after the trap, so the change is visible in a diff
rather than silent.

## Consequences

RL.31 stays unimplemented until the ruling lands, because implementing a relic
whose cost is certain and whose benefit may be nil is worse than not shipping it.

One thing the cap DOES do beyond the letter of §6.3: it counts character innates.
`relics.json` marks CH.01 The Linguist `pre_guess_reveal: true`, and the flag is
what the cap reads. §6.3's prose lists only relics. See ADR-0006 §I-20.
