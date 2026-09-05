# Handoff: Rougle — roguelike Wordle

## Overview
Rougle is a word-deduction roguelike for mobile web. The player solves a run of words across
three acts against **one shared, non-refilling pool of guesses**. Overspending on one word
starves the next; hitting zero with a word unsolved ends the run. Relics, a shop, a forge,
events and three bosses modify the loop.

This bundle is the **visual and interaction design** for that game: 11 screens, 13 components,
every state, and a motion + engine-hook contract.

The game rules, scoring pipeline, relic list and balance targets live in the source brief
(`Roguelike Wordle Mechanics.md`, also in this bundle). **This handoff does not restate them** —
it says what the interface looks like and how it behaves. Where the two meet (which hook repaints
which component) is documented in §4 of the component sheet.

## About the design files
`Rougle.dc.html` and `Rougle Components.dc.html` are **design references written in HTML**.
They are prototypes showing intended look and behaviour — *not* production code to copy.

The task is to **recreate these designs in the target codebase**. The repo (`ntimaks/rougle`) is
currently empty, so pick the framework: for this game I'd suggest **React + TypeScript + Vite**,
with the game engine as a framework-agnostic TS module (pure reducers, no React imports) that the
UI subscribes to. The brief's §5 transform pipeline and §8 event bus are already shaped that way.

Open both files directly in a browser — no build step, no server.

## Fidelity
**High-fidelity.** Final colours, typography, spacing, motion and interaction states. Every value
in the component sheet is literal and copyable. Recreate it pixel-accurately using the target
codebase's patterns.

The one thing that is *not* final: copy for individual relics, events and bosses is representative,
not a shipped content list. Names and rules read as designed examples of each archetype.

## Design system
The game is built on the **NIKOLASS** design system, included at `design_system/`.

Load order (both design files do this in `<helmet>`):
```html
<link rel="stylesheet" href="design_system/tokens/fonts.css">
<link rel="stylesheet" href="design_system/tokens/colors.css">
<link rel="stylesheet" href="design_system/tokens/typography.css">
<link rel="stylesheet" href="design_system/tokens/spacing.css">
<link rel="stylesheet" href="design_system/tokens/motion.css">
<link rel="stylesheet" href="design_system/tokens/base.css">
```

Two rules that are **not negotiable**, because breaking either produces illegal contrast:

1. **`data-theme="dark"` is pinned on the root and is not toggleable.** The game is a single dark
   "terminal instrument" surface. There is no light mode. Do not add a theme switch.
2. **Accent fills always take a `var(--g-ink)` (#0C0C0C) border — never white, and never
   `var(--ink-0)`**, which inverts to near-white under the dark theme. Lime `#C8FF1F` on paper
   `#EEEEEE` is illegal contrast. The white stamp shadow sits *outside* the ink border, so the
   stamp offset still reads on charcoal without the accent ever touching white. Same applies to
   amber `#E8B23A` and vermillion `#FF5D4A`.

### Token layers
- **Inherited (NIKOLASS)** — `--dark-*` paper ramp, `--term-*` terminal palette, `--magenta`,
  `--kelly`, plus the type, spacing and motion scales. Do not redefine these.
- **Game layer (`--g-*`)** — 11 additive tokens declared in each file's `<helmet>`. NIKOLASS's dark
  ramp has four steps, which is enough for a document but not for a HUD that stacks chrome over
  panel over strip over sunken *and* separates five tile states. Full table in §7 of the
  component sheet. The layer never overrides a system token.

## Screens
11 screens. All are reachable in the prototype via the **`IDX`** button in the top-right chrome
strip (dev affordance — do not ship it).

| Code | Screen | Purpose |
|---|---|---|
| S.01 | Title / run start | Explain the core constraint before the player commits. Begin or continue. |
| S.02 | Character select | Pick one of three loadouts. Sets act pool and one innate rule; locked for the run. |
| S.03 | Act map | Route choice. Nodes branch; the player picks the path, not just the next step. |
| S.04 | **Word solve** | The core loop. Grid, keyboard, pool meter, modifier banner, solve stamp. |
| S.05 | Relic reward | Take 1 of 3. Prints archetype and a synergy line against what's held. |
| S.06 | Shop | Relics and consumables against gold. Price colour carries affordability. |
| S.07 | Forge | One operation: upgrade a relic (one tier) or convert gold → guesses. |
| S.08 | Event | A framed choice with stated stakes. |
| S.09 | Boss intro | Three variants (Twins / Cipher / Gauntlet), each stating its rule before engaging. |
| S.11 | Death | Run log, cause of death, and the Ouroboros out if unspent. |
| S.12 | Victory | Run summary as a printed receipt, final build, shareable seed. |

Layout is documented per-component in the sheet rather than duplicated here. The structural
constants: **430px max play column**, centred, full-height, 1px edges. Header chrome 32px. HUD is
read-only and lives at the top; every primary action sits in the bottom third for thumb reach.

## Components
13 components, `CMP.01`–`CMP.13`, each catalogued in `Rougle Components.dc.html` §2 with props,
every state, the engine hook that drives it, motion, and design notes:

```
CMP.01  POOL METER        the health bar. number + 24 pips
CMP.02  TILE              8 states incl. the corruption language
CMP.03  KEY / KEYBOARD    5 states, 46px, Sieve hard-lock
CMP.04  RELIC CARD/CHIP   card, chip, drawer row, tooltip — one object at four densities
CMP.05  MAP NODE          glyph=type, fill=progress, pulse=available
CMP.06  BUTTON            primary / secondary / danger / disabled
CMP.07  STAMP             solved + terminated
CMP.08  MODIFIER BANNER   amber=modified, vermillion=lethal
CMP.09  LIST ROW          shop + forge
CMP.10  STAT CELL         hairline receipt grid
CMP.11  TICKER            boss marquee
CMP.12  TOOLTIP           the one inverted surface in the game
CMP.13  DRAWER            relic inventory
```

## Interactions & motion
Full ledger in §3 of the component sheet: **14 named animations**, each with keyframe name,
duration, easing and trigger. Summary of the rules behind it:

- **No springs, no bounce, no fade-in-on-scroll, no opacity hover.**
- Step easing (`steps(n,end)`) for anything mechanical — reveals, drains, stamps.
  `cubic-bezier(0.2,0.8,0.2,1)` for anything that travels.
- Every duration ≤620ms. A fast player must never wait on the interface.
- Press is `translate(1px,1px)` over 60ms; a stamped element's shadow collapses to 0 on press.
- `prefers-reduced-motion` collapses all durations to 1ms and stops every loop. **State still
  changes** — motion is never the only carrier of information. Wired as the `reducedMotion` prop.

The four moments that got the most design attention, per the brief's priorities: pool decrement +
low-pool tension, relic card draw + pick, solve celebration, keyboard key states.

## State
The prototype holds demo state only. Real state belongs in the engine, not the view. Two rules
the design depends on:

1. **The view never re-scores.** `onFeedbackTransform` emits the final `FeedbackResult` after all
   transforms — including corrupted tiles — and the grid renders it verbatim. Keyboard letter
   states derive from the same payload. If the view scores anything itself, Liar Letter breaks.
2. **Letter state is derived, never stored.** Recompute best-known state per letter from guess
   history on each feedback event.

Engine-hook → UI repaint map is §4 of the component sheet — 10 hooks, each stating exactly what
must repaint and the ordering traps (e.g. Tithe's +5g must land on the same frame as the pool
tick, or the two reads compete for attention).

## Open questions
§6 of the component sheet answers the brief's five open questions *in design terms* — pool display,
failure severity, forge tiers, meta-progression, Mirror scoring. Q5 (Mirror scoring with shared
letters) is flagged **blocked on a rules decision**: the Twins screen renders two result rows per
guess so any rule has a home, but the rule itself has to be decided before that screen is final.

## Desktop
Mobile is the design; desktop is the adaptation. §5 of the component sheet. Short version: the
430px column never stretches (a 900px tile row destroys the row-scan read), space either side
earns a relic rail and a persistent minimap, physical keyboard becomes primary input while the
on-screen keyboard stays as the eliminated-letter memory at 34px.

## Not yet designed
- Act II and Act III maps (Act I sets the pattern; node mix differs).
- Onboarding / first-run teaching of the pool constraint.
- Settings, audio, accessibility panel beyond reduced-motion.
- Meta-progression (deliberately out of scope — see §6 Q4).
- Twins result-row layout, pending the Q5 rules decision.

## Files
```
Rougle.dc.html                    the prototype — 11 screens, clickable, real solve logic
Rougle Components.dc.html         the component + interaction sheet — read this second
Roguelike Wordle Mechanics.md     the original mechanics brief (game rules, not design)
design_system/                    NIKOLASS tokens + bundle, as loaded by both files
```

Read the prototype first to feel the loop, then the component sheet for the values.
