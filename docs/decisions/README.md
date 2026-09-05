# Decisions

One file per decision, numbered, never edited after it lands — supersede it with
a new one instead. AGENTS.md §4: behaviour that contradicts a brief means the
same PR updates the brief and adds a record here.

| ADR | Decision | Status |
|---|---|---|
| [0001](ADR-0001-board-projection.md) | Board projection is normative; Decay and deferral are presentation, not chain steps | In code; §13 I-02 ruling outstanding |
| [0002](ADR-0002-registry-pending-list.md) | The registry validator stays strict during a phased build, via an explicit pending list | Accepted |
| [0003](ADR-0003-information-cap.md) | The information cap is implemented exactly as specified; the §13 I-03 trap is pinned by a test, not fixed | Accepted |
| [0004](ADR-0004-pool-max-mid-act.md) | Pool-max reductions apply immediately to both the cap and the live pool, clamped at 1 | Provisional — needs a ruling on §13 I-07 |
| [0005](ADR-0005-refund-floor-carry.md) | Refunds the floor cannot grant yet are carried within the word | Accepted — MECHANICS R-018 |
| [0006](ADR-0006-new-spec-problems.md) | Six engineering problems found while building Phase 1 (§13 I-15 … I-20) | Five ruled; I-15 open |
| [0007](ADR-0007-solver-calibration.md) | The 3.9 human baseline is not reachable by a pure entropy solver on the curated list; the handicap is two-stage | Accepted |
| [0008](ADR-0008-activations.md) | Activations are `onUse` plus a declared block; the engine owns timing, cap and cost | Accepted — MECHANICS R-015 |
| [0009](ADR-0009-boss-order.md) | The Cipher opens the run; the Twins becomes the Act II wall | Accepted — MECHANICS R-019 |
