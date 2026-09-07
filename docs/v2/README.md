# The v2.0 registries, staged

`MECHANICS.md` is v2.0. The engine still implements v1.3, and these two files are
**data the engine loads at runtime**, not documentation — swapping them in place
deletes nine relic implementations out from under the reducer and takes a
working game down for the length of the migration.

So they wait here. `relics.json` and `events.json` in the repo root stay v1.3
and live until the §2 bankroll migration lands, at which point these replace
them and this directory goes away.

| File | What it is |
|---|---|
| `relics.json` | v2.0. 22 relics, six of them scaling (MECHANICS.md §6.5). |
| `events.json` | v2.0. 13 events, rescaled for a 12–24 bankroll. |
| `../archive/*-v1.3.json` | What the engine loads today. |

The nine codes v2.0 retires are `RL.05` `RL.08` `RL.10` `RL.16` `RL.17` `RL.18`
`RL.24` `RL.25` `RL.27`. Two of them — `RL.08` The Fence and `RL.17` The Holdout —
exist only to discount the paid reveal ladder, which v2.0 cuts, so they go with it.
