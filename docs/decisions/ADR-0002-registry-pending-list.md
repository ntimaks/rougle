# ADR-0002 · The registry validator and the pending list

**Status:** Accepted.
**Ticket:** E-11.

## Context

Technical brief §6 requires eight validations tying `relics.json` to its
implementation modules, and the first is "every code has exactly one
implementation module". That is the right end state and the wrong invariant
during a phased build: the brief's own build order implements five relics in
Phase 2 and the rest in Phase 4, so a strict check fails from the first commit
and gets disabled — at which point it protects nothing.

## Decision

Keep the check strict and add `PENDING_IMPLEMENTATION` in
`lib/engine/content/impl/index.ts`: a code with neither an implementation nor an
entry there fails CI. Every entry must name a §13 item or the phase that builds
it, and a further test asserts that.

Removing an entry is how a ticket closes. A code that is both implemented and
pending also fails, so the list cannot rot.

## Consequences

Thirteen codes are pending at the end of Phase 1. Five are blocked on rulings
(RL.07, RL.20, RL.21, RL.28, CH.03 — all §13 I-04), one on a new one (RL.27,
§13 I-15), and the rest need Phase 3 machinery that does not exist yet.

The harness report prints the pending list with every sweep, because build
variety is understated while it is non-empty and a balance number that does not
say so is misleading.
