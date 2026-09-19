# Rougle — Mechanics Specification

**Version:** 2.0
**Status:** Canonical
**Supersedes:** v1.1, and `Roguelike Wordle Mechanics.md` (v0). Both should be moved to `docs/archive/`.
**Companion files:** `relics.json`, `events.json`

---

## 0. Authority

This document is the single source of truth for **game rules**. `design_handoff_rougle/` is the single source of truth for **presentation**. Where a prototype string and this document disagree, this document wins and the string is a design bug.

| Question | Authority |
|---|---|
| What does this relic do? | MECHANICS.md + relics.json |
| What is it called? | relics.json |
| What does its card look like? | design doc |
| When does the bankroll change? | MECHANICS.md |
| How does the change animate? | design doc |

Versioned. Minor bump for rule changes, patch for clarifications. Every change recorded in §12.

---

## 1. What changed from v1.1

v1.1 was too easy, relics were weak and over-abundant, and the guess pool was a budget rather than a tension. All three failures share one root cause: **the pool refilled every act and relics were granted free at every node**, so neither resource was ever scarce.

**Replaced:**
- Per-act pool → **one bankroll for the whole run** (§2). No refills.
- Flat guess spend → **per-word payout scaled to solve quality** (§2.3). Every word now gives an immediate signal.
- Free relic at every word node → **relics are bought** (§4).
- Unlimited relics → **5 slots, hard cap** (§6.2).
- Shop as a map node type → **shop after every solve node** (§4).

**Cut:** seven relics that failed the §6.4 impact test or were made obsolete by the refill removal. 29 → 22.

**Added:** scaling relics (§6.5). Six relics carry a run-long counter and get stronger the longer they are held. This was the largest gap in v1.1 — every relic was a fixed modifier, so no relic was ever something a player built toward.

**Removed as unnecessary:** the v1.1 information cap and refund floor. Both existed to compensate for unbounded acquisition. The 5-slot cap does that work directly, and two systems come out.

**Resolved:** the pip-elasticity question open since v1.0 (R-018). Bankroll caps at 24, so the design's 24-pip row is exactly right and needs no change.

---

## 2. The bankroll

### 2.1 Core rules

- **One bankroll for the entire run.** Not per act. There are no refills.
- Starts at **12**, modified by character (§9).
- Hard cap **24**. Overflow converts to gold at 10g each, immediately and automatically.
- Every submitted guess decrements the bankroll by 1 before feedback resolves.
- Solving a word pays out (§2.3).
- Bankroll reaches 0 with the current word unsolved → offer emergency purchase (§2.4). If unaffordable or declined → **run ends**.

The bankroll is the health bar, the clock and the score at once. It must never leave the screen.

### 2.2 Why one bankroll

A refilling pool gives no local feedback. At 15 remaining after two words, a player cannot tell whether that is good. Tension requires a signal every word, and a signal requires a stake that persists.

A run-long bankroll also makes the run one continuous curve rather than three resets, which is what lets a bad Act I actually matter in Act III.

### 2.3 Payout — the core loop

On solving a word:

```
payout = max(0, base(length) − guesses_used)
```

| Word length | base | Break-even |
|---|---|---|
| 5 | 6 | 3 guesses |
| 6 | 6 | 3 guesses |
| 7 | 6 | 3 guesses |

**The base is flat across lengths.** It used to rise by 1 a letter, which made §7's two "difficulty" modifiers the most profitable thing in the game — longer words take *fewer* guesses, not more, so a rising base compounded an advantage instead of compensating a cost. See §7.

Net effect on the bankroll for a 5-letter word:

| Solved in | Payout | **Net** |
|---|---|---|
| 2 | +4 | **+2** |
| 3 | +3 | **0** |
| 4 | +2 | **−2** |
| 5 | +1 | **−4** |
| 6 | 0 | **−6** |

Net is `base − 2 × guesses`. Solving in three is exactly neutral; every guess past it costs two.

**Human baseline is ~3.9 guesses per word. Break-even is 3.0.** The default state of the game is therefore a bleed of roughly 1.8 bankroll per word, and **every relic exists to close that gap.** That is the whole game in one line, and the player feels it on every word instead of at act end.

Failing a word ends the run, so there is no failure payout.

### 2.4 Emergency guesses

The only valve against a death spiral. Offered automatically at bankroll 0 with a word unsolved. Cost escalates across the **run**, not the act:

| Purchase | Cost | Grants |
|---|---|---|
| 1st | 80g | +3 bankroll |
| 2nd | 160g | +3 bankroll |
| 3rd | 320g | +3 bankroll |
| 4th+ | Unavailable | |

The offer is mandatory UI. The player must always see the exit they did or did not buy.

**Why +3 and why 80.** Under a per-act pool, +1 finished the word in front of you. Under a run-long bankroll where the median word costs 1.8 net, +1 puts you back at zero inside one word and you buy again — a bad loop. +3 buys about a word and a half of runway, which is the size the valve should be.

The price is set against that grant. It was 25/50/100 while the grant tripled, which put the first purchase at **8.3g per bankroll** — the cheapest bankroll in the game, below a refill and a third of relic parity. That makes the last resort the best deal on the board, and rewards running yourself to zero deliberately. At 80 the first rung is ~27g per bankroll, roughly relic parity, and it doubles from there. A player with no gold dies, which is correct.

### 2.5 Gain clamps

Two clamps, replacing v1.1's refund floor:

**Clamp A — Net gain per word ≤ +5.** No word may add more than 5 to the bankroll after payout and all relic bonuses.

**Clamp B — Largest payout bonus only.** When multiple relics add to the same payout, only the largest applies. They do not sum. A Gambler holding Flywheel who solves in three gets +3 (the innate), not +5.

Implement both in the bankroll reducer, never in individual relics.

---

## 3. Run structure

Three acts. Each act: **6 map nodes, then a boss.**

### 3.1 Node generation — normative constraints

Constraints are applied after weights and **override them**.

Per act, guaranteed on every legal path:
- Exactly **4** solve nodes (word or elite)
- At least **1** forge
- At least **1** event
- The node immediately before the boss is never an elite
- Act I contains at most 1 elite; Act II at most 2; Act III at most 3

| Node | Weight |
|---|---|
| Word | 60% |
| Elite | 18% |
| Forge | 12% |
| Event | 10% |

Shop is no longer a node type (§4).

### 3.2 Run totals

12 solve nodes plus three bosses. Bosses contain 2, 1 and 5 words, so a complete run is **20 words**. Copy must say twenty.

### 3.3 Node rewards

| Node | Gold | Other |
|---|---|---|
| Word | 30g | Shop opens on clear |
| Elite | 50g | Shop opens on clear |
| Boss | 90g | +4 bankroll, and choice of 1 of 2 boss relics |

Boss relics occupy a slot like any other. The player may decline both.

**Repriced from 40/70/120.** R-052. `v2-004` measured a run earning ~920g against five slots and named the income its first lever: at those prices the shelf was not a choice. §4.2's prices then came down about a third behind §6.6, which on its own makes the shelf less of a choice still, so the income comes down with them. Measured, the pair buys 8.8 relics a run against 11.2 and leaves 124g unspent against 166g — relics are more affordable each, and the run has less spare gold, which is the shape §4.2's last paragraph asks for.

---

## 4. The shop

**A shop opens after every solve node**, elites included. Twelve shops per run. It is not a map node and cannot be routed around.

This is what makes gold matter continuously and what makes relic acquisition an act of intent rather than a lottery. In v1.1 relics were granted free at every word node, producing ~15 relics per run and leaving gold with nothing to buy.

### 4.1 Stock

Each shop rolls:
- **3 relics**, weighted by rarity and archetype (§6.6)
- **1 consumable** — a reserved slot, not one the consumables win
- **Guess refills** — **one per shop**, on a ladder that escalates across the run: 40 / 60 / 80 / 100 / 120 / 140g. **Six in a run, hard cap.**

### 4.2 Prices

| Item | Price |
|---|---|
| Common relic | 40g |
| Uncommon relic | 70g |
| Rare relic | 110g |
| Boss relic | 150g — never stocked; this is what it sells back at |
| Consumable | 30g |
| Guess refill (+1 bankroll) | 40 / 60 / 80 / 100 / 120 / 140g, escalating across the run |
| Reroll stock | 20g, +10g per reroll within the same shop |
| Sell a held relic | 50% of price, rounded down |

**Price is not what makes a RARE rare — §6.6 is.** R-052. Until §6.6 existed nothing else did the job, and a price is bad at it: a player who wants the rare saves two nodes and buys it, and a player who cannot afford one walks past a shelf they can do nothing with. Neither is scarcity. With supply restricted the prices are free to be affordable, and are: a whole shelf costs **223g in Act I** and **255g in Act III** (measured) against roughly 220g an act of income.

Flat, still — no variance. A ±20% swing on a rare is wider than the gap between two rarities, which turns "can I afford this" into a dice roll.

**The refill valve is deliberately worse than a relic.** It was three refills a shop at a flat 25g: across twelve shops that is **36 purchasable bankroll against a non-relic economy of 24** (12 start + 12 from boss clears) — one and a half times the entire base economy, carried over from a per-act pool without redoing the multiplication for a twelve-shop run.

The rate was backwards too. 25g bought one bankroll; an uncommon relic at 110g closing ~0.4 a word over ten remaining words is worth ~4 bankroll, about **27g each**. Gold bought survival more cheaply than it bought a build. **Gold should buy builds, and buy survival only at a penalty.** The ladder above is 540g for 6 bankroll — 90g each, comfortably worse than relic efficiency, and a quarter of the base economy rather than one and a half times it.

Income runs roughly 220g per act. That funds about two relic purchases per act before rerolls, refills and consumables. A player cannot buy everything, which is the point — and after R-052 they can reliably buy *something*, which is the other half of it.

---

## 5. Feedback engine

Unchanged from v1.1 and still correct. The pipeline is normative.

### 5.1 Structure

```
guess + solution(s)
  → base scorer
  → FeedbackResult
  → ordered transform chain
  → emitted on onFeedbackTransform
```

The view renders the emitted result **verbatim** and never re-scores. Keyboard letter states derive from the same payload. If the view scores anything itself, Liar Letter breaks.

### 5.2 FeedbackResult

```ts
type TileState = 'GREEN' | 'YELLOW' | 'GREY' | 'UNKNOWN' | 'HIDDEN';

interface Tile {
  letter: string | null;         // null when identity is withheld (Rangefinder)
  state: TileState;
  distance: number | null;       // Rangefinder
  direction: -1 | 0 | 1 | null;  // Rangefinder MK.II
  trustworthy: boolean;          // false → corruption texture
}

interface FeedbackResult {
  tiles: Tile[];
  meta: {
    vowelCount: number | null;
    revealedLetters: Array<{ index: number; letter: string }>;
    deferred: boolean;
  };
}
```

`letter: null` is load-bearing — Rangefinder withholds identity, so a tile must carry state without a character.

### 5.3 Base scorer

Standard two-pass: greens first, then yellows against remaining solution letter counts.

**The prototype's `score()` in `Rougle.dc.html` is correct.** Fuzzed against an independent reference across 200,000 randomized cases with a reduced alphabet to force duplicate collisions; zero mismatches. Port it directly and keep the test suite.

### 5.4 Transform order — normative

| # | Transform | Source |
|---|---|---|
| 1 | Truth-roll | `RL.28` Shaved Coin |
| 2 | Corruption | Liar Letter modifier |
| 3 | Distance | `RL.04` Rangefinder |
| 4 | Injection | Rosetta, Hot Streak, Skeleton Key |
| 5 | Deferral | Fog, Cipher |
| 6 | Derivation | `RL.02` The Sieve |

**Corruption runs before interpretation**, so Rangefinder reads distance off the *reported* state, not the true one. A corrupted tile yields a plausible lie rather than a visible contradiction. Where `trustworthy === false`, Rangefinder emits a random distance drawn from the values legal for the reported state. Reverse this order and the two relics visibly contradict each other, which reads as a bug.

Deferral is last because it gates presentation, not content.

---

## 6. Relics

Registry in `relics.json`, normative for names, codes, rarity, archetype, hooks, rules, scaling and upgrades.

### 6.1 Hooks

```
onRunStart  onNodeEnter  onWordStart  onGuessSubmit
onFeedbackTransform  onWordSolved  onPayout  onShopOpen
onGoldChange  onBankrollChange  onUse
```

`onPayout` is new in v2.0 and is where every payout-modifying relic attaches.

### 6.2 Slots — normative

- **5 relic slots.** Hard cap. Boss relics occupy one.
- **2 consumable slots.** Separate.
- Acquiring at a full board requires destroying one, chosen at the moment of acquisition, with the incoming relic visible alongside the five held.
- Relics may be sold in any shop at 50% of price.

The cap does two jobs. The obvious one is scarcity. The important one is that **a full board turns every subsequent offer into a comparison** — not "is this good" but "is this better than the worst thing I hold." That is a far more interesting question, and it is what keeps a shop engaging after forty runs.

At 5 slots the v1.1 information cap becomes unnecessary and is removed.

### 6.3 Rarity — normative

`COMMON` · `UNCOMMON` · `RARE` · `BOSS` · `CONSUMABLE`

Consumables are not relics, occupy their own slots, and are spent on use.

**Rarity is a statement about supply, not about price.** R-052. What a rarity means is how often a relic of that rarity is put in front of the player, and §6.6's table is where that lives. Until R-052 it meant neither: no draw read the field, so a tier's share of a shelf was however many relics happened to be in it, and RARE — 5 of the 18 shelf-eligible relics — took **23.7%** of every shelf in every act.

A `BOSS` relic is stocked by no shop and drawn by no shelf. §3.3 is the only way to get one.

### 6.4 The impact test — normative

**A relic must change what you would type, when you would route, or what you would risk. If it only changes a number after the fact, it is a shop item or it is deleted.**

v1.1 failed this badly. The Metronome paid 10g for solving in exactly three. The Ledger converted leftovers at 15g instead of 10g. Insurance made one emergency guess free. None changed a single keystroke. Balatro's *worst* joker still does something you can watch happen.

Seven relics were cut on this test or made obsolete by the refill removal: Metronome, Concordance, Ledger, Insurance, Pilgrim, Vault, Wishbone. Any new relic must pass it before entering the registry.

#### The value budget — normative

The impact test says what a relic must *do*. This says how much it may be *worth*, because v2.0 set relic power by feel and there was nothing for "too strong" to mean.

A full board of five should close the §2.3 bleed and leave a well-played run slightly positive. Against §2.3's own stated baseline — 3.9 guesses a word, so `6 − 2 × 3.9 = −1.8` bankroll a word:

| Rarity | Bankroll per word |
|---|---|
| `COMMON` | 0.20 |
| `UNCOMMON` | 0.30 |
| `RARE` | 0.40 |
| `BOSS` | 0.50 |

Two rules on top:

**A board of five may total no more than 1.2 × the bleed (2.16).** This is the one that matters, and it is what set the table above. A per-relic budget does not constrain the thing §11.5 measures, because §6.2 gives the player five slots. The first draft of this table read 0.25 / 0.4 / 0.7 / 0.9, and under it a board of two uncommons, two rares and a boss totals **3.10** against a 1.8 bleed — +1.3 a word, which balance snapshot `v2-001.md` measured as unloseable. Working backwards from the board is what produced 0.20 / 0.30 / 0.40 / 0.50:

| Board | at 0.25/0.4/0.7/0.9 | at 0.20/0.30/0.40/0.50 |
|---|---|---|
| 5 common | 1.25 · dies | 1.00 · dies |
| 3 common + 2 uncommon | 1.55 · in band | 1.20 · dies |
| 2 uncommon + 3 rare | 2.90 · **immortal** | 1.80 · in band |
| 2 uncommon + 2 rare + 1 boss | 3.10 · **immortal** | 1.90 · in band |
| 1 uncommon + 2 rare + 2 boss | 3.60 · **immortal** | 2.10 · in band |

**No single relic may exceed the boss allowance, 0.50, whatever its rarity.** An `MK.II` is judged against that ceiling rather than its base rarity — an upgrade is a Forge investment and is *supposed* to be worth more than the relic it upgrades. A base relic is judged against its tier.

**A payout bonus cannot be COMMON or UNCOMMON on a "solve in three" trigger.** That trigger fires on 43.3% of words, so the smallest integer bonus on it is worth **0.43** — the boss allowance — however small the bonus. The next tighter trigger, solving in two, fires on 7.7%: +2 there is 0.15, and +3 is 0.23. There is nothing in between, so a payout relic is either boss-tier or it is gated on a two-guess solve. `RL.11` Flywheel is COMMON and therefore reads "solve in two or fewer and the payout rises by 2"; `CH.02` The Gambler keeps the three-guess trigger and is valued at the boss allowance, because a character innate is held for the whole run.

Stated against the spec's 3.9 rather than a measured sample on purpose: a budget that moves every time someone re-runs the harness is not a budget. The calibrated solver measures 3.868 over 5000 clean solves, close enough that the distinction does not change a tier.

Relics that change **guesses per word** (`RL.01` Lexicon, `RL.02` The Sieve, `RL.03` Palimpsest, `RL.26` The Lantern) or **gold** (`RL.14`, `RL.22`, `RL.23`) are not yet valued against this table — they need the engine rather than arithmetic over the guess distribution. Sixteen of the twenty-two are in that position. The budget binds them all the same; it just cannot check them yet.

### 6.5 Scaling — normative

**Six relics carry a run-long counter and get stronger the longer they are held.** They are marked `scaling` in the registry and their current counter value is always visible on the card.

This is what makes a relic something a player builds toward rather than a modifier they happen to hold. v1.1 had none, which is the main reason relics felt inert.

| Relic | Counter | Scales on |
|---|---|---|
| `RL.03` Palimpsest | Solutions remembered | Time |
| `RL.12` Hot Streak | Consecutive fast solves | Success |
| `RL.14` The Guillotine | Times it has paid | Success |
| `RL.19` The Moth | Words survived | Time |
| `RL.23` The Tin Cup | Current rate | **Failure** |
| `RL.26` The Lantern | Times it has lit | **Failure** |

The split matters. Success-scaling relics reward a run already going well; failure-scaling relics are comeback engines and are the main structural defence against the death spiral (§11.2). Keep roughly this ratio when adding relics.

Counters never reset between acts. Hot Streak's resets on a slow solve, by its own rule, and is the only one that does.

### 6.6 Shop weighting — normative

Every relic slot on a shelf is drawn against two weights multiplied together.

**Rarity, by act.** R-052. The share of relic slots each rarity takes:

| | Act I | Act II | Act III |
|---|---|---|---|
| COMMON | 35% | 28% | 20% |
| UNCOMMON | 55% | 55% | 52% |
| RARE | **10%** | **17%** | **28%** |
| BOSS | — | — | — |

Read as a share of the **draw**, not as a per-relic weight. The registry holds 3 COMMON, 10 UNCOMMON and 5 RARE relics, so handing every relic its tier's weight gives the largest tier the largest share — which is exactly the bug this replaces: unweighted, those counts produce RARE at 27.8%. A tier's weight is therefore divided by how many of that tier are still unheld, so the stated share is the one that lands, and keeps landing as the pool empties: the last unheld RARE appears as often as the first of five did.

**UNCOMMON is the backbone in every act**, rather than COMMON early and UNCOMMON late. §6.4's impact test left only three COMMON relics, and a curve that gave Act I to COMMON would hand 60% of its shelf slots to three relics — three relic slots would then show the same three relics in every early shop. What moves across the acts is the thing a player is meant to feel moving: **RARE, from a tenth of the shelf to over a quarter.**

Twelve shops at three relic slots is 36 draws a run, so Act I shows about one RARE and Act III about three.

BOSS has no share in any act: §3.3 hands boss relics out on a boss clear and nothing else draws them.

**Tier-up.** `RL.22` Polyglot stocks the following shop "one rarity tier higher" (§6.5), which shifts this act's shares up one rung: COMMON's share goes to UNCOMMON and UNCOMMON's to RARE, and RARE keeps its own — there is nothing above it to promote into, and taking it away would make the relic lower the ceiling it is sold as raising. R-053.

**Archetype.** Offers bias toward archetypes the player already holds, with a floor so pivoting stays possible:

```
P(archetype) = 0.25 + 0.75 × (held_in_archetype / total_held)
```

normalised across archetypes. The floor guarantees every archetype stays reachable. Without weighting, players accumulate anti-synergistic piles.

### 6.7 Forge upgrades

Every relic carries **exactly one** upgrade tier, `MK.II`, defined under `upgrade`. Consumables are not upgradeable.

A Forge node grants **one** operation:
- **A · Upgrade a held relic** — free, permanent for the run
- **B · Convert gold to bankroll** — 20g each, any quantity affordable

`RL.09` The Anvil grants two operations.

An upgrade never changes a relic's `hook`, `archetype`, `rarity` or `code` — only its rule. The card is the same object with an `MK.II` badge, so no relic needs a second art state.

Upgrades sit on five axes, recorded in `upgrade.axis`: `magnitude`, `duration`, `reach`, `reliability`, `cost`.

Two hard rules:
1. **A scaling relic's upgrade must accelerate the counter, never replace it with a flat bonus.** Converting a scaling relic to a static one at MK.II destroys the reason it was interesting.
2. **Boss relics upgrade by shrinking their drawback, never by raising magnitude.** Where a boss relic has no drawback, upgrade on `reach`.

---

### 6.8 Events

Content in `events.json`, normative for names, prose, options, stakes and
effects. Thirteen events, `EV.01`-`EV.13`.

An EVENT node draws one, **without replacement within a run**, from the events
whose `acts` list includes the current act. Thirteen against an expectation of
2-5 events a run is enough that an act never exhausts its pool.

Three rules the content has to keep, and the validator checks:

- **Every event offers 2-3 options, and at least one is non-destructive.** It
  need not be free — walking away from a good offer is a cost.
- **An event never hides its odds.** The `stake` line states the full
  consequence including the failure branch. Concealed risk is what modifiers and
  relics are for; an event that lies breaks the contract that makes the other
  systems readable.
- **An option the player cannot take renders disabled with its requirement
  stated, never hidden.** A door you can see is a reason to come back with gold.

Effects are drawn from a closed vocabulary, listed in the file's
`effect_vocabulary`. An event that needs a verb the list does not have is a
signal the list is incomplete — extend it and say so, rather than encoding the
effect as prose the engine cannot read.

---

## 7. Modifiers

Modifiers attach to words and are the entire difficulty curve.

**Difficulty comes from modifiers, never from rarer vocabulary.** Obscure words punish vocabulary knowledge rather than play skill, and a vocabulary loss at word 14 reads as theft. This constrains §10 and is not negotiable.

| Modifier | Act | Effect |
|---|---|---|
| Locked Key | I+ | One random letter unusable. **Never a solution letter.** |
| Silent Start | I+ | First guess suppresses YELLOW to UNKNOWN; GREEN and GREY are unaffected |
| Long Word | II+ | 6 letters (base 7) |
| Decay | II+ | GREEN reverts to UNKNOWN after one turn |
| Fog | II+ | Feedback for guess *n* shows only after guess *n+1* |
| Mirror | II+ | Two solutions, one bankroll (§8.1) |
| Liar Letter | III | One position reports false all word; fixed at word start |
| Longer Word | III | 7 letters (base 8) |
| Stacked | III | Elites roll 2 modifiers |

**Exclusions:** Fog and Cipher cannot co-occur. Silent Start and Fog cannot co-occur.

**⚠ Long Word and Longer Word are currently rewards, not difficulty.** §2.3's base rises by 1 per length while the guess count *falls* — longer words carry more constraints per guess, so a solver narrows faster. Measured over 800 real solves per length:

| Length | Base | Guesses/word | Net = base − 2g |
|---|---|---|---|
| 5 | 6 | 3.77 | **−1.54** |
| 6 (Long Word, II+) | 7 | 3.47 | **+0.07** |
| 7 (Longer Word, III) | 8 | 3.10 | **+1.80** |

A 7-letter word is worth **+1.80 bankroll** where a 5-letter word costs 1.54, so Act III's headline difficulty modifier is the single most profitable thing in the game. Either the base stops rising with length (a flat 6 makes a 7-letter word net −0.2, still the hardest), or these two stop being described as difficulty. Same failure as the refill valve: a number carried across a redesign without redoing the arithmetic underneath it. Unresolved; §13.

---

## 8. Bosses

Boss words pay out normally under §2.3, **plus** a flat **+4 bankroll** on clearing the boss.

### 8.1 Act I — The Twins

Two solutions, one bankroll. Each guess is scored against both.

**Shared-letter ruling:** each guess produces **two fully independent `FeedbackResult` objects**, one per solution, rendered as two rows. No merging, no precedence. A letter green in solution A and absent in B renders green in row A and grey in row B.

This is the only rule that composes cleanly with the pipeline — each result runs the chain independently. The design already renders two rows, so no design change is needed.

Keyboard state under Mirror shows the **best** state across both solutions; the keyboard is a memory aid, not a claim about one word.

Solving one solution locks its row and continues the other. Both must fall to clear. Each pays out separately.

### 8.2 Act II — The Cipher

No feedback until three guesses are committed; all three then resolve at once. No corruption, just blind. Forces planning an information tree rather than reacting.

Same deferral mechanism as Fog (transform step 5), depth 3.

### 8.3 Act III — The Gauntlet

Five words, back to back, **no shop between them**. Each pays out normally, so a strong solver runs it near-neutral and a weak one cannot survive it. Pure attrition against the assembled build.

The v1.1 separate 14-guess pool is removed. The run-long bankroll makes it unnecessary, and a separate pool broke the one-resource principle.

---

## 9. Characters

| Character | Start | Innate |
|---|---|---|
| The Linguist | 14 | Sees the solution's vowel count on every word |
| The Gambler | 9 | Solve in three or fewer: payout +3 |
| The Cryptographer | 11 | May spend a guess to reveal one letter outright, any time |

---

## 10. Word lists

Two lists: **`solutions`** (curated, ~1500 five-letter, ~800 six, ~500 seven) and **`valid_guesses`** (~13,000, gates input, never an answer).

### 10.1 Curation — required preprocessing

**Ambiguity clusters must be excluded from `solutions`.** Families like `WATCH / BATCH / CATCH / MATCH / HATCH / LATCH` and the `-IGHT` set create positions where correct play still loses. Tolerable in a daily puzzle; run-ending here, and far worse under a run-long bankroll than under per-act pools.

Preprocessing script must:
1. Identify clusters where ≥4 candidates share ≥4 positions
2. Remove all members from `solutions` (they remain legal guesses)
3. Emit a removal report for review

**Frequency banding:** solutions in the top ~8000 words by corpus frequency. No archaic or specialist vocabulary. This follows directly from §7 — if difficulty comes from modifiers, vocabulary must stay easy.

Six- and seven-letter lists need the same treatment and are harder to source. Budget time.

---

## 11. Determinism, balance and the simulation gate

### 11.1 Determinism

**Seeded RNG throughout.** One run seed determines map layout, word selection, shop stock, modifier placement, Liar Letter position and every in-word roll. Same seed plus same inputs produces an identical run.

Use a **named, separate RNG stream per subsystem** (map, words, shop, corruption) so adding a roll to one subsystem does not shift every downstream sequence and invalidate existing seeds.

### 11.2 The death spiral — the primary v2.0 risk

The bankroll economy is structurally a spiral: bleed → fewer guesses available → worse solves → more bleed. Balatro has the same shape and survives it because a bad run ends quickly.

**The failure mode is not losing. It is a run that becomes mathematically dead ten minutes before it is actually over.**

The harness must report **time-between-doomed-and-dead**, where "doomed" means no reachable line of play reaches the next boss. If that median exceeds **two minutes**, the fix is a larger and later boss payout, not a gentler bleed. Softening the bleed removes the tension the whole redesign exists to create.

Three structural defences are already in place: emergency purchases (§2.4), failure-scaling relics (§6.5), and the shop after every solve node, which means help is never more than one word away.

### 11.3 Headless harness — required

The rules engine must run without UI. **Every number in §2 and §4 is provisional until simulation confirms it.** They are derived estimates, not measurements.

Reports:
- Win rate by character
- Death-word distribution
- Average guesses per word, by act and word length
- Bankroll curve, mean and variance, by word index
- **Relics held at death and at victory** — the acquisition curve is now a balance number
- Scaling-relic counter values at run end
- Gold spent by category, and reroll frequency
- Death cause attribution: decision quality vs. word-list luck
- Time-between-doomed-and-dead

### 11.4 The solver offset

A simple entropy-maximising solver is sufficient as the simulated player. It plays better than a human — roughly 3.4 guesses per word against a human 3.9. Under the §2.3 payout table that difference is worth **1.0 bankroll per word**, which compounds into a completely different run.

**Tune to the human baseline, not the bot's.** Apply the offset explicitly rather than tuning until the bot's win rate looks right. This matters far more in v2.0 than in v1.1, because the payout curve amplifies small skill differences.

### 11.5 Targets

| Metric | Target |
|---|---|
| Win rate, competent human, tuned build | 20–30% |
| Win rate, no relics purchased | <2% |
| Median relics held at death | 3–5 |
| Deaths attributable to word-list luck | <5% |
| Median run length | 20–30 min |
| Median time-between-doomed-and-dead | <2 min |
| Act I death rate | 10–20% |

Act I deaths are now expected and acceptable. Under v1.1 the target was <15% with a refill safety net; under a run-long bankroll an early death is a fast, legible loss rather than a frustrating one.

If word-list-luck deaths exceed 5%, §10.1 curation was not aggressive enough. Fix the list, not the economy.

---

## 12. Rulings log

R-001 through R-016 carry forward from v1.1 except where noted.

**Numbering correction.** This document was drafted against v1.1, but the
repository shipped v1.2 and v1.3, which assigned **R-017 through R-036** to
other rulings. The five new rulings below were drafted as R-017…R-021 and are
renumbered **R-037…R-041** here. Nothing in the rules changed — only the labels.
The originals, and what v2.0 does to each, are in §12.1.

**R-002 · Rangefinder tile.** Still open as a design bug. CMP.02 renders a glyph in the rangefinder state; it must render distance with no character. MK.II adds direction, so the tile must also carry a direction indicator.

**R-004 · The Guillotine.** Superseded. The relic is now scaling (§6.5); see registry.

**R-006 · Refund floor.** Superseded by §2.5 Clamps A and B.

**R-007 · Information cap.** **Removed.** The 5-slot cap (§6.2) does this work directly.

**R-011 · Relic codes are opaque.** Stands, and matters more now. Codes `RL.05`, `RL.08`, `RL.10`, `RL.16`, `RL.17`, `RL.18`, `RL.24`, `RL.25`, `RL.27` are unassigned or retired. **There are 22 relics.** Count the array, never the codes. Any tooling deriving a count or index from a code is a bug.

**R-037 · Node rewards.** Superseded by §3.3 and §4. Word nodes no longer grant relics at all.

**R-038 · Bankroll display.** Bankroll caps at 24, so the design's 24-pip row in CMP.01 is exactly correct and needs no change. The row starts half-full at 12. **This closes the pip-elasticity question open since v1.0.**

**R-039 · Relic impact test.** Seven relics cut (§6.4). Metronome, Concordance, Ledger, Insurance and Pilgrim failed the test; Vault and Wishbone were made obsolete by the refill removal.

**R-040 · Scaling.** Six relics carry run-long counters (§6.5). Counter value must be visible on the card at all times. **Design change filed** — the relic card needs a counter treatment it does not currently have.

**R-041 · Shop restructure.** Shop is no longer a map node. It opens automatically after every solve node. **Design change filed** — the map screen loses its shop node type, and S.05 Relic Reward is replaced entirely by the shop screen.

---

## 13. Open

1. **Relic card counter treatment.** Six relics need a persistent visible number. No current design state supports it. Blocking for those six.
2. **Full-board acquisition UI.** Buying at 5/5 needs a destroy-one flow with the incoming relic visible alongside the five held. No current screen.
3. **Long-word layout undemonstrated.** No screen shows 6 or 7 tiles. Seven at a 5px gap in a 430px column lands near 55px, under the 62px cap, so it should hold — but nobody has looked.
4. **Low-bankroll flicker duration.** `rg-flicker` loops indefinitely at ≤5. Under a run-long bankroll a player can sit there far longer than under per-act pools. Playtest for irritation.
   → **Playtested.** Held a run at exactly bankroll 5 for 65+ continuous seconds (`WordScreen`, non-solving guesses so the state didn't move). Measured behavior: the whole content pane — grid, banners, keyboard, not just a peripheral indicator — drops to 45% opacity in a quick double-blink (~0.35s total: a 0.05s dip, a 0.05s flash back to full, a 0.25s dip) once every 5s cycle, with no falloff or cap. It repeated 13 times in the window, identical in amplitude every time.
   Read as genuinely irritating over a sustained stretch, which is exactly the case v2.0 makes common: a build stuck at 3-5 bankroll for several consecutive words (plausible under the §2.3 bleed with a thin board) can now hold this state for many minutes rather than the few seconds it was under a per-act pool. It also duplicates `rg-pulse` on the HUD's "BANKROLL CRITICAL" dot, which already signals the same state continuously at its own steady cadence — running both together reads as more noise than either alone, and the full-pane dim briefly obscures the tiles a player most needs to read at the moment stakes are highest.
   Proposed fix, for design review rather than applied here: fire `rg-flicker` on the transition into ≤5 only (2-3 blinks), then hold the static critical styling (red pips/text) that's already in place; let `rg-pulse`'s dot alone carry the ongoing "still critical" signal instead of re-triggering the full-pane dim forever. Not implemented — this is a call for whoever owns the animation, not a unilateral change to a shipped effect.
5. **Meta-progression.** Still out of scope.

---

## 14. Build order

**Phase 1 — Rules core.** Feedback pipeline, ported scorer plus tests, bankroll reducer including §2.3 payout and §2.5 clamps, seeded RNG, headless harness. Debug view only.

**Phase 2 — Twelve words, linear.** No branching, no acts, no bosses. Shop after every word, 8 relics, 5 slots. The question this phase answers: *does the bankroll actually bite, and does buying a relic feel like relief?* If either answer is no, stop. Nothing downstream fixes it.

**Phase 3 — Run structure.** Branching map with §3.1 constraints, three acts, forge, events, bosses.

**Phase 4 — Content.** Full registry, all modifiers, all events, characters.

**Phase 5 — Balance.** Simulation against §11.5, with §11.2 as the gating metric.


**R-042 · Gold buys builds; it buys survival at a penalty.** §4.1 sold three guess refills a shop at a flat 25g. Across twelve shops that is **36 purchasable bankroll against a non-relic economy of 24** — one and a half times the whole base economy, carried from a per-act pool into a twelve-shop run without redoing the multiplication. The rate was backwards as well: 25g a bankroll against an uncommon relic's ~27g, so gold bought survival more cheaply than it bought a build.
→ **Ruled:** one refill a shop, on a ladder escalating across the run at 40/60/80/100/120/140g, six in a run, hard cap. 540g for 6 bankroll — 90g each, comfortably worse than relic efficiency, and a quarter of the base economy rather than 1.5×. Measured: a relic-less run falls from 91.0% to 34.3%.

**R-043 · A valve's price follows its grant.** §2.4's grant tripled from +1 to +3 in the v2.0 redesign — correctly, because under a run-long bankroll +1 puts you back at zero inside one word — and the price stayed at 25/50/100. That put the first purchase at **8.3g per bankroll**, the cheapest bankroll in the game, below a refill and a third of relic parity. The last resort became the best deal on the board, and optimal play became running yourself to zero on purpose.
→ **Ruled:** 80/160/320, +3 each, three rungs. The first is ~27g a bankroll, roughly relic parity, and it doubles. A player with no gold dies, which is correct. The standing rule: **whenever a grant changes size, its price is re-derived, not inherited.**

**R-044 · Relic power is a budget, not a feel.** v2.0 set relic values by judgement and never checked them against §2.3, so "too strong" had no meaning. Measured, nine of the ten relics that move bankroll or payout exceeded half the bleed, and `RL.19` The Moth paid **2.50 a word** — more than the entire bleed, on an UNCOMMON — because it paid +2 at *every* word start rather than on the gorge.
→ **Ruled:** §6.4 carries an explicit allowance by rarity and a hard ceiling of half the bleed. Every relic that moves bankroll or payout carries a measured `value_note` in the registry. `RL.11`, `RL.12`, `RL.13`, `RL.15`, `RL.19` and `CH.02` retuned to fit. Sixteen relics change guesses-per-word or gold instead and cannot be valued until the engine migrates; the budget binds them, it just cannot check them yet.

**R-045 · Silent Start was already ruled, twice.** Raised again in review as unruled, on the grounds that the log ends at R-021. It ends there in *this document*, which was drafted from v1.1; the repository shipped v1.2 and v1.3, and **R-028** (greens survive) and **R-029** (suppressed tiles report `UNKNOWN`, not `GREY`) both rule it. The diagnosis offered in review — that a false `GREY` would feed `RL.02` The Sieve and lock a solution letter — is exactly R-029's reasoning, and R-029 closed it.
→ **Ruled:** R-028 and R-029 stand. The review's one substantive change, rendering the suppressed yellow `HIDDEN` rather than `UNKNOWN`, is **rejected**: `HIDDEN` already means *this whole row is unread* (Fog, the Cipher), and the solver bails on the entire row when it sees one — so a per-tile `HIDDEN` would throw away the greens and greys on the same row, and with them the deduction that a blank tile on a Silent Start row *is* a withheld yellow. That inference was worth 21 points of measured win rate (§13 I-27). `UNKNOWN` already ranks below `GREY` in the keyboard derivation, so the Sieve is untouched either way, and neither state needs `trustworthy: false` — the concern about The Mask covering a tier-one modifier applies to `GREY` alone. If `UNKNOWN` carrying both "decayed green" and "withheld yellow" is judged too overloaded, the answer is a **new** `TileState`, not the one Fog owns.

**R-046 · One ladder, wherever you buy bankroll.** §6.7 operation B sold bankroll at a flat 20g, "any quantity affordable", with a forge guaranteed every act. After R-042 and R-043 repriced the other two valves that made the forge the cheapest bankroll in the game and the only uncapped one: switching it on took a relic-less run from 34.3% to 63.5%, undoing most of both fixes. Pricing it separately would have re-opened the arbitrage the moment either number moved again.
→ **Ruled:** the forge draws from the **same §4.1 ladder** the shop sells from. A run buys at most six bankroll however it splits them between shop and forge. Measured: the forge row is now identical to the no-forge row. The standing rule: **two shops selling the same thing share one ladder, or the cheaper one is the only one.**

**R-047 · The payout base is flat across lengths.** §2.3's base rose by 1 a letter. Longer words take *fewer* guesses, not more — more letters means more constraints per guess — so a rising base compounded an advantage instead of compensating a cost. Measured over 800 solves per length, net was **−1.54** at five letters, **+0.07** at six and **+1.80** at seven: Act III's headline difficulty modifier was the single most profitable thing in the game.
→ **Ruled:** base 6 at every length. Long Word and Longer Word are now −0.94 and −0.20, still easier than a five-letter word but no longer profitable. The residue is not the payout's fault — §10's six- and seven-letter solution lists are ~800 and ~500 against ~1500, so there is simply less to disambiguate — and closing it is a curation job. Flattening the base also removed Clamp A's one bite on unassisted play: a 7-letter hole-in-one used to net +7 and be clamped to +5, so the luckiest guess in the game was the only thing the clamp punished.

**R-048 · The board is the budget, not the relic.** R-044 set an allowance per relic. §6.2 gives the player **five slots**, so a per-relic budget does not constrain what §11.5 measures. Under R-044's table a board of two uncommons, two rares and a boss totalled **3.10** against a 1.8 bleed — +1.3 a word, which `v2-001.md` measured as unloseable.
→ **Ruled:** a board of five may total no more than **1.2 × the bleed**, and the tier table is derived from that rather than chosen: 0.20 / 0.30 / 0.40 / 0.50. The per-relic ceiling falls from 0.9 to 0.50 — the boss allowance, 28% of the bleed rather than half. An `MK.II` is judged against the ceiling, a base relic against its tier, because an upgrade is a Forge investment and is supposed to be worth more than what it upgrades.

One consequence is worth stating outright: **a payout bonus cannot be COMMON or UNCOMMON on a "solve in three" trigger.** That trigger fires on 43.3% of words, so the smallest integer bonus on it is 0.43 — the boss allowance — however small the bonus. The next tighter trigger fires on 7.7%. There is nothing in between, so a payout relic is either boss-tier or gated on a two-guess solve.

**R-049 · A calibration probes at the size it reports.** §11.4's handicap is tuned until `cleanBaseline` reads 3.9, and it probed 400 words. At n=400 that estimator carries about ±0.05 from two sources — which words are drawn, and which vocabulary slice the seed produces — so the search stopped at 3.893 while the converged value was **3.84**, six hundredths under target, and the test guarding it probed at the same 400 and passed throughout.
→ **Ruled:** the calibration probes 2500 and records `wordsPerProbe` in `calibration.json`; the Gate 1 test reads that field rather than hardcoding a size, so the two cannot drift apart. Re-derived, `vocabularyGap` moves 0.0938 → 0.1125 and the converged baseline is 3.868. The standing rule: **a search that stops inside its estimator's noise band has not converged, and a test at the same sample size cannot tell.**

**R-050 · A relic's declared `hook` is where it RESOLVES, not how it is fired.** §6.1's hook list has no entry for "the player pressed the button", and the four activated relics — `RL.07` The Auditor, `RL.20` Blindfold, `RL.21` All In, `RL.28` Shaved Coin — plus `CH.03`'s innate are all things a player *does* rather than reactions to an event. The registry gives each of them the hook its effect lands on (`onGuessSubmit`, `onWordStart`, `onFeedbackTransform`), which is the right answer for the transform chain and the wrong one for the thing that fires them.
→ **Ruled:** the `activation` block is what makes a relic fireable, and the implementation supplies an `onUse` handler for it; the JSON's `hook` continues to name the resolution point. The registry validator checks `activation` against the IMPLEMENTATION's `onUse`, not against the JSON's `hook` — which is the invariant that actually matters, because `USE_ITEM` dispatches through `resolveUse` and never reads the JSON hook at all. v1.3 required `hook: "onUse"` on any relic with an activation and the two agreed by construction; under v2.0's registry they do not, and the weaker of the two checks was the one being made.

**R-051 · `RL.30` Ouroboros' MK.II breaks §6.7 rule 2, and ships anyway.** Rule 2 says a boss relic "upgrades by shrinking its drawback, never by raising magnitude". Ouroboros returns you to 8 at MK.II's 12, which is `magnitude` and is recorded as such in the registry. The alternative reading of its drawback — "once per run" — would upgrade to twice per run, which is a far larger change than +4 bankroll once.
→ **Ruled:** the registry entry stands and the axis stays `magnitude`, as a NAMED exception rather than a silent one. Rule 2 exists to stop a free relic growing without a counterweight, and +4 bankroll once in a run is the smallest boss upgrade in the set — smaller than either `reach` upgrade, which each extend a relic across a whole new class of word. The validator reads the exception from this ruling rather than from a hardcoded list, so a second boss relic drifting to `magnitude` still fails.

**R-052 · Rarity gates supply; price does not.** Rarity was decoration. `relics.json` carried the field, the card spine coloured itself from it and §4.2 looked a number up in it, but no draw consulted it — `rollShopStock` weighted by archetype alone. A tier's share of a shelf was therefore however many relics happened to be in it: RARE filled **23%** of every shelf, in every act, and the three acts drew from an identical shelf. Price was the only thing making a rare feel rare, and a price cannot do that job: a player who wants it saves two nodes and buys it, while a player who cannot afford one is left with a shelf they can do nothing with.
→ **Ruled:** §6.3, §6.6 and §4.2. A per-act rarity share on every relic draw — RARE 10% / 17% / 28% — divided by the live count of that tier so the stated share is the one that lands. §4.2's prices drop about a third behind it (60/110/180 → 40/70/110) and §3.3's node gold drops with them (40/70/120 → 30/50/90), which is `v2-004`'s first lever taken at its recommended size. Measured, 1000 runs on identical seeds: RARE 23.7% → 10.3% in Act I and 26.8% in Act III, a whole shelf 395g → 223g, relics bought 11.2 → 8.8, gold left unspent 166g → 124g. Win rate 59.6% → 58.1% and **Act I's death rate moves into §11.5's band** at 10.9%, so the change pays for itself; the 20–30% win-rate band is not reached and this ruling does not attempt it — see `v2-005` and §13. Balance snapshot `v2-005`, `ADR-0013`.

**R-053 · `RL.22` Polyglot raises what the shelf STOCKS, not what it charges.** Its rule is "the shop that follows them stocks one rarity tier higher". The implementation drew the shelf normally and then priced each relic one tier up, so a boss relic bought to improve the shop instead charged UNCOMMON money for a COMMON relic — the exact penalty its own code comment said it was avoiding. It was invisible because there was no notion of what a shelf stocks *at*: without §6.6 there was no tier to raise.
→ **Ruled:** §6.6. Tier-up shifts the act's rarity shares up one rung and prices every relic at its own rarity. Measured in Act I: RARE 10.3% → 42.6% and COMMON to zero. The shelf costs more because it is better, which is the direction a boss relic should move a price.

### 12.1 Carried forward from v1.3

v1.3 added R-017 through R-036. Most are still live engine behaviour with tests
behind them, and this document does not know about them because it was drafted
against v1.1. Their status under v2.0:

| Ruling | Status under v2.0 |
|---|---|
| R-017 `RL.08` The Fence | **Superseded.** The Fence was cut in §6.4. |
| R-018 The refund floor and word-start refunds | **Superseded** by §2.5 Clamps A and B. |
| R-019 The Twins is the Act II boss | **⚠ Conflict.** See below. |
| R-020 Gold is inert, and that is why the pool is not tense | **Fulfilled.** This is the diagnosis v2.0 is the treatment for. Gold now buys relics continuously (§4). |
| R-021 Forge upgrade coverage | **Stands.** Every relic still carries exactly one MK.II (§6.7). |
| R-022 Event content | **Superseded** by `events.json` v2.0. |
| R-023 Relic count | **Superseded.** 31 → 22 (§6.4). |
| R-024 `poolMax` is the refill target, not a ceiling | **Moot.** There are no refills. Replaced by the §2.1 hard cap of 24, which *is* a ceiling. |
| R-025 Node rewards | **Superseded** by R-037. |
| R-026 Nothing may defer feedback over two solutions | **Stands.** Mirror + Fog/Cipher still compose. |
| R-027 Rangefinder was not withholding anything | **Stands.** §5.2's `letter: null` is this ruling. |
| R-028 Silent Start keeps its greens | **Stands.** §7's table now matches. |
| R-029 Silent Start withholds a yellow; it does not invent a grey | **Stands.** §7's table now matches. |
| R-030 A staked word must say so | **Stands**, and matters more — `RL.21` All In is still in the registry. |
| R-031 An activation that produces nothing is refused, not consumed | **Stands.** |
| R-032 Bought information must be visible after the drawer closes | **Mostly moot.** The paid reveal ladder is cut. The principle still binds `RL.07` The Auditor, whose stamp must survive the panel closing. |
| R-033 A boss's rule belongs where rules live, not in a marquee | **Stands.** |
| R-034 A withheld row says when it will speak | **Stands.** Fog and the Cipher still defer. |
| R-035 A forge offers three, and nothing is spent until you say so | **Half stands.** §6.7 grants one operation over *held* relics, so there is no offer to draw — but the select-then-commit rule came from a playtest where a misclick spent the operation on nothing, and that half is a UI requirement on every screen that spends a resource. |
| R-036 A revealed letter is knowledge, not a result scored against a guess | **Stands.** §5.2's `meta.revealedLetters` is this ruling. |

#### Carried forward from v1.0-v1.2

The §12 log above is the v1.1 log plus v2.0's additions, so it skips rulings the
v1.2 and v1.3 documents made and the engine still implements. Two are cited by
`relics.json` and are restated here so every citation resolves:

**R-001 · `RL.07` The Auditor charges gold, not a guess.** Its rule reads "name
one untried letter and pay"; the currency was unstated. A guess cost would make
it a worse `CH.03`, whose innate is exactly that trade. Gold, from the
`activation.cost` block, so the engine charges it rather than the relic.

**R-003 · A locked letter is never a solution letter.** Both Locked Key (§7) and
`RL.19` The Moth remove letters from the keyboard, and either could otherwise
make a word unsolvable. One shared `eligibleLettersForRemoval(solution)` helper
draws for both, so neither relic sees the solution and neither can violate it.

The remaining pre-v1.3 rulings are unchanged and uncited; the archived v1.3
document holds their full text.

#### One bookkeeping note

`relics.json`'s `_notes.retired` lists seven retired codes; §12 R-011 lists nine.
The registry holds 22 and 31 − 9 = 22, so **R-011 is right and the note is two
short**: `RL.08` The Fence and `RL.17` The Holdout are also gone. Both were
reveal-ladder relics, and the ladder is cut, so they are obsolete rather than
cut on the §6.4 test — which is presumably why they fell out of the note. Fixed
in the registry.

#### One conflict, unresolved

Silent Start's §7/R-028/R-029 conflict is resolved: §7's table was v1.1 wording,
carried forward by mistake, and now reads "suppresses YELLOW to UNKNOWN; GREEN
and GREY are unaffected", matching what R-028 and R-029 ruled and what the
engine already ships (see `suppression()` in `lib/engine/feedback/chain.ts` and
the `R-029 Silent Start` tests in `lib/engine/feedback/chain.test.ts`).

**1 · Boss order (§8.1/§8.2 vs v1.3's R-019).** v2.0 puts the Twins in Act I and the
Cipher in Act II. v1.3 swapped them, on measurement: the Twins in Act I ended
**20.5% of all runs** — half of every death in the game, against 4.3% for the
next worst node — not because Mirror is broken but because its variance landed
on a hard wall at the end of the shortest act, with the fewest relics to absorb
it. Raising Act I's pool to 28 barely moved it.

A run-long bankroll changes that arithmetic and could change the conclusion:
there is no act boundary to be unprepared at any more. But it changes it in both
directions — there is also no refill afterwards to recover from it, and §2.3
makes a Mirror word two payouts rather than one.

**The engine ships v2.0's order** (Twins in Act I) because it is stated as
document structure rather than a table cell, and because it is exactly the kind
of question the harness exists to answer. It is the first thing to measure once
§2 lands, and the number to watch is the Act I death rate against §11.5's
10–20%.
