# ADR-0004 · Pool-max reductions apply immediately

**Status:** Provisional. Needs a ruling on technical brief §13 I-07.
**Ticket:** blocks C-05 (RL.31, RL.09).

## Context

RL.31 Rosetta Slab cuts the act pool by three and RL.09 The Anvil by one. Neither
says when. Applied at the next act start they are free for the act you take them
in; applied immediately they can kill a player at low pool the moment they take
a reward.

## Decision

Apply immediately, to BOTH the cap and the live pool, clamped so `pool` never
drops below 1. Any unapplied remainder is lost rather than deferred.

The live pool has to move. There is no refill left in the act you took the relic
in, so cutting only the cap costs nothing until the act ends — which makes a
stated drawback into no drawback at all. That is also precisely why I-07 flags
this as able to kill at low pool: the danger is the point.

A pool already at 0 stays at 0. The clamp floors at 1 for a player who is alive,
not for one already in the emergency branch.

## Consequences

Implemented in `pool.ts#addPoolMax` and tested in `reducer.test.ts`. Neither
relic is implemented yet, so nothing depends on this until the ruling lands.
