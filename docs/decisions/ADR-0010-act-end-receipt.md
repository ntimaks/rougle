# ADR-0010 · The act end is a phase, not a transition

**Status:** Accepted.
**Ticket:** V-06 needed the screen; E-06 carries the reducer change.

## Context

Converting leftover guesses to gold is the payoff for the game's central bet. The
shared pool is only tense if hoarding is *worth* something, and this conversion is
the one moment a player is told what their restraint bought. Twenty words of "do I
spend another guess here" resolve into one number.

The reducer treated it as bookkeeping. `endAct` fired the `onActEnd` hooks, granted
the gold, emitted `ACT_ENDED`, and called `startAct` for the next act — all inside
a single dispatch. The player went from their last word straight to the next act's
map. The conversion happened, correctly, and was never seen.

This is a presentation problem with a state-machine cause: there was no state in
which the act was over but the next act had not begun, so there was nothing for a
screen to render.

## Decision

Add an `ACT_END` phase. `endAct` stops there, holding an `actReceipt` of
`{ actIndex, leftover, goldGained, rate }`. `ADVANCE` from `ACT_END` starts the
next act.

The receipt keeps `leftover` and `goldGained` as separate numbers rather than
folding both into `gold`, because the screen plays the conversion as a *trade* —
guesses counting down while gold counts up — and that needs both ends of it.

## Consequences

Pausing exposed two bugs that were invisible while the transition was atomic.
Neither was caused by this change; both were only observable once something
rendered the intermediate state.

**The pool was not drained by the conversion.** `refillPool` sets the pool
absolutely, so the next act always started correctly and nothing downstream ever
read the stale value. Stop on the receipt and the HUD reads 19 guesses beside a
receipt saying all 19 became gold. The conversion now spends them.

**`goldGained` ignored the hooks.** The event reported `leftover *
goldPerLeftoverGuess`, computed before `onActEnd` ran. RL.24 The Ledger raises the
rate to 15g and the event said 10 — a discrepancy no screen was showing. Hooks now
run *before* the base grant and `goldGained` is measured as the gold delta across
the whole conversion, so the receipt can print the rate the player actually got.
One conversion, one number.

The harness needed no change: its `default` case already dispatches `ADVANCE`, so
`ACT_END` is walked through like any other non-decision phase. 1000 runs confirm
identical outcomes — win rate 50.3%, same deaths by act — which is the check that
matters, since a new phase in the reducer is exactly the kind of change that can
silently shift a seeded run.

## Alternatives rejected

**Render the receipt from the `ACT_ENDED` event in the view.** The event is already
emitted and the store already carries the last dispatch's events. But this makes
the pause a property of the UI: a second dispatch arriving, a remount, or the debug
view stepping through would drop it, and save/resume mid-receipt would have nothing
to restore. The rule is that all state changes go through `reduce` — a moment the
player must acknowledge is state.

**Keep the pool intact and have the screen display zero.** Rejected on the same
grounds. The view would be showing something the state contradicts, and the next
person to render the pool would have to know about the exception.
