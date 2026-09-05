# github.md

repo: ntimaks/rougle
branch: main
path: (monorepo — design lives alongside the game code)

## Last sync

date: 2026-09-04T00:00:00Z

### Updated in this project
- Repo is empty (no commits on `main`) — design built greenfield from the uploaded brief.
- `Rougle.dc.html` — mobile-first clickable prototype, 11 screens + relic drawer and tooltip.
- `Rougle Components.dc.html` — 13-component sheet: states, props, motion ledger, engine-hook map, token contract.
- Both files now load the NIKOLASS token sheets and pin `data-theme="dark"`; ~680 colour literals converted to tokens.
- `design_handoff_rougle/` — self-contained handoff bundle for the developer agent.

## Commit status

**Not committed.** Design tooling here is read-only against GitHub — it can browse, read and
pull files in, but cannot push, commit, or open a PR. The commit has to be made by the developer
agent (or by hand). Everything needed is in `design_handoff_rougle/`.

Suggested destination in the monorepo:

```
rougle/
  design/
    README.md                     <- handoff doc
    Rougle.dc.html                <- prototype
    Rougle Components.dc.html     <- component sheet
    support.js
    Roguelike Wordle Mechanics.md <- source brief
    design_system/                <- NIKOLASS tokens as loaded
```

`design_system/tokens/*.css` should be the single source of colour, type, spacing and motion for
the app too — import them rather than re-declaring values in app CSS.

## Screen map

| Screen | Built from |
|---|---|
| S.01 Title / run start | brief §1, §2 |
| S.02 Character select | brief §11 |
| S.03 Act map | brief §6 |
| S.04 Word solve | brief §4, §5, §7, §14 |
| S.05 Relic reward | brief §8, §15 |
| S.06 Shop | brief §4, §15 |
| S.07 Forge | brief §6, §17 Q3 |
| S.08 Event | brief §10 |
| S.09 Boss intro (3 variants) | brief §9 |
| S.11 Death | brief §4, §8 |
| S.12 Victory | brief §13 |
| Component sheet | brief §5, §8, §14 |
