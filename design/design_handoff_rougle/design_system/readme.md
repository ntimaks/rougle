# NIKOLASS — Design System

> A personal brand system for **NIKOLASS**. Technical, nostalgic, bold.
> The aesthetic of a 1990s terminal that knows it's beautiful.

---

## Index

| File / Folder | What's in it |
|---|---|
| `readme.md` | This file: identity, content fundamentals, visual foundations, iconography, component index. |
| `SKILL.md` | Agent-Skill manifest — lets Claude Code use this folder as a portable skill. |
| `styles.css` | Global entry point. Import lines only. Consumers link this one file. |
| `tokens/` | `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `motion.css`, `base.css`. |
| `components/` | React primitives: `brand/`, `core/`, `data/`. |
| `guidelines/` | Foundation specimen cards (Type · Colors · Spacing · Brand). |
| `ui_kits/portfolio/` | Clickable hi-fi recreation of the personal site. |
| `assets/` | Logos, halftone filter, inspiration boards, reference screenshot. |
| `thumbnail.html` | Homepage tile for the system. |

### Components

**`components/brand/`** — `Stamp`, `TechMarker`, `Highlighter`, `Caret`, `Halftone`, `PixlGlyph`, `AsciiDivider`
**`components/core/`** — `Button`, `Tag`, `Input`, `Panel`, `MetaPair`
**`components/data/`** — `MetaStrip`, `EntryCard`, `DataTable`

Each has a sibling `.d.ts` (props contract) and `.prompt.md` (what & when, usage, variants). Import from the compiled bundle: `const { Button } = window.NIKOLASSDesignSystem_1f5ba6`.

---

## Sources & Inputs

Ported from an earlier version of this system held in another account, mounted here as the local folder **`Personal Design System/`**. That folder contained: `README.md`, `colors_and_type.css`, `SKILL.md`, `assets/`, `preview/` (24 specimen cards), `ui_kits/portfolio/index.html` (a single-file prototype), `screenshots/portfolio-current.png`, and an `uploads/` folder of pinned reference images. No Figma file, no GitHub repository, no slide deck was provided.

The original system was itself synthesised from three pinned inspiration images:

- `assets/inspo-web.jpg` — **s-i-l-o.fr** (Cyril Makhoul), a French label/édition site. Dense data UI: weather strip, file tables, thumbnails with metadata, monospace everywhere, hard 1px black rules. The "old web" reference.
- `assets/inspo-typography.jpg` — **"MINDLESS CONSUMPTION, OCTOBER 2025."** Typewriter mono body running into a giant condensed display headline, yellow highlighter overlays, ASCII horse, numbered lists with gaps.
- `assets/inspo-poster.jpg` — **CERTAIN UNCERTAINTIES [VOL.2] // FLAME³** (333 LAB). Bilingual CN/EN technical poster. Dithered halftone subject. Acid annotation boxes with codes like `[FL33]`, `[PX333]`. Mono datestamps `2025.03.22 → 06.29`.

The synthesis: **monospace-first**, **square corners**, **information density is a feature**, **paper + ink with one acid accent**, **everything is annotated** (codes, brackets, datestamps, IDs), **halftone imagery** instead of glossy photography.

### Changes made in this port

- **Real components.** The source had zero React components — only static preview HTML. The 15 primitives above were extracted from the prototype's inline implementations and the preview cards, keeping the exact numeric values (9px labels, `0.2em` tracking, 3px stamp shadow, `translate(1px,1px)` hover).
- **Split tokens.** `colors_and_type.css` became `tokens/*.css` behind an import-only `styles.css`.
- **Factored UI kit.** The single 691-line `index.html` became one file per surface; it now composes the shipped components instead of redefining them.
- **Intentional additions:** `AsciiDivider` (the ASCII section break existed as a specimen card but had no component) and `Panel` (the header-strip card, previously hand-rolled in three places).

---

## Brand Identity

NIKOLASS is one person. The brand voice is:

- A **logbook**, not a marketing site.
- A **technician** who's also a romantic.
- Confident enough to leave whitespace, precise enough to label everything.
- Old-web density (s-i-l-o.fr) mixed with clean technical typography (333 LAB).

If the site were a physical object: a grid notebook with carbon-copy duplicates, stamped page numbers, and one fluorescent post-it.

---

## Content Fundamentals

**Voice**
- First person, but spare. "I made this." "I write here." Never "we."
- Direct address ("you") is rare and earnest, never marketing-speak. No "let's", no "discover", no "elevate".
- Slightly **clinical**: works are *catalogued*, not *featured*. Posts have *entries*, not *headlines*.
- One-line bios over paragraphs. Lists over prose where possible.

**Casing**
- **UPPERCASE** for navigation, labels, section headers and stamps. Tracking `0.12em–0.2em`.
- **Sentence case** for body copy and titles of works.
- **lowercase** is allowed for personal asides and footnotes — it reads like a private note.
- Never Title Case For Headings.

**Punctuation & symbols**
- `//` separates metadata. `→` marks ranges and actions. `·` sits between nav items.
- Square brackets everywhere: `[VOL.2]`, `[TX03]`, `[2025]`, `[DRAFT]`. A brand fingerprint.
- Numbered lists with **gaps** (1, 2, 4, 6, 12…) — implies an index, not a sequence.
- Dates are ISO-ish: `2025.03.22` or `25.03.22`. Never "March 22, 2025".
- French surfaces (PARTAGE, ÉTALAGE, ÉDITION, Rechercher) appear alongside English; the bilingual slip is deliberate.

**Tone examples**
- ✅ `LOG // 25.10.06 — finished the rewiring. ground loop is gone.`
- ✅ `Currently reading: Calvino, If on a winter's night a traveller. Slow.`
- ✅ `[ARCHIVE] 47 entries. Sorted by month. Click to expand.`
- ❌ `Welcome to my creative journey!`
- ❌ `Discover my latest projects`

**Emoji** — none, ever. Unicode geometry instead: `◇ ◆ ▲ ▼ ● ○ ✦ ※ ¶ §`. ASCII art is welcome as page furniture.

**The vibe** — "I keep notes. These are some of them."

---

## Visual Foundations

### Color
Monochromatic with **one acid**. Color is information, not decoration.

- **Paper** `#EEEEEE → #C2C2C0` — true-neutral off-whites. The dominant surface.
- **Ink** `#0C0C0C → #B4B4B2` — six steps, near-black to hairline.
- **Accents**, four core hues from the poster series, each with a `-deep` hover variant: **lime** `#D4E635` (default — active/now/live), **cobalt** `#1F47E6` (links, data, technical refs), **vermillion** `#FF4FA8` (featured, hero), **kelly** `#3DB94A` (supporting, tags). Extended set (magenta, cyan, amber, orange) exists for semantic states and is used sparingly.
- **Terminal** `#0A0E0A` bg / `#C8FF1F` fg / `#FF5D4A` red / `#E8B23A` amber — inside terminal strips and code blocks only, **never** outside them.
- One accent per page; two on rare occasions. Pure `#FFFFFF` and `#000000` are not in the palette.
- **Dark mode** is charcoal (`#121212 → #303030`), never pitch black, via `[data-theme="dark"]`.

### Type
Mono is the default body face — that alone defines half the system.

- **JetBrains Mono** — body, UI, labels. 400/500/700.
- **Space Grotesk** — the giant display headline only. Bold, uppercase, `-0.02em`.
- **VT323** — pixel/CRT face for terminal strips, thumbnails, counters.
- **DM Serif Display** italic — editorial pull quotes, 1–2 per page max.

Sizes run very small (9–13px metadata) and very large (64–144px display). The **16–22px midrange is intentionally underused** — that's what makes it read like a printed manual rather than a webpage.

### Spacing & layout
4px baseline grid. Whitespace at the section level (64–96px), density inside panels (4–8px). 12-column grid, 24px gutters, 1280px max width. Edge-to-edge ruled strips pin the top and bottom of a page and hold ambient meta (dates, weather, build hash). Sidebars and side rails are common; asymmetry is welcome. A personal site is allowed to look like a dashboard — that's the point.

### Backgrounds
Paper texture as the default body background: a subtle warm SVG noise at ~6% alpha, `mix-blend-mode: multiply`. **No gradients. No glassmorphism.** Halftone/dithered treatment for any photographic content. Repeating ASCII patterns (`/ / / /`, `●○●○`, `═══`) as section dividers. Hard 1px ink rules define everything.

### Animation
Step-based easing for retro feel (`steps(2)`, `steps(6, end)`) on blinks, scan lines and marquees; `linear` or `cubic-bezier(0.2, 0.8, 0.2, 1)` for everything else. Durations 60–320ms, most 120–180ms. No bouncing, no spring physics, **no fade-in-on-scroll**. A `█` caret blink on terminals is encouraged.

### Hover & press
- **Links**: ink underline → acid background fills, underline drops.
- **Buttons**: translate `1px` on hover, `2px` on press — the stamp shadow vanishes underneath. Like pressing a physical stamp onto a sheet.
- **Cards**: lift `-1px` and gain a stamp shadow on hover, header strip inverts to ink, title shifts to cobalt; press slams `2px` down.
- **Table rows**: translucent acid wash, never a gray.
- **No opacity fades for hover.**

### Borders & shadows
Hard 1px `--ink-0` borders, always. Hairlines (`0.5px`, dotted `--ink-5`) for row dividers inside panels. The only shadow is a **stamp offset** — `3px 3px 0 0 ink-0`, no blur; `6px` for large. Press states cancel it. There are no blurred drop shadows anywhere in this system.

### Corner radii
`0` for almost everything — cards, buttons, fields, modals. `2px` for tags and chips. `9999px` only for status dots.

### Cards
1px ink border, `--paper-1` fill, a header strip (`--paper-2`, uppercase meta label left, code/ID right), dense content with labels left and values right on dotted hairlines. Optional 3px stamp shadow marks an important card — at most one per view.

### Transparency & blur
Almost never. No backdrop-blur, no translucent overlays. Two exceptions: the acid highlighter may use `mix-blend-mode: multiply` to feel like a physical marker, and table-row hover uses a 50% acid wash.

### Image treatment
Black & white, halftoned or dithered, cool and dry. Framed by a 1px ink border with a caption stamp below or inside (`FIG.03 // 2024`). No vignettes, no warmth filters, no soft focus.

---

## Iconography

NIKOLASS uses **no conventional icon library**. The vocabulary is:

1. **Unicode geometric symbols** — `◇ ◆ ▲ ▼ ● ○ ◐ ◑ ◧ ◨ ✦ ✧ ☐ ☑ ※ ¶ §`. Bullets, status indicators, weather pictograms, the dark-mode toggle (`◐`/`◑`).
2. **ASCII glyphs** — `→ ← ↑ ↓ ▸ ► ▮ + - × · / //`. Inline in metadata, footers and buttons.
3. **Bracketed text markers** — `[FL33]`, `[PX333]`, `[CMP.04]`. Rendered by `TechMarker` and `Stamp`, not by any icon set. This is the brand's real "icon system".
4. **PIXL**, the pixel mascot — `components/brand/PixlGlyph.jsx`, an 11×12 crisp-edges SVG that stands in for a logo mark in nav bars and footers.
5. **Logo files** in `assets/`: `logo-wordmark.svg`, `logo-monogram.svg`, `logo-critter.svg`, plus `halftone-filter.svg` (an SVG filter for photographic content).

No icon font is bundled and none should be added. If a UI genuinely needs a pictographic glyph that Unicode can't supply (play, pause, hamburger, search), use **Lucide via CDN** at stroke 1.5, ink colored, never filled — this is a *substitution* flagged here, not part of the original source. Emoji: never.

---

## Font substitutions ⚠️

No licensed font binaries were provided, so the system loads **Google Fonts** stand-ins (`tokens/fonts.css`):

| Role | Loaded | Likely original target |
|---|---|---|
| Body / UI / labels | **JetBrains Mono** | PP Fraktion Mono, Berkeley Mono, Departure Mono |
| Display headline | **Space Grotesk** | PP Neue Machina, NaN Holo, Söhne Breit |
| Pixel / CRT | **VT323** | PP Fraktion Sans, Cartograph, a custom 1-bit face |
| Editorial italic | **DM Serif Display** | Editorial New, PP Editorial, Tiempos |

**Ask:** drop real font files into a `fonts/` folder and they'll be wired up as `@font-face` rules in `tokens/fonts.css`.

---

## Using this system

```html
<link rel="stylesheet" href="styles.css">
<script src="_ds_bundle.js"></script>
```

Then use the tokens (`var(--ink-0)`, `var(--ff-mono)`), the semantic classes (`.t-display`, `.t-meta`, `.t-stamp`, `.t-hi`), and the components off `window.NIKOLASSDesignSystem_1f5ba6`. For a full worked example, open `ui_kits/portfolio/index.html`.
