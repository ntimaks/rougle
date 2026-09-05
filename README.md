# rougle

A word-deduction roguelike for mobile web. One shared, non-refilling pool of guesses across a run of twenty words. Overspending on one word starves the next; hitting zero with a word unsolved ends the run. Relics, a shop, a forge, events and three bosses modify the loop.

The design bet: *Wordle's failure state is boring because it's isolated. Make it cumulative and it becomes tense.*

## Status

Pre-implementation. Rules, relics and visual design are all specified; no code exists yet.

## Documents

| Read | For | Authority over |
|---|---|---|
| [`MECHANICS.md`](MECHANICS.md) | The rules | Resources, scoring, structure, bosses, balance targets |
| [`relics.json`](relics.json) | The registry | Relic names, codes, rarity, archetype, hooks, rule text |
| [`design/`](design/) | The interface | Layout, colour, type, motion, component states |
| [`docs/technical-brief.md`](docs/technical-brief.md) | The build | Architecture, types, algorithms, 50-ticket plan |
| [`docs/AGENTS.md`](docs/AGENTS.md) | The rules of the repo | How to work here |

**Start with MECHANICS.md, then technical brief §0 and §13.** §13 lists fourteen engineering problems in the specs; nine block specific tickets and need a decision before those tickets can be built.

`docs/archive/Roguelike Wordle Mechanics.md` is the v0 brief. It is historical. Do not read it for rules.

## Stack

Next.js (App Router) · TypeScript · Tailwind themed from NIKOLASS tokens · Zustand · Vitest

The rules engine at `lib/engine/` is pure TypeScript — no React, no Next, no browser globals. It runs in plain Node. That is what makes headless balance simulation possible, and it is enforced by lint and CI rather than by good intentions.

## Commands

```bash
npm run dev                    # Next dev server
npm run build                  # static export
npm test                       # engine + sim, no Next required
npm run sim -- --runs 1000     # headless balance simulation
npm run wordlists              # regenerate /data (offline, occasional)
```

## The three things most likely to go wrong

1. **Determinism.** Same seed plus same inputs must produce an identical run. Every draw is addressed by `(seed, domain, index)`, never a running cursor. If `npm run sim` gives different numbers for the same seed twice, stop — every balance number after that point is invalid.

2. **The engine boundary.** One stray `next/dynamic` import inside `lib/engine/` ends headless simulation. CI runs the harness with no Next build specifically to catch it.

3. **The refund floor.** MECHANICS.md §2.4 lives in `lib/engine/core/pool.ts` and nowhere else. Implemented per-relic instead, refunds compose to zero cost and the game loses its only resource.

## Balance is provisional

Every act budget in MECHANICS.md §2.2 is a derived estimate, not a measurement. The headless harness exists to replace them with numbers. It is built in Phase 1, not Phase 5.
