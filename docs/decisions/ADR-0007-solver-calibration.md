# ADR-0007 · The human baseline is not reachable by one knob

**Status:** Accepted.
**Ticket:** H-03.

## Context

MECHANICS.md §10.2: a simple entropy solver plays roughly 3.4 guesses/word
against a human 3.9, and balance must be tuned to the human number with the
offset applied explicitly.

Technical brief §9 proposes `suboptimality` — "p of taking the 2nd-best guess" —
as the handicap.

## Decision

Two things had to change.

**1. `suboptimality` means something stronger.** Taking the second-best guess is
too weak: the second-best guess is almost as informative as the best. Driving
the parameter to 1.0 under that reading moved the measured mean from 3.06 to
3.31, nowhere near 3.9. It now means "play a plausible candidate rather than the
information-optimal probe", which is what humans actually do. That reaches 3.70
at 1.0 — closer, still short.

**2. The remainder is carried by `vocabularyGap`.** Pinning `suboptimality` at
1.0 and bisecting the gap reaches 3.89 at 0.0938. `sim/calibrate.ts` does both
stages and writes `sim/calibration.json`; the harness reads it, so every sweep
runs at the calibrated handicap without anyone remembering a flag.

The gap models a player who does not know some words, and it falls back to the
full list once the words it "knows" are exhausted. Without that fallback it is
not a handicap but a wall — 9% of words become unsolvable and cost the whole
remaining pool, which raises the mean for a reason unrelated to how a human
plays. That bug produced a 8.7% win rate before it was found.

## The finding worth acting on

**A pure entropy solver cannot be made to play at 3.9 on Rougle's word list by
suboptimal play alone, because Rougle's words are easier than Wordle's.**

MECHANICS.md §8.1 removes ambiguity clusters — `_ATCH`, `_IGHT`, `SHA_E` and 32
more families at length 5. Those families are exactly what produces the long
human solves the 3.9 figure was measured against. Remove them and the same
player scores better.

The act budgets in §2.2 were derived from 3.9. If the real number on this list is
nearer 3.7, every budget is more generous than intended by roughly a fifth of a
guess per word — about four guesses across a run. The first calibrated sweep
puts the win rate at 55.6% against a 25–35% target, which is consistent with
that.

This is a §2.2 revision (ticket B-02), not something to fix by nudging the
handicap until the win rate looks right — which is precisely what §10.2 warns
against.

## Consequences

Sweep at the calibrated handicap AND at `suboptimality: 0` for the ceiling, and
balance to the band between them.
