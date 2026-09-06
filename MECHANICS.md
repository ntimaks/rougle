# Rougle — Mechanics Specification

**Version:** 1.3
**Status:** Canonical
**Supersedes:** `Roguelike Wordle Mechanics.md` (v0, the original brief) — that document is now historical and should be deleted from the repo or moved to `docs/archive/`.
**Companion files:** `relics.json` — machine-readable relic registry, normative for all relic rules, including every `MK.II` upgrade. `events.json` — event content, normative for §6.8.

---

## 0. Authority

This document is the single source of truth for **game rules**: resources, scoring, run structure, relics, modifiers, bosses, word selection, and balance targets.

`design_handoff_rougle/` is the single source of truth for **presentation**: layout, colour, typography, motion, component states, and interaction affordances.

Where they overlap, the split is:

| Question | Authority |
|---|---|
| What does this relic do? | MECHANICS.md + relics.json |
| What is it called? | relics.json |
| What does its card look like? | design doc |
| When does the pool decrement? | MECHANICS.md |
| How does the decrement animate? | design doc |
| What states can a tile be in? | MECHANICS.md (`FeedbackResult`) |
| What each state looks like | design doc |

**The design files currently contain rule text in prototype strings.** That text is not normative. Where a prototype string and this document disagree, this document wins, and the prototype string is a bug to be filed against the design.

Changes to this document are versioned. Bump the minor version for rule changes, the patch version for clarifications. Record every change in §11.

---

## 1. What changed from v0

The brief was written before the design pass. The design pass renamed most relics, redesigned two, invented four more, and added an item class. It also surfaced arithmetic errors in the brief. This section is the delta so nobody has to diff two documents.

**Corrected:**
- v0 assumed 6 words per act. Node weights delivered ~4. Act budgets recalculated (§3, §10).
- Refund stacking was unbounded. Now floored (§2.4).
- Pre-guess information reveals were uncapped. Now capped at 2 (§6.3).

**Resolved contradictions:**
- The Auditor had two incompatible rules across design files. Ruled (§11).
- Rangefinder's rule changed but the tile spec didn't follow. Ruled (§11).
- The Moth could render a word unsolvable. Ruled (§11).
- The Guillotine's failure penalty was ambiguous. Ruled (§11).
- Mirror/Twins scoring was flagged blocked. Ruled (§7.2). **No longer blocked.**

**Adopted from the design pass:**
- Prototype relic names are canonical. They are better than v0's and they are already rendered.
- Consumables are now a formal item class (§6.5).
- Rangefinder's identity-withholding redesign is adopted — it fixes the v0 overpower flag.
- Relic codes (`RL.xx`, `CN.xx`) are canonical and **opaque**. They do not sort by archetype and are not sequential. Treat them as string primary keys.

---

## 2. The guess pool

### 2.1 Core rules

- One pool per **act**. Not per word.
- Every submitted guess decrements the pool by 1 before feedback resolves.
- Solving does not refund by default.
- The pool refills at act start. It does not carry between acts (exception: `RL.27` The Vault).
- Leftover guesses convert to gold at act end, base rate **10g each**.
- Pool reaches 0 with the current word unsolved → offer emergency purchase (§2.3). If unaffordable or declined → **run ends**.

### 2.2 Act budgets (provisional — see §10)

| Act | Pool | Solve nodes | Boss | Word-equivalents | Guesses/word |
|---|---|---|---|---|---|
| I | 22 | 4 | Cipher (1 word, deferred) | 5 | 4.40 |
| II | 19 | 4 | Twins (2 words) | 6 | 3.17 |
| III | 17 | 4 (long) | Gauntlet (own pool) | 4 | 4.25 |

The boss order changed in v1.1 (R-019) and the word-equivalents column moved
with it. **These budgets have not been re-derived since.** Simulation puts the
win rate at 51% against the 25–35% target, so §2.2 is still the open question
(ticket B-02) — the boss move fixed where players die, not how often.

Act III's higher per-word figure is correct: those are 6- and 7-letter words, which cost more even with a good build. The Gauntlet runs on a **fixed, separate pool of 14** and does not draw from the act pool.

Baseline human performance is ~3.9 guesses/word on clean 5-letter words, ~3.5 for strong solvers, ~4.6 on 7-letter words. Every budget above sits below the relevant baseline. **A player with no relics should die in Act II.** This is the design intent and the primary thing simulation must confirm.

### 2.3 Emergency guesses

Cost escalates within an act and resets each act:

| Purchase | Cost |
|---|---|
| 1st | 25g |
| 2nd | 50g |
| 3rd | 100g |
| 4th+ | Unavailable |

The offer is mandatory, not optional UI: the player must always see the out they did or did not buy. `RL.25` Insurance makes the first purchase each act free.

### 2.4 The refund floor — normative

Several relics reduce guess cost. Without a floor they compose to zero or negative, which removes the game's only resource.

**Rule A — Minimum spend.** A word costs a minimum of **1 guess**, net of all refunds. If refunds would bring net cost below 1, they are truncated. Applies per word, not per guess.

**Rule B — Highest refund only.** When multiple refund effects trigger on the same event, **only the largest applies.** They do not sum. A Gambler holding Flywheel who solves in 3 gets 2 (the innate), not 3.

**Rule C — Free-guess effects are refunds.** `RL.13` Opening Gambit's free first guess is implemented as a refund, not as a skipped decrement, so it falls under Rules A and B. The pool must visibly tick down and back up; this is both a balance requirement and a legibility one.

These three rules together cap the theoretical maximum at one word per guess and make unbounded loops structurally impossible. Implement them in the pool reducer, not in individual relics.

---

### 2.5 The reveal ladder — normative

Gold buys information. At any point in a word **after the first guess**, the player may name an unrevealed position and pay to have its solution letter filled in as a locked tile.

Cost escalates within the word and resets each word:

| Reveal | Cost |
|---|---|
| 1st | 20g |
| 2nd | 55g |
| 3rd | 130g |
| 4th+ | Unavailable |

This is the second of the game's two ladders, and the pair is the economy. §2.3 converts gold into **pool**; §2.5 converts gold into **information**. Leftover guesses convert into gold at the act end. That closes the loop: a guess saved on an easy word is a reveal bought on a hard one, and every guess therefore has a price the player can name.

Six rules, all of which live in the engine:

- **Rule A — gated behind one guess.** The ladder is unavailable before the first guess of a word. Without this it is an opening tax rather than an out, and three bought reveals before guessing is exactly the pre-guess stack §6.3 exists to prevent.
- **Rule B — never the last unknown.** If buying would leave every position known, the ladder is unavailable. Reveals bought and tiles preset by relics count together, so Rosetta plus two purchases cannot finish a five-letter word. Paying to win is not a decision.
- **Rule C — unaffordable is refused, not consumed.** The price does not step up on an attempt that could not be paid. Same principle as R-015.
- **Rule D — a bought reveal is truthful.** It is not corrupted by Liar Letter and not subject to Decay. Certainty is the product being sold; a paid reveal that might lie is just a worse guess. This is deliberate counterplay against Liar Letter.
- **Rule E — a revealed letter is never locked out.** The letter is fixed at that position, not removed from the alphabet: it may occur elsewhere in the word. Locking it would violate R-014.
- **Rule F — reveals are not pre-guess reveals.** They resolve during a word, so §6.3's cap of 2 does not apply, by the same reasoning that exempts Rangefinder, The Auditor and The Lantern. The escalating price is the cap.

---

## 3. Run structure

Three acts. Each act: **6 map nodes, then a boss.**

### 3.1 Node generation — normative constraints

Node types are drawn against weights, then corrected against hard constraints. **Constraints win.** v0 left this to weights alone, which is what broke the budget math.

Per act, guaranteed:
- Exactly **4** solve nodes (word or elite) on every legal path
- At least **1** shop
- At least **1** forge or event
- No two shops adjacent
- The node immediately before the boss is never an elite
- Act I contains at most 1 elite; Act II at most 2; Act III at most 3

Weights fill the remaining freedom:

| Node | Weight |
|---|---|
| Word | 55% |
| Elite | 15% |
| Shop | 12% |
| Forge | 10% |
| Event | 8% |

The map is a branching DAG. The player sees the whole act at act start and chooses a path.

### 3.2 Run totals

4 solve nodes × 3 acts = 12, plus bosses (2 + 1 + 5) = **20 words per complete run.**

Copy must say twenty. The title screen currently says eighteen and the victory screen says twenty-one; both are wrong.

### 3.3 Node rewards

| Node | Reward |
|---|---|
| Word | **Choose one:** a relic from 3 offered, **or** 40g |
| Elite | 40g **and** a relic from 3, weighted uncommon/rare |
| Boss | 60g **and** a guaranteed boss relic |

The word node's two rewards are one choice, not two grants (R-025). The three relics stay on screen when the gold is taken: you should see what you are refusing.

This is where gold comes from in any quantity, so it is also what funds the shop, the forge and both ladders. A run that takes the relic every time is a run that cannot buy anything — which is the intended shape of the decision, and the reason the acquisition curve is now a balance number rather than a constant (§10.1).

---

## 4. Feedback engine

### 4.1 Structure

Feedback is a **pipeline**, not a function. Almost every relic and modifier works by mutating it.

```
guess + solution(s)
  → base scorer
  → FeedbackResult
  → ordered transform chain
  → final FeedbackResult
  → emitted on onFeedbackTransform
```

The view renders the emitted result **verbatim** and never re-scores. Keyboard letter states derive from the same payload. If the view scores anything itself, Liar Letter breaks.

### 4.2 FeedbackResult

```ts
type TileState = 'GREEN' | 'YELLOW' | 'GREY' | 'UNKNOWN' | 'HIDDEN';

interface Tile {
  letter: string | null;    // null when identity is withheld (Rangefinder)
  state: TileState;
  distance: number | null;  // Rangefinder only
  trustworthy: boolean;     // false → renders with the corruption texture
}

interface FeedbackResult {
  tiles: Tile[];
  meta: {
    vowelCount: number | null;
    hasRepeat: boolean | null;
    revealedLetters: Array<{ index: number; letter: string }>;
    deferred: boolean;
  };
}
```

`letter: null` is load-bearing. Rangefinder withholds identity, so the tile must be able to carry a state without a character. The design's CMP.02 currently renders a glyph in the rangefinder state; that is a design bug, filed in §11.

### 4.3 Base scorer

Standard two-pass: greens first, then yellows against remaining solution letter counts.

**The prototype's `score()` in `Rougle.dc.html` is correct.** It was fuzzed against an independent reference across 200,000 randomized cases with a reduced alphabet to force duplicate collisions, with zero mismatches. Port it directly rather than rewriting. Keep the test suite.

### 4.4 Transform order — normative

Order is fixed and declared. Different orders produce genuinely different games; this one is chosen deliberately.

| # | Transform | Source | Effect |
|---|---|---|---|
| 1 | Truth-roll | `RL.28` Shaved Coin | Re-rolls which positions report truthfully |
| 2 | Corruption | Liar Letter modifier | Flips one position's state; sets `trustworthy: false` |
| 3 | Distance | `RL.04` Rangefinder | On YELLOW tiles: computes distance, sets `letter: null` |
| 4 | Injection | Rosetta, Hot Streak, Skeleton Key | Applies pre-set greens |
| 5 | Deferral | Fog modifier, Cipher boss | Sets `deferred: true`; withholds presentation |
| 6 | Derivation | `RL.02` The Sieve | Derives keyboard locks from GREY tiles |

**Rationale for 1→2→3:** corruption runs *before* interpretation, so Rangefinder reads distance off the *reported* state, not the true one. A corrupted tile therefore yields a plausible lie rather than a visible contradiction. For a tile where `trustworthy === false`, Rangefinder emits a random distance drawn from the set of values that would be legal for the reported state. This is the whole point of the ordering — get it backwards and the two relics visibly contradict each other, which reads as a bug.

Deferral is last because it gates presentation, not content. The full result is computed and stored; it is simply not shown yet.

### 4.5 Word-start effects

Reveals from Rosetta, Hot Streak and Skeleton Key are applied at `onWordStart`, before any guess. The grid must therefore accept pre-set tiles at mount, not only after a guess resolves.

---

## 5. Modifiers

Modifiers attach to words. They are the entire difficulty curve.

**Difficulty comes from modifiers, never from rarer vocabulary.** Obscure words punish vocabulary knowledge rather than play skill, and in a run-based game a vocabulary loss at node 14 reads as theft. This constraint is not negotiable and it constrains §8.

| Modifier | Act | Effect |
|---|---|---|
| Locked Key | I+ | One random letter unusable this word. **Never a solution letter.** |
| Silent Start | I+ | First guess returns GREY only; no yellows |
| Long Word | II+ | 6 letters |
| Decay | II+ | GREEN reverts to UNKNOWN after one turn |
| Fog | II+ | Feedback for guess *n* shows only after guess *n+1* is submitted |
| Mirror | III | Two solutions, one pool (§7.2). Act III only since v1.1 — see R-019 |
| Liar Letter | III | One position reports false for the whole word; position fixed at word start |
| Longer Word | III | 7 letters |
| Stacked | III | Elites roll 2 modifiers |

Modifiers compose. `Long Word + Liar Letter + Decay` is legal, brutal, and survivable with the right build.

**Stacking exclusions:** Fog and Cipher cannot co-occur (double deferral is unreadable). Silent Start and Fog cannot co-occur.

---

## 6. Relics

Full registry in `relics.json`. That file is normative for names, codes, rarity, archetype, hook and rule text. This section covers only the system rules around it.

### 6.1 Hooks

Every relic must be implementable as a listener on the event bus. If a relic cannot name a hook, the hook list is incomplete — extend it rather than special-casing the relic.

```
onRunStart  onActStart  onNodeEnter  onWordStart  onGuessSubmit
onFeedbackTransform  onWordSolved  onWordFailed  onActEnd
onGoldChange  onPoolChange  onUse
```

`onUse` covers **player activations**, not just consumables. A relic the player
*fires* — rather than one that reacts to an event — declares `hook: "onUse"` and
an `activation` block in `relics.json` giving its timing window, uses per word,
cost and required input. See §6.6 and R-013.

### 6.2 Rarity

`COMMON` · `UNCOMMON` · `RARE` · `BOSS` · `CONSUMABLE`

Consumables are not relics, do not occupy relic slots, and are consumed on use. The design's rarity treatment currently has no branch for them (§11).

### 6.3 Information cap — normative

Independent pre-guess reveals compound superlinearly, because each constrains a different dimension of the search space. Rosetta (fixes a position) + Palimpsest (confirms membership) + Lexicon (vowel count) reduces a ~1500-word list to roughly 20–40 candidates before the first guess.

**Rule: at most 2 pre-guess reveal effects may be active on any word.** Excess effects are suppressed in acquisition order (earliest acquired wins) and their relic chips render dimmed with a suppression tooltip.

Affected: Lexicon, Palimpsest, The Concordance, Rosetta Slab, Hot Streak's free green, Skeleton Key.

Not affected: Rangefinder, The Auditor, The Lantern — these resolve during a word, not before it. The §2.5 reveal ladder is exempt for the same reason (Rule F), and is additionally gated behind the first guess so it cannot be stacked before one.

### 6.4 Shop weighting

Offer pools bias toward archetypes the player already holds, with a floor so pivoting stays possible.

```
P(archetype) = 0.25 + 0.75 × (held_in_archetype / total_held)
```

normalised across archetypes. The 0.25 floor guarantees every archetype stays reachable. Without weighting, players accumulate anti-synergistic piles — Tin Cup rewards slow play and Flywheel rewards fast play, and offering both at random produces a build that does nothing.

### 6.5 Consumables

Purchasable in shops, occasionally awarded by events. Inventory cap 3. Used from the relic drawer at any point where input is accepted.

---

### 6.6 Activations — normative

Five entries are things the player does at a moment of their choosing. They are
not a separate system: they are `onUse`, with a declared block that the engine
reads.

```
activation: { timing, usesPerWord, cost, input }
```

| Field | Values |
|---|---|
| `timing` | `ANY_TIME_IN_WORD` · `BEFORE_FIRST_GUESS` · `BEFORE_SUBMIT` |
| `usesPerWord` | integer, or `null` when the cost is the cap |
| `cost` | `{ gold }` and/or `{ guesses }`, both optional |
| `input` | `UNTRIED_LETTER` · `WAGER` · `null` |

Three rules the engine enforces, so no relic has to:

1. **The engine charges the cost**, from the block. A relic never debits gold or
   pool for its own activation.
2. **An unaffordable activation is refused, not consumed.** The Auditor's "if
   you cannot pay, he does not answer" is this rule, and it means a failed
   attempt does not burn the once-per-word cap.
3. **A guess cost may never empty the pool.** Dying to an optional action is
   what the emergency ladder (§2.3) exists to prevent.

Activations are used from the relic drawer, at any point where input is
accepted — the same affordance as consumables (§6.5).

### 6.7 Forge upgrades

Every relic carries **exactly one** upgrade tier, `MK.II`, defined in `relics.json` under `upgrade`. One tier is enough to make routing to a Forge a decision, and two would need a second art state per relic.

**Consumables are not upgradeable.** They are spent on use, so an upgrade tier would have nowhere to live.

#### Forge operation

A Forge node grants **one** operation, chosen by the player:

- **A · Upgrade a held relic** — free. Applies `MK.II` permanently for the run.
- **B · Convert gold to guesses** — 20g each, any quantity affordable.

`RL.09` The Anvil grants two operations instead of one. Both may be upgrades, both conversions, or one of each.

#### Upgrade constraints — normative

An upgrade **never** changes a relic's `hook`, `archetype`, `rarity` or `code`. It changes only the rule. The card is the same object with an `MK.II` badge, so no relic needs a second art state.

Every upgrade sits on one of five axes, recorded in `upgrade.axis`:

| Axis | What it changes | Example |
|---|---|---|
| `magnitude` | A number goes up | Tin Cup: 5g → 8g a guess |
| `duration` | Scope extends in time | Sieve: word → act |
| `reach` | Applies in more situations | The Mask: also immune to Fog |
| `reliability` | Variance drops | Wishbone: 1-in-2 → 2-in-3 |
| `cost` | A drawback shrinks or disappears | The Auditor: he stamps free |

Three hard rules:

1. **No upgrade may introduce a `pre_guess_reveal` where the base relic has none.** Doing so would let the Forge push a player over the §6.3 cap of two, which they could not have anticipated when they routed to the node.
2. **Refund magnitude upgrades are capped by the §2.4 floor.** Flywheel MK.II refunding 2 puts a 3-guess solve exactly on the floor of 1 net. A third would be dead value, and printing dead value on a card is worse than printing a smaller number.
3. **Boss relics upgrade by shrinking their drawback, never by raising raw magnitude.** Where a boss relic has no drawback, upgrade on `reach`. Rosetta MK.II cuts the act pool by 1 instead of 3; Polyglot MK.II extends to Mirror and boss words.

An upgrade to a relic that declares an `activation` (§6.6) changes the block, not the handler — The Auditor MK.II is `cost.gold: 0`, Shaved Coin MK.II is `usesPerWord: 2`. The engine still owns timing, cap and cost.

#### Distribution

Across 31 relics: `magnitude` is the plurality because it is the easiest axis to read on a card mid-run. If playtesting shows Forge choices feel samey, convert magnitude upgrades to `reliability` before adding a second tier — variance reduction is the harder read but the more interesting decision.

---

### 6.8 Events

Content in `events.json`. Twelve events, `EV.01`–`EV.12`.

#### Draw rules — normative

- Events draw **without replacement within a run.** An event seen once cannot recur.
- `acts` gates eligibility. `EV.09` The Liar's Bargain is Act III only; five others are Act II+.
- `requires` gates an individual **option**, not the event. An option whose requirement is unmet renders disabled with the requirement stated, never hidden. The player should see the door they cannot afford.
- Events draw from the run seed's event stream (§9).

At an 8% node weight across 18 nodes, plus the §3.1 guarantee of at least one forge-or-event per act, a run sees roughly 2–5 events. Twelve gives variety across runs rather than within one, which is the correct target.

#### Content rules — normative

**Every event offers 2–3 options, and at least one is non-destructive.** Non-destructive does not mean free: `EV.06` The Glutton charges 40g to refuse, and that is the point of that event.

**An event never hides its odds.** The `stake` line states the full consequence of an option including the failure branch. Events are decisions under stated risk, not under concealed risk. Corrupted or withheld information is what modifiers and relics are for; an event that lies breaks the contract that makes the other systems readable.

**Events trade between the four currencies** — guesses, gold, relics, information. An event that only moves gold is a shop with worse copy.

#### The effect vocabulary

`events.json` defines a closed vocabulary in `effect_vocabulary`. Prose is display copy and carries no mechanical meaning; the `effect` array is normative.

Two entries need engine work beyond a state delta:

- `word_challenge` — a constraint attached to the *next* word, resolved on solve or fail. Needs a pending-challenge slot on run state that survives the map screen between the event and the word.
- `flag_set { act_revival_available }` — `EV.08` The Undertaker grants a one-shot revival at pool zero, distinct from `RL.30` Ouroboros. It restores 6 guesses and continues the act rather than restarting it. It must resolve **after** the emergency-purchase offer (§2.3), so a player who can pay gold still pays gold first and keeps the revival.

#### Balance note

`EV.09` The Liar's Bargain hands a boss relic for a whole-act Liar Letter. That is deliberately the largest single swing in the event pool, and it is deliberately Act III only, where a player either holds `RL.29` The Mask and takes it for free or does not and pays properly for it. Watch its take-rate and post-take win-rate in simulation. If Mask-holders take it above 90% of the time and win above 60%, gate it behind not holding Mask, or drop the reward to RARE.

---

## 7. Bosses

### 7.1 Act I — The Cipher

No feedback until three guesses are committed; all three then resolve at once. No corruption — just blind. Forces the player to plan an information tree rather than react.

Deferral uses the same mechanism as Fog (transform step 5), with depth 3 instead of 1.

It opens the run because its cost is nearly fixed — commit three guesses, read
three rows — so it teaches the pool's arithmetic rather than gambling with it
(R-019).

### 7.2 Act II — The Twins

Two solutions. One pool. Each guess is scored against both.

**Ruling on shared letters (resolves the blocked v0 Q5):** each guess produces **two fully independent `FeedbackResult` objects**, one per solution, rendered as two rows. No merging, no reconciliation, no precedence rule. A letter that is green in solution A and absent in solution B renders green in row A and grey in row B.

This is the simplest rule that is also the most informative, and it is the only one that composes cleanly with the transform pipeline: each result runs the chain independently. The design already renders two rows per guess, so no design change is needed.

Keyboard letter state under Mirror shows the **best** state across both solutions, since the keyboard is a memory aid rather than a claim about a specific word.

Solving one solution locks its row and continues the other. Both must be solved to clear.

### 7.3 Act III — The Gauntlet

Five words. **Fixed separate pool of 14.** No shop, forge or reward between them. Pure attrition against the assembled build.

The act pool is untouched by the Gauntlet in either direction — it neither draws from it nor converts into it.

---

## 8. Word lists

Two lists:

- **`solutions`** — curated, target ~1500 five-letter entries, plus ~800 six-letter and ~500 seven-letter.
- **`valid_guesses`** — large (~13,000 five-letter), gates input, never appears as an answer.

### 8.1 Curation — required preprocessing

**Ambiguity clusters must be excluded from `solutions`.** Families like `WATCH / BATCH / CATCH / MATCH / HATCH / LATCH` and the `-IGHT` set create positions where correct play still loses. Acceptable in a daily puzzle; run-ending in a roguelike.

Write a preprocessing script that:
1. Identifies clusters where ≥4 candidates share ≥4 positions
2. Removes all members from `solutions` (they remain legal guesses)
3. Emits a report of what was removed, for review

**Frequency banding:** solutions must fall in the top ~8000 words by corpus frequency. No archaic or specialist vocabulary. This is a hard constraint arising from §5 — if difficulty comes from modifiers, the vocabulary must stay easy.

Six- and seven-letter lists need the same treatment and are harder to source cleanly. Budget time.

---

## 9. Determinism

**Seeded RNG throughout.** One run seed determines map layout, word selection, relic offers, modifier placement, Liar Letter position, and every in-word roll. Same seed plus same inputs produces an identical run.

Required for bug reproduction, run sharing, and any future daily mode. The seed is stamped into the chrome at run start and held unchanged through death or victory.

Use a named, separate RNG stream per subsystem (map, words, offers, corruption) so that adding a roll to one subsystem does not shift every downstream sequence and invalidate existing seeds.

---

## 10. Balance targets and the simulation gate

### 10.1 Headless harness — required

The rules engine must run without UI. **Every number in §2.2 is provisional until simulation confirms it.** They are derived estimates, not measurements.

The harness reports:
- Win rate by character
- Death-node distribution
- Average guesses per word, by act and by word length
- Relic pick rates and co-occurrence
- Gold curves and emergency-purchase frequency
- **Death cause attribution** — decision quality vs. word-list luck

### 10.2 The solver offset

A simple entropy-maximising solver (fixed optimal opener, then filter candidates and pick by expected information) is sufficient as the simulated player. It plays better than a human — roughly 3.4 guesses/word against a human 3.9.

**Tune to the human baseline, not the bot's.** Apply the offset explicitly rather than tuning until the bot's win rate looks right.

### 10.3 Targets

| Metric | Target |
|---|---|
| Win rate, competent human, tuned build | 25–35% |
| Win rate, no relics taken | <5% |
| Deaths attributable to word-list luck | <5% of all deaths |
| Median run length | 20–30 min |
| Act I death rate | <15% |

If word-list-luck deaths exceed 5%, §8 curation was not aggressive enough. Fix the list, not the budget.

---

## 11. Rulings log

Every contradiction found across v0, the prototype and the component sheet, and how it was resolved.

**R-001 · The Auditor.** Component sheet said "after guess 2, name one untried letter." Prototype said "name any untried letter, 5g a stamp," with no timing gate and no use cap.
→ **Ruled:** once per word, any time, costs 5g. The gold cost creates a decision each use; the once-per-word cap prevents a player with 400g banked from buying certainty. Timing gate dropped. `relics.json` is authoritative.

**R-002 · Rangefinder.** Prototype redesigned it to withhold letter identity in exchange for distance. Component sheet CMP.02 still renders a character in the rangefinder tile state.
→ **Ruled:** the prototype rule stands; it fixes v0's overpower flag by making the relic a genuine trade. `Tile.letter` must accept `null`. **Design bug filed against CMP.02** — the rangefinder specimen must render distance with no glyph.

**R-003 · The Moth.** As written, it could eat a letter present in the solution, making the word untypable and the run unwinnable with no counterplay.
→ **Ruled:** The Moth never eats a letter present in the current solution. Same rule applies to the Locked Key modifier and to Guillotine's penalty. Implement once, as a shared `eligibleLettersForRemoval(solution)` helper, and unit-test it.

**R-004 · The Guillotine.** Penalty "takes 20g and one letter off your keyboard" — duration unspecified.
→ **Ruled:** keyboard clause dropped entirely. Penalty is −20g. A punish clause with two unrelated effects is noise, and the keyboard effect duplicates The Moth. Rarity confirmed as UNCOMMON per the prototype, down from v0's RARE.

**R-005 · Mirror / Twins scoring.** Flagged blocked in the design.
→ **Ruled:** two independent results, two rows, no merging (§7.2). **Unblocked.** The Twins screen can be finalised.

**R-006 · Refund stacking.** v0 allowed unbounded composition to zero or negative cost.
→ **Ruled:** §2.4 Rules A, B and C.

**R-007 · Information stacking.** v0 allowed unlimited pre-guess reveals.
→ **Ruled:** §6.3, cap of 2.

**R-008 · Words per act.** v0's budget table assumed 6 words per act; node weights delivered ~4.
→ **Ruled:** §3.1 hard constraint of exactly 4 solve nodes per path; budgets recalculated in §2.2.

**R-009 · Run word count.** Title screen says eighteen, victory screen says twenty-one.
→ **Ruled:** twenty (§3.2). Both screens are copy bugs.

**R-010 · Consumables.** Introduced by the prototype as a class; `relicSkin()` has no branch for `CONSUMABLE` and it falls through to common styling. The component sheet's rarity spec omits the class.
→ **Ruled:** formalised in §6.2 and §6.5. **Design bug filed** — consumables need their own rarity treatment.

**R-011 · Relic codes.** Non-contiguous and not archetype-ordered.
→ **Ruled:** codes are opaque string keys and carry no ordering. Existing prototype codes preserved exactly, because they are already rendered in the design. New relics fill gaps arbitrarily. Sort by `archetype` and `rarity` fields, never by code.

**R-012 · Death screen demo data.** Shows `CAUSE: POOL EXHAUSTED` alongside `GOLD UNSPENT: 145g`, which would have covered all three emergency purchases.
→ **Design bug filed.** Not a rules issue, but it indicates the emergency-purchase branch was not exercised. Confirm it is wired before that screen is signed off.

**R-013 · Stale handoff bundle.** Root `Rougle.dc.html` is a newer revision than the copy inside `design_handoff_rougle/` — different character-select treatment, different default accent.
→ **Design action:** regenerate the bundle before the developer begins. Not a rules issue.

**R-014 · No mechanic may render a solution untypable.** R-003 covers The Moth, the Locked Key modifier and the Guillotine, because each *draws* a letter and can be told not to draw a solution letter. `RL.02` The Sieve does not draw — it derives locks from feedback — so R-003 did not reach it, and three mechanics can make a solution letter *read* grey: Liar Letter corrupting a tile, Silent Start reporting GREY in place of YELLOW, and Decay reverting a GREEN whose letter is also grey elsewhere in the row. Each hard-locks a letter the answer needs, with no counterplay. All three were reproduced by the harness; the third produced a run with no legal guess at all.
→ **Ruled:** generalised from R-003. **No mechanic may remove a letter the current solution needs, by any route.** A lock derived from feedback must rest on an honest, uncorrupted, unsuppressed observation. New mechanics inherit this rather than each needing its own patch. Raised as technical brief §13 I-18.

**R-015 · Player-activated relics.** `RL.07`, `RL.20`, `RL.21`, `RL.28` and `CH.03` all describe something the player chooses to do, but each was assigned a reactive hook it does not fit — the Auditor "at any time" on `onGuessSubmit`, All In's wager on `onWordStart`. `onUse` had the right shape and was scoped to consumables.
→ **Ruled:** `onUse` is open to relics that declare an `activation` block (§6.6). The engine owns timing, the use cap and the cost; the relic owns only what happens. Raised as technical brief §13 I-04.

**R-016 · `RL.28` Shaved Coin outside Act III.** It re-rolls which positions report truthfully. Nothing reports untruthfully unless the Liar Letter modifier is active, and that is Act III only, so a RARE relic offered in Acts I–II does nothing at all.
→ **Ruled:** withheld from the offer pool until Act III (`offer_from_act: 3`) rather than given a second clause. A relic that does nothing is a worse reward than a relic you were not offered, and a second clause would change what the relic is. Raised as technical brief §13 I-05.

**R-017 · `RL.20` Blindfold's "within one letter".** Undefined — Hamming distance 1, or substitutions and transpositions both?
→ **Ruled:** Hamming distance ≤ 1. The guess and the solution are always the same length, so at most one position may differ. Transpositions do not count: "within one letter" reads as one letter wrong, and a transposition-inclusive reading would make the relic materially stronger than the phrase promises. Raised as technical brief §13 I-06.

**R-019 · The Twins is the Act II boss; Mirror is Act III.** Measured, not argued. As the Act I boss the Twins ended **20.5% of all runs** — half of every death in the game, against 4.3% for the next worst node. Not because Mirror is broken: two solutions cost 5.20 guesses against the ~7.8 two independent words would cost, exactly as technical brief §13 I-10 predicted. The problem is variance landing on a hard wall at the end of the shortest act, with the fewest relics to absorb it. Raising Act I's pool to 28 left the rate at 21.5%, so it was never a budget problem.
→ **Ruled:** the Cipher opens the run and the Twins becomes the Act II boss; the Mirror modifier moves from Act II+ to Act III only. Act I deaths fall from 20.8% to 3.9%, inside the §10.3 target for the first time. **The spike relocated rather than dissolved** — the Twins now ends 37.8% of runs in Act II — but a death there is a fair one: the player has a built deck, has learned the economy, and chose to walk into it. Giving the Twins its own fixed pool was measured and rejected: the Gauntlet pattern removes the emergency ladder with it, and 74.8% died there.

**R-020 · Gold is inert, and that is why the pool is not tense.** Raised from playtest: *"it becomes very annoying if I get stuck"*, and separately that the tension reads as strange everywhere except that moment. Measured over 1000 runs, both halves are one fault. Mean gold earned per run is **759**; mean gold spent is **89**. **88% of every coin the game pays out is never spent.** At the moment of death a player holds a mean of **206g**, and **99.1% of deaths happen with at least 25g in pocket** — 80.6% with at least 100g. The mechanism is that §2.3 is the only sink and it caps at three purchases per act: once the ladder is exhausted `emergencyCost` returns null, the offer is never made, and the run ends with the gold still there. 420 of 427 deaths are that exact shape, which is R-012's mockup anomaly reproduced at scale.

So being stuck is not a shortage of resources. It is holding a resource with nothing to exchange it for — frustration, not tension. And the general strangeness is the same fact seen from the other side: an economy where one currency starves while a parallel one drowns does not read as pressure, because the player can feel that spending decisions are not connected to anything.

→ **Ruled:** §2.5, the reveal ladder. Gold buys information at an escalating price, gated behind the first guess and incapable of finishing a word (Rules A and B). This is not primarily an out for stuck players — it is what gives a guess a price. Once gold buys information and leftover guesses buy gold, spending a fourth guess on word seven has a nameable cost in reveals foregone on word twelve, which is the mechanism the design bet on and never had. GREED was the thinnest archetype (4 relics) for the same underlying reason, so `RL.08` and `RL.17` are built on the new ladder, one leaning into it and one rewarding abstention, per R-011's provision for filling code gaps.

**This raises the win rate, and B-02 is already the wrong side of its target.** Adding an out cannot do otherwise. The ruling is that the sink is correct on its own merits and the rate is a separate axis: gold income (`goldPerLeftoverGuess`) and the price ladder are now both live tuning levers, where before income had nothing to tune against. Measured in §10.3.

**R-018 · The refund floor and word-start refunds.** §2.4 Rule A applied at the moment a refund fires truncates any refund on guess 1 to nothing, because gross spend is 1 and the floor is 1. That makes `RL.13` Opening Gambit — whose entire rule is "your first guess of a word is refunded" — never refund, and `RL.19` The Moth eat a letter for free.
→ **Ruled:** Rule A binds the **word's total**, as §2.4 already says ("applies per word, not per guess"). A refund the floor cannot grant yet is carried and retried on later guesses of the same word, and dropped when the word ends. Rule B is unaffected: the losers of an event are discarded, never carried, so two relics still cannot stack across turns. Raised as technical brief §13 I-16.


---

**R-021 · Forge upgrade coverage.** The design showed per-relic upgrade text for three relics; `relics.json` had no field for it and the rest were undefined, which left the Forge a node with nothing to do.
→ **Ruled:** §6.7. Every relic carries exactly one `MK.II` tier, defined in `relics.json`. The design's three examples are preserved verbatim (Sieve, Flywheel, Tin Cup). Consumables are explicitly not upgradeable. An upgrade to a relic with an `activation` (§6.6) changes the declared block, never the handler.

**R-022 · Event content.** v0 mentioned events only in the node-weight table, and the design contained exactly one, `EV.01` The Wager. A node type with one piece of content is a node type that repeats within a single run.
→ **Ruled:** §6.8 and `events.json`. Twelve events. `EV.01` preserved verbatim including its three option labels and stake lines.

**R-023 · Relic count.** Referred to elsewhere as 31, taken from the highest code `RL.31`.
→ **Clarification, not a rule change:** count the array, never the codes. Codes are opaque and non-sequential per R-011. The count was 29 when this was raised; R-020 assigned `RL.08` and `RL.17`, so it is now **31 relics and 4 consumables**, and it will move again. Any tooling that derives a count or an index from a code is a bug — which is precisely why the number in prose keeps going stale and the registry test asserts the rule instead.

**R-024 · `poolMax` is the refill target, not a ceiling.** `addPool` clamped every positive delta to `poolMax`. Raised as §13 I-15 against `RL.27` The Vault, where it was noticed; found while building the §6.7 forge to be general. Six mechanics that GRANT guesses were silently doing nothing whenever the pool was full: the forge's gold conversion, `CN.03` The Decanter, `EV.05` The Infirmary, `RL.20` Blindfold's payout, `EV.08`'s revival, and the Vault's carry. Nothing errored — the guesses were simply absent, in exactly the situation you would most want them.
→ **Ruled:** the pool may sit above `poolMax`. The cap governs the **refill** at act start and nothing else, so a grant is a thing you carry rather than a new ceiling, and the meter reads 27/24. One rule with no exceptions, rather than a per-effect "may overflow" flag the next mechanic would forget to set. `RL.27`'s "Does not raise the act cap" is now literally true and no longer inert: the carry lands above the cap and the next refill returns to it. Closes §13 I-15.

**R-025 · Node rewards.** §3.3 granted word nodes both gold and a free relic. Four solve nodes an act plus three bosses is roughly **15 relics a run** on a game where relics are the entire power axis — and it left gold with almost nothing to buy that was not already arriving for free, which degraded the shop into somewhere to dump a surplus. It also quietly invalidated the balance work: the §2.4 refund floor and the §6.3 information cap were sized against a player holding six to eight relics, not most of an archetype.
→ **Ruled:** a word node offers a relic **or** 40g, exclusively. Elite and boss nodes grant both. The relic offer stays visible when the gold is taken. Relic count falls to roughly 8–12 a run depending on play, every coin held represents a relic refused, and the shop becomes the place you buy the specific thing your build needs rather than the random one-of-three you happened to roll. **Design change filed against S.05** — the secondary action becomes `TAKE 40g`, not `SKIP`, and the automatic gold line comes off. Relic count per run is added to the §10.1 harness output, because the acquisition curve is now a measurement rather than a constant.

**R-026 · Nothing may defer feedback over two solutions.** Raised from playtest — *"playing Mirror felt almost impossible since I had no feedback if some of my letters hit or not"* — with a screenshot of six submitted rows and not one scored tile. Two faults produced it. `FOG` and `MIRROR` were not a declared stacking exclusion, so an Act III word could withhold feedback for a turn across two answers. And both the boss lookup and the boss NAME read `BOSSES[state.actIndex]` rather than the node, so any drift between the act counter and the map grafted one boss's mechanic onto another's word — the screenshot shows the Act II Twins labelled `THE CIPHER`, running the Cipher's 3-turn deferral over a mirrored word.
→ **Ruled:** deferral and Mirror are mutually exclusive, enforced twice. `FOG`/`MIRROR` joins §5's exclusion table so the pair never rolls, and `startWord` zeroes `deferralDepth` whenever a word has more than one solution, so no other route — a boss, an event's `modifier_apply`, a future relic — can reassemble it. Two solutions win: a mirror is hard, a deferred mirror is unreadable. Every node now carries the act that generated it and the boss is read from the node, so the name and the mechanic cannot disagree again.

## 12. Still open

1. **Pool display elasticity.** `poolMax` is a prop, but CMP.01's visual logic is built around 24 discrete pips and §2.2 now proposes 22/19/17. Decide whether the pip row is fixed-24 with the number carrying overflow, or genuinely elastic. Blocking for CMP.01 sign-off.
2. **Long-word layout is undemonstrated.** No screen shows 6 or 7 tiles. Seven tiles at a 5px gap in a 430px column lands near 55px each, under the 62px cap, so it should hold — but nobody has looked at it, and Act III is entirely long words.
3. **Low-pool flicker duration.** `rg-flicker` loops indefinitely at pool ≤5. In Act III that could run for several minutes. Playtest for irritation, not for accessibility (reduced-motion already covers that).
4. **Meta-progression.** Deliberately out of scope. The victory screen reserves a strip for it.
5. **Elite reward scaling by act.** Currently flat 40g. May need to scale with Act III's stacked modifiers.

---

## 13. Build order

**Phase 1 — Rules core.** Feedback pipeline, ported scorer plus its test suite, pool reducer including §2.4, seeded RNG, headless harness. No UI beyond a debug view.

**Phase 2 — Single act, linear.** Four words, no branching, 5 relics, no shop. The question this phase answers: *is the shared pool actually tense?* If it is not, stop and fix that before building anything else.

**Phase 3 — Run structure.** Branching map with §3.1 constraints, three acts, node types, shop with §6.4 weighting, gold, emergency purchases.

**Phase 4 — Content.** Full registry, modifiers, bosses, events, characters.

**Phase 5 — Balance.** Simulation against §10.3, tuning, playtesting.
