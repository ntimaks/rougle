# ADR-0011 · Gold buys information

**Status:** Accepted. Ruled as MECHANICS.md R-020 (§2.5).
**Raised by:** playtest, not analysis. Two observations: *"it becomes very annoying if I get stuck"*, and that the tension reads as strange everywhere except that moment.

## Context

Those look like two notes — a missing feature and a vague misgiving. Measured, they are one fault.

Over 1000 runs before this change:

```
mean gold earned per run      759
mean gold spent per run        89        ← 88% of it is never spent
mean gold held at death       206
deaths holding 25g or more   99.1%       (80.6% holding 100g or more)
```

The mechanism is that §2.3 was the only sink and it caps at three purchases per act. Once the ladder is spent, `emergencyCost` returns null, the offer is never made, and the run ends with the money still in hand. **420 of 427 deaths were that exact shape.** R-012 filed the same anomaly against a death-screen mockup — `POOL EXHAUSTED` beside `GOLD UNSPENT: 145g` — and treated it as evidence the emergency branch was unwired. It was wired. The mockup was accurate.

So being stuck was never a shortage of resources. It was holding a resource with nothing to exchange it for, which is frustration rather than tension. And the general strangeness is the same fact from the other side: an economy where one currency starves while a parallel one drowns does not read as pressure, because the player can feel that their spending decisions are not connected to anything.

## Decision

§2.5, the reveal ladder. After the first guess of a word, the player may buy the letter at a position of their choosing, at an escalating price (20/55/130g), capped at three per word and unable to hand over the last unknown position.

The framing that matters: **this is not primarily an out for stuck players, it is what gives a guess a price.** Leftover guesses already convert to gold at the act end. Once gold also buys information, spending a fourth guess on word seven has a nameable cost in reveals foregone on word twelve. That closed loop is the mechanism the design bet on and never had.

GREED was the thinnest archetype at four relics for the same underlying reason — it converts play into gold, and gold did nothing. `RL.08` The Fence (reveals cost 30% less) and `RL.17` The Holdout (solve without buying, gain 25g) fill the R-011 code gaps and pull in opposite directions, so declining to buy is also a decision that pays.

## Consequences

**The two ladders compete for the same gold, and that is the point.** Deaths from `EMERGENCY_UNAFFORDABLE` went from 5 to 156 per 1000 runs: players now arrive at the emergency offer having spent the money on information. Before, gold was never scarce because it was never spent.

**Buying reveals lowers the win rate.** Measured across policies on identical seeds:

```
never buying                                     58.5%
buy at 3 guesses in, >5 candidates left          52.7%    ← harness default
buy at 2 guesses in, >2 candidates left          32.8%    ← inside the §10.3 target
```

An emergency guess is better survival value than information, so a player who buys freely dies more. This is a real trade rather than a trap *provided the player can see both prices*, which is why the reveal control prints what a guess costs beside what a letter costs. Whether that is enough is a playtest question the harness cannot answer — its policy is a threshold, not judgement.

**B-02 reads differently now.** The 25–35% win-rate target has been missed all along, and the reason may simply be that a whole currency was inert: the target is reachable inside the mechanic's natural parameter range without touching a single act budget. That does not settle B-02, but it moves the suspect.

**The ladder is unaffordable early.** Word one pays 15–25g and the first reveal costs 20, so it is a coin flip whether a reveal is available on word two — and word one, where a new player is most likely to be stuck, has no out at all. Left as is: the alternative is starting gold, which weakens the act-end conversion that makes the loop legible in the first place. Flagged for playtest.

## Alternatives rejected

**A cheaper flat price.** Removes the decision. With 759g of income and no escalation, buying becomes automatic and the ladder is a tax on attention rather than a choice.

**Letting reveals finish a word.** Rule B exists because paying to win is not a decision. Bought reveals and relic presets count together, so Rosetta plus two purchases still cannot close a five-letter word.

**Corrupting bought reveals under Liar Letter.** Tempting for consistency, rejected because certainty is the product. A paid reveal that might lie is a worse guess, and the mechanic reads as a swindle. Rule D makes the purchase truthful, which also gives Liar Letter genuine counterplay.

**Making it available before the first guess.** That is the pre-guess information stack §6.3 exists to cap. Rule A gates the ladder behind one guess, which is also what keeps it exempt from the cap under Rule F, on the same reasoning that exempts The Auditor and The Lantern.

**A hook for the discount.** `Effect` is the vocabulary of state change and a price is a query. `reveal_discount` is declared as data and read by `revealCost` from every held relic, so the second discount relic is a line of JSON rather than an engine change.
