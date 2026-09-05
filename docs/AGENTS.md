# AGENTS.md

**Path:** `docs/AGENTS.md`. Most agent tooling auto-loads `AGENTS.md` from the repo *root* only — if this file is not also present or symlinked at root, agents will not read it unless a prompt points them here. See README.

Rules for anyone working in this repo, human or agent.

## 1. Authority

Four documents, no overlap. Know which one owns your question before you decide anything.

| Question | Authority |
|---|---|
| What does this relic do? What is it called? | `relics.json`, governed by `MECHANICS.md` |
| When does the pool decrement? What are the budgets? | `MECHANICS.md` |
| What does it look like? How does it animate? | `design/` (the handoff bundle) |
| How is it built? What file? What algorithm? | `docs/technical-brief.md` |

`MECHANICS.md` v1.0 is canonical for rules and supersedes the v0 brief entirely. If you find `Roguelike Wordle Mechanics.md` anywhere outside `docs/archive/`, it is stale — do not read it for rules.

The design files contain rule text in prototype strings. **That text is not normative.** Where a prototype string and `MECHANICS.md` disagree, MECHANICS wins and the string is a design bug to be filed.

## 2. Non-negotiables

Breaking any of these breaks the ability to balance the game, which is the whole project.

1. **`lib/engine/` is pure.** No React, no Next, no `window`, no `localStorage`, no `Math.random`, no `Date.now`. It must run under `npx tsx` with the Next server stopped. CI runs the harness with no build step to prove it.

2. **All randomness is address-based.** `draw(seed, domain, index)`. Never a cursor, never `Math.random`. Domain strings verbatim from technical brief §2.5.

3. **All state changes go through `reduce(state, action)`.** The UI never computes a rule. If a component needs to know something, add a pure selector to `lib/engine/index.ts`.

4. **`lib/engine/core/pool.ts` is the only module that changes `state.pool`.** MECHANICS.md §2.4's refund floor is implemented there, once, not in individual relics. Refunds are `REFUND` effects, never `POOL` effects — a `POOL` delta bypasses the floor.

5. **`relics.json` is never transcribed into TypeScript.** It is loaded and validated. One implementation module per code, keyed by code. Eight validation tests in technical brief §6 keep the data and the code from drifting.

6. **Relics are data + hooks + effects.** Never a special case in the reducer. If a relic will not fit, the `HookName` or `Effect` enum is incomplete — extend it and say so.

7. **Stored feedback is the truth.** `GuessRecord.raw` is what the scorer returned. Corruption, distance and time effects are applied downstream in `projectBoard`. Nothing mutates `raw`.

8. **The view never re-scores.** It renders `projectBoard` output verbatim. Keyboard state derives from the same payload. If the view scores anything, Liar Letter breaks.

9. **Design values are imported, never redeclared.** NIKOLASS tokens are the single source of colour, type, spacing and motion. A hex literal in `/components` is a review rejection. `data-theme="dark"` is pinned; there is no light mode and no toggle.

10. **Terminology is fixed** — pool, act, relic, modifier, consumable, transform, hook, effect. In code and in commits. No `hp`, no `lives`, no `powerup`. Relic codes (`RL.xx`) are opaque string keys: never sort by them, never assume contiguity.

## 3. Testing

- **Port the scorer, do not rewrite it.** MECHANICS.md §4.3: the prototype's `score()` is fuzzed over 200k cases with zero mismatches. Differential-test your port against the original over the same regime before trusting it.
- The refund floor gets its five cases (technical brief §3) before any refund relic is implemented.
- Every relic gets a unit test firing its hook. Every modifier gets one. Composed modifiers get an integration test that plays to a solve.
- Determinism test: same seed + same action list → byte-identical serialized state. Exists by end of Phase 1, never skipped.
- Invariant test: after Sieve, Locked Key and The Moth have all applied, every solution letter is still typable.
- Never test React components for game logic. If a component test asserts a rule, the rule is in the wrong place.

## 4. Working method

- **One ticket per PR**, titled with its ID: `E-06: pool reducer and refund floor`.
- **Do not pass a gate you have not met.** Gate 2 — *is the shared pool tense?* — cannot be answered by an agent. It needs humans playing the build. Report the evidence and stop.
- **Check technical brief §13 before starting a ticket.** Nine of the fourteen listed problems block specific tickets. Do not invent a resolution to a blocking problem; raise it.
- **Docs ship with code.** Behaviour that contradicts a brief means the same PR updates the brief and adds an ADR in `docs/decisions/`.
- Keep PRs readable. A 2,000-line PR touching the reducer will not get a real review.

## 5. When to stop and ask

- A ticket is blocked by an open item in technical brief §13.
- A rule is ambiguous and the ambiguity affects balance.
- A ticket appears to need a reducer special-case for a relic.
- A gate fails.
- A spec decision turns out to be wrong once you are in the code. Say so directly with reasoning. The briefs are meant to be argued with.

Decide without asking: naming, file organisation, component structure, test structure.

## 6. Out of scope

Accounts, cloud save, multiplayer, daily challenges, monetisation, sound, meta-progression, analytics beyond local `RunStats`. Adding any of it will be reverted. The doors already left open (a separate `rw:profile` key, registry filter predicates, the victory screen's reserved strip) stay open and unused.

## 7. Definition of done

Acceptance criterion in technical brief §11 demonstrably met · tests pass with the dev server stopped · `npm run build` produces a static export · lint passes including engine boundary rules · any spec change reflected in the briefs in the same PR.
