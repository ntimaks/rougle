# Roguelike Wordle — Technical Design Brief

**Working title:** TBD
**Document status:** Design spec, pre-implementation
**Audience:** Engineer / technical agent building a prototype

---

## 1. One-paragraph pitch

A word-deduction roguelike. Instead of six guesses per word that reset daily, the player carries a *shared pool of guesses* across a run of 18–20 words. Solving efficiently banks resources; overspending on one word starves the next. Between words the player picks relics that change how information is revealed, and words themselves acquire modifiers that corrupt or delay feedback. A run lasts 20–30 minutes and ends in death or a final boss clear.

The design bet: **Wordle's failure state is boring because it's isolated. Make it cumulative and it becomes tense.**

---

## 2. Scope for v1

Build a playable single-player prototype. Explicitly out of scope for v1: accounts, cloud save, multiplayer, daily challenges, monetisation, mobile-native builds.

**Platform:** Web. Framework choice is the implementer's — but the requirement is that game logic be **fully decoupled from rendering**. The rules engine must be runnable headlessly in a test harness so balance can be simulated (see §13).

**Persistence:** localStorage or equivalent. Save mid-run state so a refresh doesn't kill a run.

---

## 3. Core loop

```
Start run → pick character
  ↓
ACT (×3)
  ├─ Guess pool refills to act budget
  ├─ Traverse 6 map nodes (player picks route)
  │    └─ At each node: resolve node type (word / elite / shop / forge / event)
  ├─ Boss node
  └─ Leftover guesses convert to gold
  ↓
Win (clear Act 3 boss) or Death (pool hits 0 with a word unsolved)
```

---

## 4. The guess economy — the spine of the design

This is the single most important system. Get it wrong and nothing else matters.

### Rules

- One pool per **act**, not per word.
- Every guess submitted decrements the pool by 1, whether or not it's correct.
- Solving a word does not refund anything by default.
- Pool refills at the start of each act. It does **not** carry over (except via the Vault relic).
- Leftover guesses at act end convert to gold at **10g each**.
- If the pool reaches 0 with the current word unsolved → **run ends**.

### Act budgets

| Act | Pool | Words | Guesses/word | Notes |
|-----|------|-------|--------------|-------|
| 1 | 24 | 6 + boss | 3.43 | Roughly break-even for a competent player |
| 2 | 22 | 6 + boss | 3.14 | Player should have 2–4 relics by now |
| 3 | 20 | 6 + boss | 2.86 | Only survivable with a functioning build |

Baseline human performance on unmodified 5-letter Wordle is ~3.9 guesses/word; strong solvers sit near 3.5. **The budgets are deliberately below baseline.** The gap is what relics are for. A player with no relics should die in Act 2. This must be verified by simulation before it's accepted as final.

### Emergency guesses

When the pool hits 0, offer a purchase instead of instant death. Cost escalates **per act**, resetting each act:

- 1st: 25g
- 2nd: 50g
- 3rd: 100g
- 4th+: unavailable

This makes gold a literal life resource and gives the shop real weight.

---

## 5. Feedback engine — the critical architecture decision

**Do not hardcode Wordle's feedback rules.** Almost every relic and modifier in this game works by mutating feedback. If feedback is a hardcoded function you will be rewriting it constantly.

### Required structure

Model feedback as a **pipeline of transforms**:

```
guess + solution
  → base scorer (standard green/yellow/grey, with correct duplicate-letter handling)
  → produces FeedbackResult
  → passes through ordered list of active transforms (from modifiers, then relics)
  → each transform receives FeedbackResult and returns a modified FeedbackResult
  → final result rendered
```

`FeedbackResult` should be richer than three colour states, because relics add channels:

```
FeedbackResult {
  tiles: [ { letter, state: GREEN|YELLOW|GREY|UNKNOWN|HIDDEN,
             distance: int|null,      // Rangefinder
             trustworthy: bool } ],   // Liar Letter
  meta: { vowelCount: int|null,       // Lexicon
          revealedLetters: [],
          deferred: bool }            // Fog / Cipher
}
```

Transforms must be **order-dependent and declared**. Liar Letter corrupting a tile, then Rangefinder reading distance off it, produces a different (and more interesting) result than the reverse. Pick an order, document it, make it deterministic.

### Duplicate letters

Implement the standard two-pass algorithm (greens first, then yellows against remaining letter counts). This is the most common source of bugs in Wordle clones. Write tests for it before anything else — `ALLOY` vs `LLAMA`, `SPEED` vs `ERASE`, etc.

---

## 6. Run structure and the map

- 3 acts, 6 nodes each plus a boss.
- Map is a **branching DAG**, Slay the Spire style. The player sees the full act map at act start and picks a path. Typically 2–3 choices at each step.
- Route choice must be meaningful: paths should differ in risk/reward, not just cosmetically.

### Node types and generation weights (Act 1 baseline, tune later)

| Node | Weight | Effect |
|------|--------|--------|
| Word | 55% | Standard solve. Reward: 15–25g + choice of 1 of 3 relics |
| Elite | 15% | Word with 1–2 modifiers. Reward: 40g + choice of 1 of 3 uncommon/rare relics |
| Shop | 12% | Buy relics, guess refills, letter reveals |
| Forge | 10% | Upgrade one relic, or convert gold → guesses at 20g each |
| Event | 8% | Scripted gamble (see §10) |

Constraints on generation: no two shops adjacent; at least one shop per act; the node immediately before the boss is never an elite.

---

## 7. Word modifiers

Modifiers attach to words (always on elites, sometimes on normal nodes in later acts). They are the difficulty curve. **Difficulty must come from modifiers, not from rarer vocabulary** — obscure words punish vocabulary knowledge rather than play skill, and feel like theft in a run-based game.

| Modifier | Act | Effect |
|----------|-----|--------|
| Locked Key | 1 | One random common letter is unusable this word |
| Silent Start | 1 | First guess returns greys only — no yellows |
| Long Word | 2 | 6 letters. Pool cost unchanged |
| Decay | 2 | Greens revert to unknown after one turn (the player must remember) |
| Fog | 2 | Feedback for guess *n* is shown only after guess *n+1* is submitted |
| Mirror | 2 | Two words solved simultaneously, one shared pool, each guess scored against both |
| Liar Letter | 3 | One position reports false feedback for the whole word. Position fixed at word start |
| Longer Word | 3 | 7 letters |
| Stacked | 3 | Elites roll 2 modifiers |

Modifiers must be composable. `Long Word + Liar Letter + Decay` should be a legal, brutal, survivable-with-the-right-build combination.

---

## 8. Relics

Relics need **hook points** in the engine. Define an event bus with at minimum:

`onRunStart`, `onActStart`, `onWordStart`, `onGuessSubmit`, `onFeedbackTransform`, `onWordSolved`, `onWordFailed`, `onActEnd`, `onGoldChange`, `onPoolChange`

Every relic below should be implementable as a listener on these hooks. If one isn't, the hook list is incomplete — extend it rather than special-casing the relic.

### Information archetype

| Relic | Rarity | Effect |
|-------|--------|--------|
| Lexicon | Common | First guess of each word also reports the solution's vowel count |
| Sieve | Common | Grey letters are hard-disabled on the keyboard for the rest of the word |
| Rangefinder | Rare* | Yellow tiles show how many positions away the letter is |
| The Auditor | Rare | After guess 2, the player names one untried letter and learns present/absent |
| Palimpsest | Rare | At word start, learn one letter shared with the previous solution (if any) |

\* Rangefinder is flagged as a balance risk — see §15.

### Speed archetype

| Relic | Rarity | Effect |
|-------|--------|--------|
| Momentum | Common | Solve in ≤3 → refund 1 guess |
| Hot Streak | Uncommon | 3 consecutive ≤3 solves → next word starts with one green revealed |
| Opening Gambit | Uncommon | First guess is free if it contains 4+ unique letters not yet used this word |
| Guillotine | Rare | Solve in 2 → +40g. Solve in 5+ → −20g |

### Gambler archetype

| Relic | Rarity | Effect |
|-------|--------|--------|
| Coin Flip | Common | 50% chance any given guess is refunded |
| Blindfold | Uncommon | Opt to take no feedback on a guess; if the guess was within one letter of correct, +3 guesses |
| Loaded Dice | Rare | Once per word, re-roll which positions report truthfully |
| All In | Rare | Before a word, wager N guesses. Solve within N → gain N. Fail → lose all N |

### Economy archetype

| Relic | Rarity | Effect |
|-------|--------|--------|
| Ledger | Common | Leftover guesses convert at 15g instead of 10g |
| Tithe | Uncommon | +5g every time a guess is spent |
| Insurance | Uncommon | First emergency guess each act is free |
| The Vault | Rare | Up to 10 leftover guesses carry into the next act instead of converting |

### Routing archetype

These change how the player navigates the map rather than how they solve. Currently the thinnest category and it needs expanding during implementation.

| Relic | Rarity | Effect |
|-------|--------|--------|
| Bloodhound | Uncommon | Elite nodes cost 2 fewer guesses but award no gold |
| Cartographer | Uncommon | See the modifiers on every node before choosing a path |
| Pilgrim | Rare | Skipping a shop grants 30g |

### Boss relics

One guaranteed drop per act boss. Always strong, always with a real cost.

| Relic | Effect |
|-------|--------|
| Rosetta | Every word starts with one green revealed. Act pool reduced by 3 |
| The Mask | Fully immune to Liar Letter |
| Ouroboros | On death, restart the current act with relics intact. Once per run |
| Polyglot | 6- and 7-letter words award double gold and upgraded relic rolls |

---

## 9. Bosses

- **Act 1 — The Twins.** Two solutions, one shared pool. Each guess is scored against both simultaneously and both results shown.
- **Act 2 — The Cipher.** No feedback until three guesses are committed, then all three resolve at once. Forces the player to plan an information tree rather than react.
- **Act 3 — The Gauntlet.** Five words, 14 guesses, no shop or reward between them. Pure attrition against the assembled build.

---

## 10. Events

Short scripted choices. Aim for ~10 in v1. Examples:

- **The Wager** — Solve the next word in 2 or lose a random relic. Success: +60g.
- **The Scholar** — Pay 40g to see the first letter of every remaining word this act.
- **The Fast** — Skip the next word entirely. Lose 4 guesses.
- **The Trade** — Destroy a relic, draw two rares, keep one.

---

## 11. Characters

Starting loadouts that imply build directions. Three at launch.

| Character | Pool modifier | Innate |
|-----------|---------------|--------|
| The Linguist | +2 per act | Sees vowel count on every word |
| The Gambler | −6 per act | Solving in ≤3 refunds 2 guesses |
| The Cryptographer | −4 per act | May spend a guess to reveal one letter outright |

---

## 12. Word list requirements

This is a content problem that will sink the game if handled carelessly.

- **Two lists:** a `solutions` list (curated, ~1500 words) and a much larger `valid_guesses` list (~13,000) that gates input but never appears as an answer.
- **Curate out ambiguity clusters.** Words like `WATCH/BATCH/CATCH/MATCH/HATCH/LATCH` and the `-IGHT` family create positions where correct play still loses. In a 20-second daily puzzle that's an annoyance; at node 14 of a run it destroys the game. Build a preprocessing script that identifies clusters where ≥4 candidates share 4 positions, and exclude those from `solutions` (they remain legal guesses).
- **Frequency-band the list.** Solutions should sit in the top ~8000 words by corpus frequency. No archaic or specialist vocabulary.
- 6- and 7-letter lists need the same treatment and are harder to source cleanly. Budget time for this.

---

## 13. Determinism and simulation

Two non-negotiable requirements:

1. **Seeded RNG throughout.** A run seed determines map layout, word selection, relic offers, and any in-word randomness. Same seed + same inputs = identical run. Needed for bug reproduction, for sharing runs, and for daily-challenge mode later.

2. **Headless simulation harness.** The rules engine must run without UI so an automated solver can play thousands of runs. This is the only realistic way to balance the guess economy. The harness should report: win rate by character, death-node distribution, average guesses per word by act, relic pick rates, gold curves.

A simple entropy-maximising solver (Wordle-optimal opener, then filter candidates and pick by expected information) is sufficient as the simulated player. It'll play better than a human, which means human-facing numbers will need to be more generous than what simulation suggests — account for that offset rather than tuning to the bot.

---

## 14. UI requirements

Minimal but non-negotiable:

- Guess pool prominently and persistently visible. It's the health bar. It should read as tense when low.
- Gold, relics, and active modifiers visible at all times without opening a menu.
- Relic tooltips on hover/tap, always.
- The map is a screen the player returns to between nodes, showing traversed and available paths.
- Distinct visual language for corrupted feedback (Liar Letter, Fog) so the player knows information is unreliable — the game should never feel buggy when it's being adversarial.

---

## 15. Known risks

**Rangefinder may be strictly too strong.** Distance-on-yellows collapses the candidate space so fast it could invalidate every other information relic. Mitigation: ship it as once-per-word, or move it to boss-relic rarity. Flag for simulation testing specifically.

**Shop offerings may be incoherent.** Tithe (reward slow play) and Momentum (reward fast play) are anti-synergistic by design, but if the shop offers them randomly the player gets piles of relics that don't interact. Implement **weighted offering**: bias the pool toward archetypes the player already has relics from, with a floor so pivoting stays possible.

**Skill ceiling may be low.** Once optimal openers are known, unmodified words have little depth. The modifiers must be where skill lives. If playtesting shows players treating modifiers as pure difficulty rather than as puzzles to route around, the modifier set needs redesigning, not rebalancing.

**Death by word-list luck.** Partly addressed by §12 curation, but monitor the simulation's death-cause distribution. If a meaningful share of deaths trace to unlucky solutions rather than bad decisions, curation wasn't aggressive enough.

---

## 16. Suggested build order

**Phase 1 — Rules core.** Feedback engine with the transform pipeline, duplicate-letter handling, full test coverage. Shared guess pool. No UI beyond a debug view. Headless harness working.

**Phase 2 — Single act.** Six words, linear (no branching), 5 relics, no shop. The question this phase answers: *is the shared pool actually tense?* If it isn't, stop and fix that before building anything else.

**Phase 3 — Run structure.** Branching map, three acts, node types, shop, gold, emergency guesses.

**Phase 4 — Content.** Full relic list, modifiers, bosses, events, characters.

**Phase 5 — Balance.** Simulation runs, tuning passes, playtesting.

---

## 17. Open questions for the implementer

1. Should the pool be visible as a number, a bar, or both? Affects how the pressure reads.
2. Should failing a word end the run immediately, or cost something severe and continue? Current spec says immediate death — worth prototyping the alternative.
3. Do relics have upgrade tiers, or is the Forge purely a gold sink?
4. Is there a run-persistent meta-progression (unlockable characters, relics added to the pool)? Not specified here; probably wanted for retention but adds significant scope.
5. How is the Mirror modifier scored when the two solutions share letters? Needs a decided rule before implementation.
