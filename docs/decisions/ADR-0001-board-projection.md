# ADR-0001 · Board projection is a layer, not a chain step

**Status:** Provisional. Needs a MECHANICS.md §11 ruling on technical brief §13 I-02.
**Ticket:** E-09.

## Context

MECHANICS.md §4.4 fixes a six-step transform chain and every step is a function
of one guess. Decay is not: it reverts a GREEN to UNKNOWN after a turn has
passed, so the same stored row must render differently at turn 3 than at turn 2.
It cannot be expressed as a step in a chain that runs once at scoring time, and
§4.4 has no slot for it.

Deferral has the same shape, and §4.4 already describes it the right way — "the
full result is computed and stored; it is simply not shown yet".

## Decision

Adopt technical brief §4.3's projection pass. `runChain` applies steps 0–4 at
read time; `projectBoard` then applies deferral and Decay as functions of
`turnNow`. Content is computed once; presentation is a function of when you look.

Two consequences worth stating:

- The Cipher boss is Fog's mechanism at depth 3, so implementing deferral
  properly made the Act II boss essentially free.
- `projectBoard` returns two projections internally. The player-facing rows have
  Decay applied; the Sieve's proven-grey derivation reads the undecayed rows.
  See ADR-0006 §I-18 for why.

## Consequences

The engine emits `UNKNOWN` tiles, which CMP.02 has no specimen for (§13 I-01).
`components/cmp/tileStyles.ts` carries a deliberately unfinished placeholder so
the gap is visible rather than papered over with the TYPED treatment, which
would make a submitted row look unsubmitted.
