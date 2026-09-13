# ADR-0013 · Rarity gates supply; price does not

**Status:** Accepted. Ruled twice, because the engine and the spec are mid-migration and both documents own this question: as **R-037, R-038** in the live spec (`docs/archive/MECHANICS-v1.3.md` §6.2, §6.4, §6.4a, §6.4b — the one `test/spec.ts` asserts against and the one the engine implements), and as **R-042, R-043** in `MECHANICS.md` v2.0 (§3.3, §4.1, §4.2, §6.3, §6.6), so the destination spec does not re-inherit the bug at migration.
**Measured by:** balance snapshot `docs/balance/v2-002.md`.

## Context

Rarity was decoration. `relics.json` carried a `rarity` on every entry, the card
spine coloured itself from it, and `PRICE_BASE` looked a number up in it — and
that was the whole of its effect. Neither `rollOffer` nor `rollShopStock`
consulted it. Both weighted by archetype (§6.6) and nothing else, so every
offerable relic was equally likely and a tier's share of the shelf was simply
how many relics happened to be in it.

Measured over 400 seeds per act, before this change:

| | Act I | Act II | Act III |
|---|---|---|---|
| COMMON | 27.9% | 29.4% | 28.5% |
| UNCOMMON | 45.7% | 42.6% | 43.7% |
| RARE | **23.4%** | **23.0%** | **24.4%** |
| BOSS | 3.0% | 5.0% | 3.4% |

Three things are wrong in that table.

**A RARE turned up almost as often as a COMMON.** 7 of the 27 offerable relics
are RARE, so 23% is exactly what "no weighting" predicts. Finding one was not an
event, because one turned up in roughly two of every three offers.

**Nothing moved across the acts.** The three columns are the same column. A run
in its last act was drawing from the same shelf it drew from in its first.

**Boss relics leaked.** `offerableRelics()` filtered consumables and
unimplemented codes, not BOSS, so boss relics were in the ordinary pool. Worse,
`PRICE_BASE` had no `BOSS` row and fell through to `COMMON`: `RL.29` The Mask, a
boss relic, was a 55g shop staple with the **highest pick rate in the game**
(38.3%, balance snapshot 007).

Price was doing the work rarity was named for, and doing it badly. A rare at
150g against roughly 300g of income an act does not restrict *what* a player
owns, only *when* — they save two nodes and buy it. What an expensive shelf
reliably produces is a player standing in a shop unable to interact with it,
which is the opposite of the interesting decision §4 exists to create.

## Decision

**Rarity is a share of the draw, per act.** `cfg.rarityWeights` (§6.6) states
what fraction of relic slots each rarity takes in each act: RARE 10% in Act I,
16% in Act II, 28% in Act III. Both the shop shelf and the reward offer draw
against it, multiplied by §6.6's archetype bias.

**A tier's weight is divided by how many of that tier are still unheld.** This
is the part worth stating explicitly, because it is the difference between the
table meaning something and the table being decorative in a new way. Handing
every relic its tier's weight would give UNCOMMON — 12 relics against COMMON's 8
— half again the share the number claims. Dividing by the live tier count makes
the stated share the share that lands, and keeps it landing as relics are taken:
the last unheld RARE is as likely to appear as the first of seven was.

**Prices drop, roughly 35%.** 55/90/150/45 becomes 35/60/95/30, with a `BOSS`
row at 140 so nothing falls through to `COMMON` again. Once supply carries the
restriction, price is free to be a real choice between two things on the shelf
rather than a gate on touching the shelf at all.

**The variance narrows from ±20% to ±15%,** which makes the bands disjoint. At
±20% a lucky COMMON cost more than an unlucky UNCOMMON. That is not variance a
player reads as variance; it is a shelf that looks mispriced.

**Boss relics are drawn only at bosses.** A boss leads its offer with the boss
relics the player does not hold and tops the table up to three from the ordinary
pool. The top-up is what keeps this shippable while three of the four boss
relics are unimplemented: without it, a boss would hand over a one-card
"choice", and the second and third bosses of a run would hand over nothing.

**The consumable slot is reserved** (R-043). §4.1 asks for 3 relics and 1
consumable; the engine drew 5 slots from a mixed pool, so a shelf could hold
three consumables or none. A rarity share is only meaningful over a fixed number
of relic slots.

**Everything above lives in `cfg`.** Prices and variance were module constants
in `nodes.ts`, which put them outside the object the harness overrides — the
reason no sweep in seven balance snapshots ever moved a price. They are tunables
that appear in MECHANICS.md, so per technical brief §1.6 they belong in
`core/config.ts`, and they are now sweepable.

## Consequences

**The game got easier, and was paid for.** Cheaper relics with a reserved
consumable slot took the win rate from 33.9% to 40.4% over the same 1000 seeds —
out of §10.3's 25–35% band. Two changes bring it back:

- `shopRelicSlots` 4 → **3**, which is what §4.1 specified all along. −3.2 points,
  and Act I's death rate does not move.
- `gauntlet.pool` 10 → **9**. Snapshot 007 measured 9 and held it, because on
  that economy it took the win rate to 28.2% — in band but buying nothing. This
  change is worth the +6.5 points that made 9 affordable, so the hold comes off.

Final: **33.2% win rate, Act I deaths 9.4%, deaths I 9.4 / II 34.9 / III 22.5.**
Act II is still the wall, which is §2.2's intent.

**Gold income was rejected as the lever.** Cutting reward gold to 15/30/50 also
lands in band (34.2%) but takes Act I's death rate to 14.7% against a 15%
target. Early gold is what buys the first emergency guess; taking it away tunes
the win rate by killing more players in Act I, which is the one thing §10.3
forbids.

**Gate 3 was measuring the wrong thing, and this change made that visible.**
`--no-relics` skipped the reward screen only, so the no-relic bot walked into
every shop and bought relics there. At 55g and usually broke it barely mattered
(7.9%, snapshot 007). At 35g it was worth 6.8 points: the flag reported 16.2%.
Fixed in `sim/runner.ts` — `noRelics` now declines relics on a shelf too, and
buys consumables and refills as before. The §10.3 figure is **0.0%** on the
honest measurement, and is not comparable to any no-relic number in snapshots
001–007.

**`RL.29` The Mask is now in 90.6% of runs, up from 38.3%.** It is the only
implemented boss relic, so every boss offer leads with it, and the bot takes the
first card on the table. Part policy artefact and part real: a guaranteed relic
is not an exciting one. The fix is content — `RL.22`, `RL.30` and `RL.31` are in
`PENDING_IMPLEMENTATION` — and the number is worth re-reading when they land.

**Existing seeds re-roll.** Shelves and offers are drawn against new weights and
the shop's consumable now takes its own addresses, so a saved run from before
this change sees different stock. No save migration: the draws are pure
functions of seed and node, and nothing persisted depends on them.

**Word-luck deaths remain off target** at 20.8% against <5%. Untouched by this
change, and §10.3 is explicit that it is fixed by curating the word list rather
than by tuning.

## Alternatives rejected

**Keep the prices and only add the weights.** Halfway. The expensive shelf is
what stopped a player interacting with a shop at all, and once rarity restricts
supply there is nothing left for a 150g rare to protect — it protects a card the
player now sees once an act, which is a tax on the good outcome.

**Put a rarity weight on each relic in `relics.json`.** Per-relic weights are
finer-grained and would let one COMMON be commoner than another. Rejected: it
puts a balance lever in the file AGENTS.md §2.5 keeps normative for content, it
cannot express "per act" without repeating the act structure per relic, and
nothing has yet asked for that resolution. Five numbers per act in `cfg` is the
whole model and it is sweepable.

**Weight per relic rather than per tier.** Simpler code — hand each relic its
tier's weight and let the tier sizes fall where they may. Rejected because the
table would then not mean what it says: a reader who sets RARE to 10% would get
7%, and the error would move every time a relic was added to any tier.
