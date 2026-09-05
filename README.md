# rougle

A word-deduction roguelike for mobile web. One shared, non-refilling pool of guesses across a run of twenty words. Overspending on one word starves the next; hitting zero with a word unsolved ends the run. Relics, a shop, a forge, events and three bosses modify the loop.

The design bet: *Wordle's failure state is boring because it's isolated. Make it cumulative and it becomes tense.*

## Status

**Phases 0, 1 and 2 are built. Gate 1 is met; Gate 2 is now askable.** The engine
plays a full twenty-word run headlessly and deterministically, the harness runs
1000 seeded runs in about 20 seconds, and every phase the reducer can reach now
has a designed screen. Gate 2 — *is the shared pool tense?* — needs humans
playing the build, which is the one thing an agent cannot do for the project.

What exists: the ported scorer with its differential test, address-based RNG,
the pure reducer, the pool reducer with the §2.4 floor, the transform chain,
board projection, player activations, the emergency ladder, the relic registry
with its ten validations, 28 of the 36 codes in `relics.json`, the eight word
modifiers, all three bosses, the word lists, save/load, the entropy solver, the
harness and its calibration — and on top of them S.01–S.08, the component set,
and the relic drawer that fires activations.

What does not: branching maps, shops, forges, events, elite nodes (so STACKED,
the ninth modifier, has nothing to attach to), and 8 relics — all waiting on
Phase 3 machinery except RL.27, which is blocked on §13 I-15.
`sim/harness.ts` prints the pending list with every sweep.

Phase 3 is deliberately not started. It is the largest phase in the brief, and
building shops and branching routes on top of a core loop nobody has confirmed
is tense would be building on an unverified bet.

See `docs/balance/002.json` for the latest measured numbers and
`docs/decisions/` for what was decided along the way.

## Documents

| Read | For | Authority over |
|---|---|---|
| [`MECHANICS.md`](MECHANICS.md) | The rules | Resources, scoring, structure, bosses, balance targets |
| [`relics.json`](relics.json) | The registry | Relic names, codes, rarity, archetype, hooks, rule text |
| [`design/`](design/) | The interface | Layout, colour, type, motion, component states |
| [`docs/technical-brief.md`](docs/technical-brief.md) | The build | Architecture, types, algorithms, 50-ticket plan |
| [`docs/AGENTS.md`](docs/AGENTS.md) | The rules of the repo | How to work here |
| [`docs/decisions/`](docs/decisions/) | The record | Every call made where the specs were silent or wrong |
| [`docs/balance/`](docs/balance/) | The numbers | One snapshot per tuning pass, diffable |

**Start with MECHANICS.md, then technical brief §0 and §13.** §13 lists
twenty-two engineering problems: fourteen from reading the specs, six from
building Phase 1, two from measuring it. Nine are ruled (MECHANICS.md §11
R-014 … R-019); each of the rest says what it blocks.

The v0 brief (`Roguelike Wordle Mechanics.md`) has been deleted. It is historical
and MECHANICS.md supersedes it entirely.

## Stack

Next.js (App Router) · TypeScript · Tailwind themed from NIKOLASS tokens · Zustand · Vitest

The rules engine at `lib/engine/` is pure TypeScript — no React, no Next, no browser globals. It runs in plain Node. That is what makes headless balance simulation possible, and it is enforced by lint and CI rather than by good intentions.

## Commands

```bash
npm install --legacy-peer-deps   # npm 10's peer resolver trips over vitest 4 otherwise
npm run dev                      # Next dev server
npm run build                    # static export
npm test                         # engine + sim, no Next required
npm run lint                     # includes the engine boundary rules
npm run typecheck

npm run sim -- --runs 1000                 # headless balance simulation
npm run sim -- --runs 1000 --snapshot 002  # and write docs/balance/002.json
npm run sim -- --runs 500 --no-relics      # Gate 3: does a no-relic bot die in Act II?
npm run calibrate -- --runs 400            # re-fit the solver handicap to the human baseline
npm run wordlists                          # regenerate /data (offline, occasional)
```

## The three things most likely to go wrong

1. **Determinism.** Same seed plus same inputs must produce an identical run. Every draw is addressed by `(seed, domain, index)`, never a running cursor. If `npm run sim` gives different numbers for the same seed twice, stop — every balance number after that point is invalid.

2. **The engine boundary.** One stray `next/dynamic` import inside `lib/engine/` ends headless simulation. CI runs the harness with no Next build specifically to catch it.

3. **The refund floor.** MECHANICS.md §2.4 lives in `lib/engine/core/pool.ts` and nowhere else. Implemented per-relic instead, refunds compose to zero cost and the game loses its only resource.

## Balance is provisional

Every act budget in MECHANICS.md §2.2 is a derived estimate, not a measurement. The headless harness exists to replace them with numbers. It is built in Phase 1, not Phase 5.
