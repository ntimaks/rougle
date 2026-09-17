# ADR-0013 · Rarity gates supply; price does not

**Status:** Accepted. Ruled as MECHANICS.md R-052, R-053 (§3.3, §4.1, §4.2, §6.3, §6.6).
**Measured by:** balance snapshot `docs/balance/v2-005.md`.

## Context

Rarity was decoration. `relics.json` carried a `rarity` on every entry, the card
spine coloured itself from it, and §4.2 looked a price up in it — and that was
the whole of its effect. `rollShopStock` weighted by archetype (§6.6) and
nothing else, so a tier's share of a shelf was however many relics happened to
be in that tier.

The shelf-eligible registry is 3 COMMON, 10 UNCOMMON, 5 RARE. Unweighted that
is 16.7 / 55.6 / 27.8, and measured over 600 seeds per act it was exactly what
the shelf showed:

| | Act I | Act II | Act III |
|---|---|---|---|
| COMMON | 16.6% | 17.7% | 15.9% |
| UNCOMMON | 59.8% | 59.4% | 56.2% |
| RARE | **23.7%** | **22.9%** | **27.9%** |

**A rare appeared on about three shelves in four**, and the three acts drew from
one shelf. Nothing in the game made a RARE rare except its price, and a price is
bad at the job: a player who wants it saves two nodes and buys it, and a player
who cannot afford one is left with a shelf they can do nothing with. Neither is
scarcity.

`v2-004` had already named the second half of that from the other direction —
*"920g a run against five slots at 60/110/180 means the shelf is not a choice"*
— and nominated income as its first lever, explicitly leaving the choice to a
design call.

## Decision

**Rarity is a share of the draw, per act.** `cfg.rarityWeights` (§6.6) states
what fraction of relic slots each rarity takes in each act: RARE 10% → 17% →
28%. `rollShopStock` draws against it, multiplied by §6.6's archetype bias.

**A tier's weight is divided by how many of that tier are still unheld.** This
is the part worth stating, because it is the difference between the table
meaning something and being decorative in a new way. Handing every relic its
tier's weight gives UNCOMMON — 10 relics against COMMON's 3 — three times the
share the number claims. Dividing by the live tier count makes the stated share
the one that lands, and keeps it landing as relics are taken: the last unheld
RARE is as likely to appear as the first of five was.

**UNCOMMON stays the backbone in all three acts.** The first draft of this
curve was 60/30/10 in Act I, which reads better as a sentence and is wrong here:
§6.4's impact test left only three COMMON relics, so a 60% share hands 60% of
three relic slots to three relics, and every early shop shows the same three.
What moves across the acts is the thing the player is meant to feel moving —
RARE, from a tenth of the shelf to over a quarter.

**Prices drop about a third**, 60/110/180/40 → 40/70/110/30, with a `BOSS` row
at 150 for sell-back. Flat still: a ±20% swing on a rare is wider than the gap
between two rarities. Once supply carries the restriction, price is free to be
the choice between two things on the shelf rather than a gate on engaging with
it at all.

**Node gold drops with them**, 40/70/120 → 30/50/90 — `v2-004`'s first lever at
its recommended size. This is not a separate change bolted on: cheaper relics
against unchanged income would make the shelf *less* of a choice, which is the
failure both readings agree on. The pair is what produces the intended shape —
relics more affordable each, and less spare gold in the run.

**`RL.22` Polyglot is fixed** (R-053). Its rule is "the shop that follows them
stocks one rarity tier higher"; the implementation drew the shelf normally and
then priced each relic one tier up, so a boss relic bought to improve your shops
made them more expensive and no better — the exact penalty the code comment
beside it said it was avoiding. It was undiagnosable before this change, because
with no rarity weighting there was no tier for a shelf to stock *at*, and the
price was the only thing left to move. Tier-up now shifts the act's shares up a
rung: Act I RARE goes 10.3% → 42.6% and COMMON to zero.

**Prices and weights live in `cfg`.** `PRICE` was a module constant in
`nodes.ts`, outside the object the harness overrides — which is why no sweep in
eleven snapshots ever moved a price, including the one `v2-004` nominated as the
cheapest lever available.

## Consequences

**One §11.5 target moves from OFF to OK and the change pays for itself.** 1000
runs on identical seeds:

| metric | before | after | §11.5 |
|---|---|---|---|
| win rate | 59.6% | **58.1%** | 20–30% |
| act I death rate | 8.9% | **10.9%** | 10–20% — **now in band** |
| win rate, no relics | 44.5% | **33.9%** | <2% |
| median relics at death | 4 | 5 | 3–5 |

The pricing half alone is worth +5.5 points of win rate; the income cut pays for
it with a little to spare.

**§11.5's win-rate band is still not reached, and this decision does not reach
for it.** 58.1% against 20–30% is `v2-004`'s open finding. What this adds is
measurement: income cannot close it (20/35/65, half of §3.3's original, reaches
only 50.2% and pushes Act I deaths to 12%), and `payoutBase` 5 closes it and
overshoots (13.8% win, but the no-relic target met outright at 0.8%, against Act
I deaths of 28.7%). Choosing between those is the design call `v2-004` left
open, and it stays open.

**Existing seeds re-roll.** Shelves are drawn against new weights. No save
migration: the draws are pure functions of seed and node, and nothing persisted
depends on them.

**One test was coupled to shelf composition.** §6.2's "a sixth relic waits for
the player to destroy one of five" planted a fixed set of five relics and then
looked for a shelf item the player did not hold. With 18 shelf-eligible relics
and a draw now concentrated on the act's rarities, all three relic slots can
fall inside that plant. `plantRelics` takes an `exclude` list so the plant
avoids the shelf under test; the assertion is unchanged.

## Alternatives rejected

**Keep the prices and only add the weights.** Halfway. An expensive shelf is
what stops a player engaging with a shop at all, and once rarity restricts
supply there is nothing left for a 180g rare to protect — it taxes a card the
player now sees once an act, which is a tax on the good outcome.

**Cut prices and leave income alone.** Measured at 62.5%, five points easier
than the baseline, with 11.2 relics bought a run and 166g still unspent at the
end. That is the shelf being even less of a choice, which is the thing `v2-004`
filed.

**Weight per relic rather than per tier.** Simpler — hand each relic its tier's
weight and let the tier sizes fall where they may. Rejected because the table
would then not mean what it says: a reader who sets RARE to 10% would get 28%,
and the error would move every time a relic was added to any tier.

**Put a rarity weight on each relic in `relics.json`.** Finer-grained, and it
would let one COMMON be commoner than another. Rejected: it puts a balance lever
in the file AGENTS.md §2.5 keeps normative for content, it cannot express "per
act" without repeating the act structure per relic, and nothing has asked for
that resolution. Three numbers per act in `cfg` is the whole model, and it is
sweepable.

**Take `payoutBase` 5 in this PR.** It is the only lever measured to reach
§11.5's band, and it reaches it by 6 points past the near edge while putting Act
I's death rate at 28.7% against a 10–20% target. `v2-004` left that decision
open on purpose and one PR about relic pricing is not where it should be
settled.
