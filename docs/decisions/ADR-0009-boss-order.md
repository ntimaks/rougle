# ADR-0009 · The Cipher opens; the Twins is the Act II wall

**Status:** Accepted. Ruled as MECHANICS.md R-019.
**Ticket:** B-06 measured it; C-08 carries the change.

## Context

The §10.3 target is under 15% of runs ending in Act I. Simulation put it at
20.8–23.8%, and no budget fixed it: scaling every act's pool down moved the
overall win rate slowly while Act I deaths climbed *faster*, and raising Act I's
pool to 28 left the rate at 21.5%.

So the budgets were not the problem. Measuring where runs actually end, over 600
seeded runs:

```
a0-boss   147   24.5% of all runs      ← the Twins
a1-n3      21    3.5%
a2-n1      21    3.5%
…every other node ≤ 3.5%
```

**The Twins was half of every death in the game.**

Not because Mirror is broken. Two solutions cost 5.20 guesses against the ~7.8
two independent words would cost — information is shared exactly as technical
brief §13 I-10 predicted. The problem is variance landing on a hard wall at the
end of the shortest act, with the fewest relics to absorb it.

## Decision

Swap the first two bosses. The Cipher opens the run; the Twins becomes the Act II
boss. The Mirror modifier moves from Act II+ to Act III only, so Mirror is never
seen before the boss that teaches it.

The Cipher is the better opener despite costing *more* when cleared (6.53 against
5.20): its cost is nearly fixed — commit three guesses, read three rows — so it
teaches the pool's arithmetic instead of gambling with it.

Measured, 800 runs, same seeds and the same calibrated handicap:

| | Twins in Act I | Cipher in Act I |
|---|---|---|
| Act I deaths | 20.8% | **3.9%** |
| Act II deaths | 12.0% | 38.0% |
| Act III deaths | 9.4% | 7.1% |
| Win rate | 57.9% | 51.0% |

## Consequences

**The spike relocated rather than dissolved.** The Twins now ends 37.8% of runs,
in Act II. That is a better place for it — a player who reaches the Act II boss
has a built deck and has learned the economy, so the death is a fair one where an
Act I death was closer to a coin flip — but it is one node ending more than a
third of all runs, and it should not be left there permanently.

Giving the Twins its own fixed pool, on the Gauntlet's pattern, was measured and
rejected: the pattern takes the emergency ladder with it (§7.3 has no ladder),
and 74.8% died there.

§2.2's word-equivalents column moved with the bosses. **The budgets themselves
have not been re-derived** — the win rate is still 51% against a 25–35% target,
so B-02 remains the open question. This change fixed *where* players die, not
*how often*.
