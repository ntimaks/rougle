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
| 6 | 7 | 3.5 guesses |
| 7 | 8 | 4 guesses |

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
| 1st | 25g | +3 bankroll |
| 2nd | 50g | +3 bankroll |
| 3rd | 100g | +3 bankroll |
| 4th | 200g | +3 bankroll |
| 5th+ | Unavailable | |

The offer is mandatory UI. The player must always see the exit they did or did not buy.

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
| Word | 40g | Shop opens on clear |
| Elite | 70g | Shop opens on clear |
| Boss | 120g | +4 bankroll, and choice of 1 of 2 boss relics |

Boss relics occupy a slot like any other. The player may decline both.

---

## 4. The shop

**A shop opens after every solve node**, elites included. Twelve shops per run. It is not a map node and cannot be routed around.

This is what makes gold matter continuously and what makes relic acquisition an act of intent rather than a lottery. In v1.1 relics were granted free at every word node, producing ~15 relics per run and leaving gold with nothing to buy.

### 4.1 Stock

Each shop rolls:
- **3 relics**, weighted by archetype (§6.6)
- **1 consumable**
- **Guess refills** — 25g each, maximum 3 per shop

### 4.2 Prices

| Item | Price |
|---|---|
| Common relic | 60g |
| Uncommon relic | 110g |
| Rare relic | 180g |
| Consumable | 40g |
| Guess refill (+1 bankroll) | 25g |
| Reroll stock | 20g, +10g per reroll within the same shop |
| Sell a held relic | 50% of price, rounded down |

Income runs roughly 300g per act. That funds about two relic purchases per act before rerolls, refills and consumables. A player cannot buy everything, which is the point.

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

### 6.3 Rarity

`COMMON` · `UNCOMMON` · `RARE` · `BOSS` · `CONSUMABLE`

Consumables are not relics, occupy their own slots, and are spent on use.

### 6.4 The impact test — normative

**A relic must change what you would type, when you would route, or what you would risk. If it only changes a number after the fact, it is a shop item or it is deleted.**

v1.1 failed this badly. The Metronome paid 10g for solving in exactly three. The Ledger converted leftovers at 15g instead of 10g. Insurance made one emergency guess free. None changed a single keystroke. Balatro's *worst* joker still does something you can watch happen.

Seven relics were cut on this test or made obsolete by the refill removal: Metronome, Concordance, Ledger, Insurance, Pilgrim, Vault, Wishbone. Any new relic must pass it before entering the registry.

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

### 6.6 Shop weighting

Offers bias toward archetypes the player already holds, with a floor so pivoting stays possible:

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

## 7. Modifiers

Modifiers attach to words and are the entire difficulty curve.

**Difficulty comes from modifiers, never from rarer vocabulary.** Obscure words punish vocabulary knowledge rather than play skill, and a vocabulary loss at word 14 reads as theft. This constrains §10 and is not negotiable.

| Modifier | Act | Effect |
|---|---|---|
| Locked Key | I+ | One random letter unusable. **Never a solution letter.** |
| Silent Start | I+ | First guess returns GREY only |
| Long Word | II+ | 6 letters (base 7) |
| Decay | II+ | GREEN reverts to UNKNOWN after one turn |
| Fog | II+ | Feedback for guess *n* shows only after guess *n+1* |
| Mirror | II+ | Two solutions, one bankroll (§8.1) |
| Liar Letter | III | One position reports false all word; fixed at word start |
| Longer Word | III | 7 letters (base 8) |
| Stacked | III | Elites roll 2 modifiers |

**Exclusions:** Fog and Cipher cannot co-occur. Silent Start and Fog cannot co-occur.

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
5. **Meta-progression.** Still out of scope.

---

## 14. Build order

**Phase 1 — Rules core.** Feedback pipeline, ported scorer plus tests, bankroll reducer including §2.3 payout and §2.5 clamps, seeded RNG, headless harness. Debug view only.

**Phase 2 — Twelve words, linear.** No branching, no acts, no bosses. Shop after every word, 8 relics, 5 slots. The question this phase answers: *does the bankroll actually bite, and does buying a relic feel like relief?* If either answer is no, stop. Nothing downstream fixes it.

**Phase 3 — Run structure.** Branching map with §3.1 constraints, three acts, forge, events, bosses.

**Phase 4 — Content.** Full registry, all modifiers, all events, characters.

**Phase 5 — Balance.** Simulation against §11.5, with §11.2 as the gating metric.


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
| R-028 Silent Start keeps its greens | **⚠ Conflict.** See below. |
| R-029 Silent Start withholds a yellow; it does not invent a grey | **⚠ Conflict.** See below. |
| R-030 A staked word must say so | **Stands**, and matters more — `RL.21` All In is still in the registry. |
| R-031 An activation that produces nothing is refused, not consumed | **Stands.** |
| R-032 Bought information must be visible after the drawer closes | **Mostly moot.** The paid reveal ladder is cut. The principle still binds `RL.07` The Auditor, whose stamp must survive the panel closing. |
| R-033 A boss's rule belongs where rules live, not in a marquee | **Stands.** |
| R-034 A withheld row says when it will speak | **Stands.** Fog and the Cipher still defer. |
| R-035 A forge offers three, and nothing is spent until you say so | **Half stands.** §6.7 grants one operation over *held* relics, so there is no offer to draw — but the select-then-commit rule came from a playtest where a misclick spent the operation on nothing, and that half is a UI requirement on every screen that spends a resource. |
| R-036 A revealed letter is knowledge, not a result scored against a guess | **Stands.** §5.2's `meta.revealedLetters` is this ruling. |

#### One bookkeeping note

`relics.json`'s `_notes.retired` lists seven retired codes; §12 R-011 lists nine.
The registry holds 22 and 31 − 9 = 22, so **R-011 is right and the note is two
short**: `RL.08` The Fence and `RL.17` The Holdout are also gone. Both were
reveal-ladder relics, and the ladder is cut, so they are obsolete rather than
cut on the §6.4 test — which is presumably why they fell out of the note. Fixed
in the registry.

#### ⚠ Two conflicts, unresolved

**1 · Silent Start (§7 vs R-028/R-029).** The §7 table says Silent Start's first
guess "returns GREY only". That is the v1.1 wording, and v1.3 ruled it out twice.
GREY means *this letter is absent*, so reporting grey over a letter that is
present is not withholding information — it is emitting a false one, and R-014
forbids the engine lying in a way the player cannot detect. It also broke the
solver badly enough to cost 21 points of measured win rate before it was found
(technical brief §13 I-27). R-029's rule is that suppression turns YELLOW into
UNKNOWN and leaves GREEN alone: the row is quiet, not wrong.

**The engine ships R-029's behaviour** until this is ruled otherwise, on the
grounds that the §7 line reads as inherited wording rather than a deliberate
reversal. If the reversal *is* intended, say so and it changes in one function —
but the solver has to be told at the same time, or the next sweep will describe
the bot rather than the game.

**2 · Boss order (§8.1/§8.2 vs v1.3's R-019).** v2.0 puts the Twins in Act I and the
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
