# ADR-0005 · Refunds the floor cannot grant yet are carried within the word

**Status:** Provisional. Needs a ruling on technical brief §13 I-16.
**Ticket:** E-06.

## Context

MECHANICS.md §2.4 Rule A: "A word costs a minimum of 1 guess, net of all
refunds. If refunds would bring net cost below 1, they are truncated. Applies
per word, not per guess."

Technical brief §3 sketches this as a greedy truncation at the moment each
refund fires:

```ts
const netAfter = netGuessesSpent - refundsAppliedThisWord - best;
const granted  = netAfter < 1 ? Math.max(0, best - (1 - netAfter)) : best;
```

Work through a refund that fires on guess 1. Gross spend is 1, nothing has been
refunded, the candidate is 1, so `netAfter` is 0, below the floor, and the grant
truncates to 0. It will never be retried, because the relic only fires on guess 1.

That kills two relics outright:

- **RL.13 Opening Gambit**, whose entire rule is "your first guess of a word is
  refunded". It can never refund anything.
- **RL.19 The Moth**, which pays at word start, when zero guesses have been
  spent. Same result, and it still eats a letter — a pure downside.

Rule A is stated *per word*. Truncating at the moment of the refund enforces
something stricter than the rule: it enforces the floor against the word's spend
*so far*, which on guess 1 is always 1.

## Decision

`offerRefund` grants what Rule A allows now and queues the remainder on
`WordState.pendingRefunds`. Each later spend of the same word retries the queue.
The queue is dropped when the word ends, because Rule A is per word.

Rule B is unaffected: the losers of an event are discarded, never queued, so two
relics cannot stack across turns.

Check against the five cases in technical brief §3:

| Case | Result |
|---|---|
| Gambler + Flywheel, solve in 3 | +2, not +3 |
| Wishbone every guess, solve in 4 | net spend 1 |
| Opening Gambit on a 1-guess solve | net spend 1 |
| Wishbone + Opening Gambit on guess 1 | the larger only |
| Refunds exceeding spend | pool never exceeds poolMax |

All five hold. The one place the brief's prose and this implementation differ is
its note that on a 1-guess solve the pool "visibly ticks down then up": under
either reading the refund is truncated to nothing on that solve, so the pool
ticks down and stays down. The decrement is still unconditional (Rule C).

## Consequences

`WordState` gains `pendingRefunds`. If the ruling goes the other way — greedy
truncation is intended and both relics are meant to be dead — deleting
`offerRefund`'s queue and `drainPendingRefunds` restores it exactly.
