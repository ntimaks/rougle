# Rougle — Technical Implementation Brief

**Version:** 2.0
**Repo:** `ntimaks/rougle` · **Path:** `docs/technical-brief.md`
**Status:** Implementation-ready
**Governed by:** `MECHANICS.md` v1.0 (rules) and `design/` (presentation)
**Repo conventions:** `docs/AGENTS.md`
**Supersedes:** technical brief v1.0, which was written against the v0 brief and is now historical. Delete it or move it to `docs/archive/`.

---

## 0. Authority

Three documents govern this project and they do not overlap.

| Document | Owns | This brief's relationship |
|---|---|---|
| `MECHANICS.md` v1.0 | Game rules: resources, scoring, structure, relics, modifiers, bosses, balance targets | **Subordinate.** This brief never restates a rule and never contradicts one |
| `relics.json` | Relic names, codes, rarity, archetype, hooks, rule text | **Subordinate.** Consumed as data, never transcribed into code |
| `events.json` | Event content: prose, options, stakes, effect trees | **Subordinate.** Consumed as data, never transcribed into code. Added by R-022 |
| `design_handoff_rougle/` | Presentation: layout, colour, type, motion, component states | **Subordinate.** This brief never specifies a visual value |
| **This brief** (`docs/technical-brief.md`) | Engineering: architecture, types, algorithms, file layout, build order, test strategy | Authoritative on *how*, never on *what* |

Where this brief appears to state a rule, it is quoting MECHANICS.md for context. If they disagree, MECHANICS.md wins and this brief is the bug.

**§13 lists twenty-nine engineering problems.** Fourteen came from reading the specs, six (I-15 … I-20) from building Phase 1, two (I-21, I-22) from measuring it, two (I-23, I-24) from the content the specs never contained, one (I-25) from measuring R-025, one (I-26) from playtesting the result one (I-27) from a sweep that turned out to be measuring the bot one (I-28) from a flag that was accepted and ignored and one (I-29) from a metric that indicted the wrong file. **Twenty-six are now ruled** — see MECHANICS.md §11 R-014 … R-036 — and the rest are marked with what they block. Read §13 before starting a ticket.

### 0.1 What changed from technical brief v1.0

v1.0 was written against the v0 brief, before the design pass. MECHANICS.md v1.0 supersedes almost all of its rules content. Specifically retired from v1.0:

- v1.0's act budgets, node weights, relic tables, modifier tables, character table, and events list — **all superseded** by MECHANICS.md §2, §3, §5, §7 and `relics.json`.
- v1.0's independent Mirror ruling — superseded by MECHANICS.md §7.1 (same conclusion, reached independently, now normative there).
- v1.0's `PHASE` constants for transform ordering — superseded by MECHANICS.md §4.4's six-step chain.
- v1.0's argument that `onFeedbackTransform` should not be a hook — **withdrawn.** MECHANICS.md §6.1 makes it a hook and §4.4 fixes the order; the two together give the determinism the argument was protecting. Adopt the spec's model.
- v1.0's Rangefinder concerns — resolved by the design pass's identity-withholding redesign (R-002).

Carried forward from v1.0 and still normative here: the pure-reducer architecture (§2), address-based RNG (§2.5), the engine/UI boundary (§1.3), the board projection layer (§4.3), the word-list algorithm (§8), the simulation harness (§9), and the Next.js hazards (§1.4).

---

## 1. Stack and layout

### 1.1 Framework

**Next.js (App Router) + TypeScript + Tailwind.** The design handoff suggests React + Vite; Next is chosen instead for implementer familiarity and because daily-challenge mode (MECHANICS.md §9, "any future daily mode") needs a server eventually. The handoff's actual requirement — *"the game engine as a framework-agnostic TS module (pure reducers, no React imports) that the UI subscribes to"* — is preserved exactly and enforced by lint (§1.3).

| Concern | Choice | Note |
|---|---|---|
| Framework | Next.js 14+, App Router, `output: 'export'` | Static until a server is needed |
| Language | TypeScript, `strict: true` | Load-bearing given the effect/hook model |
| Styling | Tailwind, themed **from** NIKOLASS tokens | See §1.5. Never redeclare a design value |
| State binding | Zustand | Thin shim; holds no rules |
| Testing | Vitest | Runs the engine in Node with Next stopped |
| Lint | ESLint + `no-restricted-imports` | Enforces the boundary mechanically |

### 1.2 Layout

```
/app
  layout.tsx               server component — token CSS imports, data-theme="dark" pinned
  page.tsx                 S.01 title
  /play/page.tsx           renders <GameShell />
/components
  GameShell.tsx            'use client' — the ONLY client boundary
  /screens                 S.01–S.12 per the design handoff screen map
  /cmp                     CMP.01–CMP.13, one file each, named for the sheet
/lib
  /engine                  ← pure TS. No React, no Next, no DOM, no Date.now, no Math.random
    /core
      state.ts             GameState and sub-state types
      actions.ts           Action union
      effects.ts           Effect union + applyEffect
      reducer.ts           reduce(state, action) => { state, events }
      pool.ts              guess pool + MECHANICS §2.4 refund floor. The ONLY place pool changes
      hooks.ts             HookName, resolveHook
      rng.ts               address-based deterministic RNG
      serialize.ts         pure save/load + migration
      config.ts            every tunable number (§1.6)
    /feedback
      scorer.ts            ported from the prototype (§4.1)
      chain.ts             MECHANICS §4.4 six-step transform chain
      projection.ts        board-level projection: Decay + deferral gating (§4.3)
      infoCap.ts           MECHANICS §6.3 pre-guess reveal cap
    /content
      registry.ts          loads + validates relics.json, builds the RelicDef map
      events.ts            loads + validates events.json (R-022)
      impl/RL.01.ts …      one implementation module per relic code
      modifiers.ts
      bosses.ts
      events.ts
    /map/generate.ts       row-class DAG generation (§5)
    /words                 loader + validation
    index.ts               public API — the ONLY module /components may import
  /store/useGame.ts        'use client' Zustand shim
  /persistence/local.ts    'use client' — the only file naming localStorage
/sim                       solver, harness, report. Runs under tsx, never bundled
/scripts/build-wordlists.ts
/data                      generated word lists
/design                    the handoff bundle, verbatim
  design_system/           NIKOLASS tokens — imported by the app, never edited
MECHANICS.md
relics.json
events.json
```

### 1.3 The boundary rule

`lib/engine/` must run under `npx tsx` with Next stopped. Enforce with ESLint on `lib/engine/**`:

```js
'no-restricted-imports': ['error', {
  paths: ['react', 'react-dom', 'zustand', 'framer-motion'],
  patterns: ['next/*', '@/app/*', '@/components/*', '@/lib/store/*', '@/lib/persistence/*']
}]
```

Plus `no-restricted-globals` for `window`, `document`, `localStorage`, `Math.random`, `Date.now`, `crypto`.

**The check that actually matters:** a CI job running `npx tsx sim/harness.ts --runs 50` with no Next build step. If it passes, the boundary is intact. If it fails on module resolution, someone imported a Next module into the engine and every balance number after that commit is suspect.

### 1.4 Next.js hazards

**Hydration.** The saved run must never be read during render — server HTML has no save, client HTML does, and the mismatch presents as save corruption.

```tsx
'use client';
export function GameShell() {
  const [hydrated, setHydrated] = useState(false);
  const { state, hydrate } = useGame();
  useEffect(() => { hydrate(loadRun()); setHydrated(true); }, [hydrate]);
  if (!hydrated) return <BootSplash />;   // identical server and client: static markup only
  return state ? <PhaseSwitch state={state} /> : <TitleScreen />;
}
```

**One client boundary.** `'use client'` on `GameShell` and nothing below it. There is no SSR win available — the whole app is stateful client interaction — so the goal is a single reviewable line.

**No routing on game phase.** Two routes only: `/` and `/play`. `PhaseSwitch` is a switch on `state.phase`. A URL like `/word` is a lie: not linkable, not refreshable, not back-safe.

**Tailwind cannot see runtime-assembled classes.** This breaks tile colours specifically, which is the one thing that must never break. Static maps only — see §1.5.

### 1.5 Design tokens — import, never redeclare

The handoff is explicit: `design_system/tokens/*.css` is the single source of colour, type, spacing and motion for the app. Import the six files in `app/layout.tsx` in the documented order (fonts, colors, typography, spacing, motion, base), pin `data-theme="dark"` on `<html>`, and ship no theme toggle.

Tailwind is then themed **from** the tokens rather than alongside them:

```js
// tailwind.config.js
theme: { extend: { colors: {
  ink:      'var(--g-ink)',       panel:  'var(--g-panel)',
  strip:    'var(--g-strip)',     sunken: 'var(--g-sunken)',
  chrome:   'var(--g-chrome)',    absent: 'var(--g-absent)',
  line:     'var(--g-line)',      lineStrong: 'var(--g-line-strong)',
  amber:    'var(--term-amber)',  red:    'var(--term-red)',
}}}
```

A hex literal in `/components` is a review rejection. The two non-negotiable contrast rules from `CLAUDE.md` — no lime/amber/vermillion on white or paper, and accent fills always take a `var(--g-ink)` border — should be encoded as lint rules if possible and as a review checklist item if not.

Tile and key states come from a static map so the JIT can see every class, and so the visual language has one documented home:

```ts
// components/cmp/tileStyles.ts — the nine states of CMP.02 (see §13 I-01)
export const TILE: Record<TileVisualState, string> = {
  EMPTY:         'bg-transparent text-fg0 border-dark2',
  TYPED:         'bg-transparent text-fg0 border-fg0',
  ABSENT:        'bg-absent text-fg3 border-line',
  PRESENT:       'bg-amber text-ink border-ink',
  CORRECT:       'bg-accent text-ink border-ink',
  RANGEFINDER:   'bg-amber text-ink border-ink',       // renders distance, NO glyph (R-002)
  UNTRUSTWORTHY: 'bg-dark2 text-fg0 border-fg0 rg-scanline',
  DEFERRED:      'bg-sunken text-absentFg border-dark2',
  DECAYED:       'PENDING DESIGN — see §13 I-01',
};
```

**Mobile-first.** 430px max play column, never stretched. 44px hit-target floor. Primary actions in the bottom third. Desktop is the adaptation (component sheet §5), not the design.

### 1.6 Config

Every tunable from MECHANICS.md lives in `lib/engine/core/config.ts` as a frozen object the harness can override. Nothing else in the engine hardcodes a number that appears in MECHANICS.md. The act budgets are explicitly **provisional** (MECHANICS.md §10.1) — annotate them as such in the file so nobody treats them as settled.

```ts
export const CONFIG = {
  acts: [
    { pool: 22, solveNodes: 4, mapNodes: 6, maxElites: 1, wordLength: 5 },
    { pool: 19, solveNodes: 4, mapNodes: 6, maxElites: 2, wordLength: 5 },
    { pool: 17, solveNodes: 4, mapNodes: 6, maxElites: 3, wordLength: 6 },
  ],
  gauntlet: { pool: 14, words: 5 },      // separate pool, never touches the act pool
  goldPerLeftoverGuess: 10,              // RL.24 The Ledger → 15
  emergencyCosts: [25, 50, 100],
  rewards: { word: [15, 25], elite: 40, boss: 60 },
  minNetGuessesPerWord: 1,               // MECHANICS §2.4 Rule A
  preGuessRevealCap: 2,                  // MECHANICS §6.3
  consumableSlots: 3,
  shopArchetypeFloor: 0.25,              // MECHANICS §6.4
  nodeWeights: { WORD: 0.55, ELITE: 0.15, SHOP: 0.12, FORGE: 0.10, EVENT: 0.08 },
} as const;
```

---

## 2. Engine architecture

### 2.1 One pure function

```ts
function reduce(state: GameState, action: Action): {
  state: GameState;
  events: GameEvent[];     // narration for the UI to animate
  error?: EngineError;     // invalid action; state returned unchanged
};
```

Every change — a guess, a purchase, a relic firing, a death — goes through this. The UI never computes a rule. The harness never touches the UI. Save is `JSON.stringify(state)`.

`GameEvent` is narration only. It exists so the UI can drive the animation ledger (component sheet §3) and the hook→repaint map (§4). Replaying events must never be needed to reconstruct state; state is already correct when `reduce` returns. This is what makes the design's frame-ordering requirements implementable — *"Tin Cup's +5g must land on the same frame as the pool decrement"* is satisfied by emitting `POOL_CHANGED` and `GOLD_CHANGED` in the same event batch and having the UI drain a batch atomically.

### 2.2 State

```ts
interface GameState {
  version: number;
  seed: string;                      // 8 base32 chars, no 0/O/1/I. Stamped in chrome, held all run
  characterCode: 'CH.01' | 'CH.02' | 'CH.03';
  phase: RunPhase;

  actIndex: 0 | 1 | 2;
  pool: number;
  poolMax: number;                   // act base + character modifier + relic modifiers
  gold: number;
  emergencyPurchasesThisAct: number;

  relics: RelicInstance[];           // acquisition order — load-bearing for §6.3 and hook order
  consumables: ConsumableInstance[]; // cap 3
  map: MapState;
  word: WordState | null;
  gauntlet: { pool: number; wordIndex: number } | null;
  pendingOffer: Offer | null;

  actStartSnapshot: string | null;   // serialized state, for RL.30 Ouroboros
  ouroborosSpent: boolean;
  counters: Record<string, number>;
  stats: RunStats;
}

interface WordState {
  solutions: string[];               // 1, or 2 under Mirror/Twins
  solved: boolean[];
  length: 5 | 6 | 7;
  modifiers: ModifierId[];
  history: GuessRecord[];
  presetTiles: Array<{ index: number; letter: string }>;  // Rosetta / Hot Streak / Skeleton Key
  lockedLetters: string[];           // Locked Key + The Moth, never solution letters
  liarIndex: number | null;
  truthMask: boolean[] | null;       // RL.28 Shaved Coin re-rolls this
  netGuessesSpent: number;           // for the §2.4 Rule A floor
  nodeId: NodeId;
}

interface GuessRecord {
  guess: string;
  raw: FeedbackResult[];             // TRUTH, one per solution. Never mutated.
  turn: number;
}
```

**`raw` is the truth.** Corruption (Liar Letter), identity-withholding (Rangefinder) and time effects (Decay, deferral) are applied downstream from deterministic inputs stored in `WordState`. Replay, Ouroboros restore and bug reproduction all come free, and a corrupted tile can never drift out of sync with the solution. The design's rule — *the view never re-scores* — is satisfied because the view is handed the chain output and renders it verbatim.

### 2.3 Hooks

`HookName` is exactly MECHANICS.md §6.1, no additions except as ruled in §13 I-09:

```
onRunStart  onActStart  onNodeEnter  onWordStart  onGuessSubmit
onFeedbackTransform  onWordSolved  onWordFailed  onActEnd
onGoldChange  onPoolChange  onUse
```

Handlers are **pure functions returning effect data**, not mutating listeners. Same authoring experience, but deterministic and serialisable, which the harness requires.

```ts
type HookHandler<P> = (ctx: HookContext, payload: P) => Effect[];
// ctx = { state: Readonly<GameState>, self: RelicInstance, rng: (i: number) => number }
```

`resolveHook` walks relics in **acquisition order**, then consumables, then modifiers, collecting and applying effects in sequence. Acquisition order is load-bearing twice over: for hook precedence and for information-cap suppression (§13 I-03).

**A relic that cannot be expressed as hooks + effects means the enum is incomplete.** Extend `HookName` or `Effect` and record it. Never special-case a relic inside `reduce`.

### 2.4 Effects

```ts
type Effect =
  | { kind: 'POOL'; delta: number; reason: string }
  | { kind: 'REFUND'; amount: number; source: string }   // NOT 'POOL' — see §3
  | { kind: 'GOLD'; delta: number; reason: string }
  | { kind: 'POOL_MAX'; delta: number; reason: string }  // Rosetta −3, Anvil −1
  | { kind: 'PRESET_TILE'; index?: number }              // index omitted → engine draws
  | { kind: 'LOCK_LETTER'; letter?: string }             // omitted → eligibleLettersForRemoval
  | { kind: 'REVEAL_META'; field: 'vowelCount' | 'hasRepeat' | 'sharedLetter' }
  | { kind: 'GRANT_RELIC'; code: RelicCode }
  | { kind: 'GRANT_CONSUMABLE'; code: ConsumableCode }
  | { kind: 'CONSUME'; instanceId: string }
  | { kind: 'SET_RELIC_STATE'; instanceId: string; patch: Record<string, unknown> }
  | { kind: 'SET_COUNTER'; key: string; value: number }
  | { kind: 'REROLL_TRUTH_MASK' }
  | { kind: 'CLEAR_MODIFIERS' }
  | { kind: 'REVEAL_MAP_MODIFIERS' }
  | { kind: 'FORGE_OPS'; delta: number }
  | { kind: 'END_RUN'; outcome: 'WIN' | 'DEATH'; cause: DeathCause };

type DeathCause =
  | 'POOL_EXHAUSTED' | 'EMERGENCY_DECLINED' | 'EMERGENCY_UNAFFORDABLE' | 'GAUNTLET' | 'EVENT';
```

`REFUND` is deliberately distinct from `POOL`. Refunds are subject to the §2.4 floor rules and must be collected and resolved together; a plain `POOL` delta would bypass them. See §3.

`applyEffect` is the only writer of these fields. `POOL` and `GOLD` effects re-enter `resolveHook` for `onPoolChange` / `onGoldChange` with a recursion depth guard of 8.

### 2.5 Deterministic RNG

MECHANICS.md §9 requires named per-subsystem streams so adding a roll to one subsystem does not shift others. **Address-based draws satisfy this more strongly than streams do:** there is no cursor at all, so adding a relic that rolls dice cannot shift map generation even within the same subsystem.

```ts
function hash32(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export function draw(seed: string, domain: string, index: number): number {
  let a = hash32(`${seed}|${domain}|${index}`);
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
```

Domain strings — use verbatim, they end up in bug reports:

| Domain | Index |
|---|---|
| `map:${act}` | row ordinal |
| `word:${nodeId}` | 0 (reroll +1 on collision) |
| `modifier:${nodeId}` | roll ordinal |
| `offer:${nodeId}` | slot 0–2 |
| `shop:${nodeId}` | slot ordinal |
| `liar:${nodeId}` | 0 |
| `truth:${nodeId}` | reroll ordinal (RL.28) |
| `moth:${nodeId}` | 0 |
| `relic:${instanceId}:${hook}` | turn or word ordinal |

Where no natural index exists, take one from `counters` and bump it via `SET_COUNTER` — visible in state, therefore replayable.

### 2.6 Persistence

`serialize.ts` is pure (strings in, strings out, no browser globals). `lib/persistence/local.ts` is the only file naming `localStorage`, is `'use client'`, and is called only from `useEffect`. Save debounced 250 ms after every successful reduce. A corrupt save is discarded, never fatal.

**Migrations.** `MIGRATIONS` is keyed by the version being migrated FROM, and `migrate` walks a save forward one step at a time. A missing step throws rather than falling through, because handing the game a save it does not understand is worse than refusing it. `SAVE_VERSION` is at **2**: v1 → v2 backfills `ForgeState.candidates`, added by R-035, without which a run saved while standing in a forge would return with every upgrade refused and no way to see why. `actStartSnapshot` is a serialized state string written at `onActStart`; Ouroboros is `JSON.parse` of it with the current relic list retained and `ouroborosSpent: true`.

---

## 3. The pool reducer and the refund floor

MECHANICS.md §2.4 is the single most implementation-sensitive rule in the spec, and it explicitly requires implementation **in the pool reducer, not in individual relics**. `lib/engine/core/pool.ts` is the only module that may change `state.pool`.

```ts
/** Every guess: decrement first, then resolve all refunds together. */
export function spendGuess(s: GameState): { state: GameState; events: GameEvent[] } {
  let next = { ...s, pool: s.pool - 1 };
  next.word = { ...next.word!, netGuessesSpent: next.word!.netGuessesSpent + 1 };

  // Collect refund effects from every source that fired on this event.
  const refunds = collectRefunds(next);            // Effect[] of kind 'REFUND'

  // Rule B — highest only, never summed.
  const best = refunds.reduce((m, r) => Math.max(m, r.amount), 0);

  // Rule A — a word costs at least 1 net guess. Truncate, do not go below.
  const netAfter = next.word!.netGuessesSpent - refundsAppliedThisWord(next) - best;
  const granted  = netAfter < CONFIG.minNetGuessesPerWord
    ? Math.max(0, best - (CONFIG.minNetGuessesPerWord - netAfter))
    : best;

  return applyRefund(next, granted);
}
```

Three things this must get right, all testable:

- **Rule C — free guesses are refunds.** `RL.13` Opening Gambit never skips the decrement. The pool ticks down and back up, visibly, because that is both a balance requirement and the design's legibility requirement (`GUESS COST FLOAT`, 560 ms, fires on `onGuessSubmit` regardless).
- **Rule B applies per event, not per word.** Two refunds triggering on the same solve yield the larger. Two refunds triggering on different guesses each apply.
- **Rule A is per word, cumulative.** Track `netGuessesSpent` on `WordState`, not globally.

Required tests before any refund relic is implemented:

| Case | Expected |
|---|---|
| CH.02 Gambler + RL.11 Flywheel, solve in 3 | +2, not +3 (Rule B; stated in `relics.json`) |
| RL.18 Wishbone refunds every guess, solve in 4 | net spend ≥ 1 (Rule A) |
| RL.13 Opening Gambit on a 1-guess solve | net spend = 1, pool visibly ticks down then up |
| RL.18 + RL.13 both fire on guess 1 | larger only |
| Refunds exceeding spend across a whole word | pool never rises above `poolMax` |

Also enforced here: `pool` never exceeds `poolMax` (RL.27 Vault and CN.03 Decanter both say "does not raise the cap"), and `poolMax` changes from `RL.31` / `RL.09` route through `POOL_MAX` (see §13 I-10 for the mid-act ruling this needs).

---

## 4. Feedback

### 4.1 Base scorer — port, do not rewrite

MECHANICS.md §4.3 is explicit: the prototype's `score()` in `Rougle.dc.html` was fuzzed against an independent reference across 200,000 randomised cases with a reduced alphabet to force duplicate collisions, with zero mismatches. **Port it and keep the test suite.**

Ported, typed, and returning a `FeedbackResult` rather than a `G/Y/X` string:

```ts
export function scoreBase(guess: string, solution: string): FeedbackResult {
  const g = guess.split(''), s = solution.split('');
  const state: TileState[] = g.map(() => 'GREY');
  const left: Record<string, number> = {};
  g.forEach((c, i) => { if (c === s[i]) state[i] = 'GREEN'; else left[s[i]] = (left[s[i]] || 0) + 1; });
  g.forEach((c, i) => { if (state[i] !== 'GREEN' && left[c] > 0) { state[i] = 'YELLOW'; left[c]--; } });
  return {
    tiles: g.map((letter, i) => ({ letter, state: state[i], distance: null, trustworthy: true })),
    meta: { vowelCount: null, hasRepeat: null, revealedLetters: [], deferred: false },
  };
}
```

Verify the port with a differential test against the original JS over the same fuzzing regime before trusting it. Do not skip this because the algorithm looks obviously identical — the point of porting rather than rewriting is that the original is *proven*, and a port you have not differentially tested has thrown that away.

Keep the property test too: for any pair, `count(GREEN of c) + count(YELLOW of c) ≤ count(c in solution)`.

### 4.2 The transform chain

MECHANICS.md §4.4 fixes the order. Implement it as a declared list, not as registration order:

```ts
export const CHAIN: TransformStep[] = [
  { order: 1, id: 'truth-roll',  source: 'RL.28' },  // re-rolls truthMask
  { order: 2, id: 'corruption',  source: 'MOD:LIAR' }, // flips a position, trustworthy: false
  { order: 3, id: 'distance',    source: 'RL.04' },  // YELLOW → distance, letter: null
  { order: 4, id: 'injection',   source: 'RL.31 | RL.12 | CN.05' },
  { order: 5, id: 'deferral',    source: 'MOD:FOG | BOSS:CIPHER' },
  { order: 6, id: 'derivation',  source: 'RL.02' },  // keyboard locks from GREY
];
```

The 1→2→3 ordering is the load-bearing part and MECHANICS.md explains why: corruption runs before interpretation so Rangefinder reads distance off the *reported* state. On a tile where `trustworthy === false`, Rangefinder emits a random distance drawn from the values legal for the reported state — `draw(seed, 'liar:'+nodeId, turn * 10 + tileIndex)`, deterministic, so replay is stable. Get this backwards and the two relics visibly contradict each other, which reads as a bug.

`Tile.letter` is `string | null`. This is load-bearing for Rangefinder and every consumer must handle null — the grid, the keyboard derivation, the solver, and the share-string renderer.

### 4.3 Board projection — the addition the chain needs

The six-step chain is per-guess. **Decay is not per-guess** — it is a function of how many turns have elapsed since a row was scored, so the same row must render differently at turn 3 than at turn 2. It cannot be expressed as a step in a chain that runs once at scoring time, and it is absent from §4.4.

Add one pass, after the chain, over the whole board:

```ts
export function projectBoard(w: WordState, relics: RelicInstance[], turnNow: number): BoardView {
  const rows = w.history.map((rec, turn) => {
    let fb = runChain(rec.raw[0], { w, turn, relics });      // MECHANICS §4.4, steps 1–4, 6
    if (isDeferred(w, turn, turnNow)) fb = withhold(fb);      // step 5, gated by turnNow
    if (hasModifier(w, 'DECAY') && turn < turnNow - 1) fb = decayGreens(fb);  // NEW
    return { guess: rec.guess, fb };
  });
  return { rows, keyboard: deriveKeyboard(rows, w, relics) };
}
```

This is consistent with MECHANICS.md's own framing of deferral — *"the full result is computed and stored; it is simply not shown yet"* — extended to cover Decay, which is the same shape: content computed once, presentation a function of when you look. Fog is `turn === turnNow - 1`; the Cipher boss is the identical mechanism at depth 3. **Implement deferral properly and the Act II boss is nearly free.**

This needs a ruling to become normative — see §13 I-02.

### 4.4 The information cap

MECHANICS.md §6.3: at most 2 pre-guess reveal effects active on any word. `relics.json` flags each with `pre_guess_reveal: true`, so this is data-driven:

```ts
export function activeReveals(s: GameState): { active: string[]; suppressed: string[] } {
  const candidates = [...s.relics, ...s.consumables]
    .filter(i => REGISTRY[i.code].pre_guess_reveal);
  const ordered = orderForSuppression(candidates);   // see §13 I-03 — needs a ruling
  return {
    active: ordered.slice(0, CONFIG.preGuessRevealCap).map(i => i.instanceId),
    suppressed: ordered.slice(CONFIG.preGuessRevealCap).map(i => i.instanceId),
  };
}
```

Suppressed relics render dimmed with a suppression tooltip, which CMP.04 must support as a chip state.

### 4.5 Keyboard

Derived, never stored (design handoff, State rule 2). `deriveKeyboard` folds visible rows into a best-known state per letter. Three separate things remove letters and they must share one predicate, `isLetterAvailable(state, letter)`, which also gates `canDispatch` so a physical keyboard cannot bypass a lock (`relics.json` RL.02: *"locked keys must be unfocusable"*):

- `RL.02` The Sieve — hard-locks proven-GREY letters
- Locked Key modifier — never a solution letter
- `RL.19` The Moth — never a solution letter

**Invariant test:** after all three have applied, every letter of every solution remains typable. This follows from the R-003 rule but must be asserted, because it is the difference between a hard word and an unwinnable run.

Under Mirror, the keyboard shows the **best** state across both solutions (MECHANICS.md §7.1).

---

## 5. Map generation

MECHANICS.md §3.1 requires **exactly 4 solve nodes on every legal path** through 6 nodes, plus at least 1 shop, at least 1 forge-or-event, no two shops adjacent, no elite immediately before the boss, and per-act elite caps.

"Draw against weights, then repair" does not reliably satisfy a per-path invariant in a DAG — repair on one path breaks another, and rejection sampling on a constraint this tight is slow and can fail to terminate. Generate by construction instead:

```
1. Rows 1–6. Choose 2 rows to be SERVICE rows; the other 4 are SOLVE rows.
   Constraint: the two service rows are non-adjacent, and row 6 is never service
   (the pre-boss node is a solve node, and never an elite).
2. Every node in a SOLVE row is WORD or ELITE, drawn against the renormalised
   weights, subject to the act's elite cap and the row-6 no-elite rule.
3. Every node in a SERVICE row is SHOP, FORGE or EVENT, renormalised. At least
   one shop across the two rows — if neither drew one, force the earlier row's
   first node to SHOP.
4. Each row holds 2–3 nodes. Edges connect row r to r+1 at adjacent-or-equal
   column indices, with every node in r+1 reachable.
5. Assert: every path from row 1 to boss has exactly 4 solve nodes. True by
   construction — assert it anyway, as a regression guard.
```

Every constraint in §3.1 is then satisfied structurally rather than by repair. "No two shops adjacent" holds because the service rows are non-adjacent. The elite cap is checked while drawing. Route choice stays meaningful because the branching lives *within* rows: which elite, which modifiers, shop versus forge versus event.

Regenerate with `index + 1000` on any assertion failure — bounded, deterministic, and the retry is itself reproducible.

**Route meaningfulness** (design handoff S.03: *"the player picks the path, not just the next step"*) should be a generation-time constraint: reject maps where all paths score within 15% on a crude risk (elites + modifier count) versus reward (gold + service access) measure. Costs nothing at runtime, and is testable.

---

## 6. Content as data

`relics.json` is normative and must never be transcribed into TypeScript. `lib/engine/content/registry.ts` loads it, validates it, and pairs each entry with an implementation module keyed by code.

```ts
// One module per code. The JSON owns the rule; the module owns the mechanism.
// lib/engine/content/impl/RL.11.ts  — FLYWHEEL
export default {
  hooks: {
    onWordSolved: (ctx, p: { guessesUsed: number }) =>
      p.guessesUsed <= 3 ? [{ kind: 'REFUND', amount: 1, source: 'RL.11' }] : [],
  },
} satisfies RelicImpl;
```

**Validation runs as a test, not at runtime.** `registry.test.ts` must assert:

1. Every `relics.json` code has exactly one implementation module.
2. Every implementation module corresponds to a code in `relics.json`.
3. Every `hook` value is a member of `HookName`.
4. Every `anti_synergy` and `synergy` code reference resolves.
5. Every `transform_order` is unique among relics that declare one.
6. Every `rarity` is in the declared rarity list; `CONSUMABLE` appears only under `consumables`.
7. Every relic with `pre_guess_reveal: true` is in the §6.3 affected list, and vice versa.
8. Every `ruling` reference (`R-001` …) resolves to a section in MECHANICS.md §11.

This is the mechanism that stops the data and the code drifting, which on a project with 31 relics across three documents is otherwise certain.

Relic state (Hot Streak's counter, All In's wager, Insurance's per-act flag) lives in `RelicInstance.state`, written only via `SET_RELIC_STATE`. Never module-level variables — those break save/load and break a harness running thousands of runs in one process.

Consumables (`CN.xx`) are a separate class: not relics, no relic slot, cap 3, consumed on use, fired through `onUse`. `relicSkin()` needs a `CONSUMABLE` branch (R-010, design bug already filed).

---

## 7. Bosses

All three reuse mechanisms built earlier. None should need bespoke rules code.

- **Twins (Act I)** — Mirror. Two solutions, each guess produces two fully independent `FeedbackResult` objects, each running the chain independently. Two rows rendered. No merging. Keyboard shows the best state across both. Solving one locks its row.
- **Cipher (Act II)** — deferral at depth 3 instead of Fog's 1. Same code path.
- **Gauntlet (Act III)** — five words on a **fixed separate pool of 14** which neither draws from nor converts into the act pool. `state.gauntlet` holds it. No shop, forge or reward between words. See §13 I-05: the budget needs simulation and the word length needs a ruling.

---

## 8. Word lists

Build-time, not runtime. `scripts/build-wordlists.ts` runs offline against a source word list and a corpus frequency list, and commits its output to `/data`.

```
raw → length filter → VALID_GUESSES (~13k at length 5)
    → top ~8000 by corpus frequency
    → strip proper nouns / archaic
    → remove ambiguity clusters      ← the important step
    → manual denylist
    → SOLUTIONS (~1500 / ~800 / ~500)
```

MECHANICS.md §8.1's rule — clusters where ≥4 candidates share ≥4 positions — is a one-wildcard bucket:

```ts
function clusters(words: string[], threshold = 4): Set<string> {
  const buckets = new Map<string, string[]>();
  for (const w of words)
    for (let i = 0; i < w.length; i++) {
      const key = w.slice(0, i) + '_' + w.slice(i + 1);   // "_atch", "l_ght"
      const b = buckets.get(key) ?? []; b.push(w); buckets.set(key, b);
    }
  const out = new Set<string>();
  for (const [, ws] of buckets) if (ws.length >= threshold) ws.forEach(w => out.add(w));
  return out;
}
```

Excluded words remain legal guesses. `_ATCH` and `_IGHT` both exceed the threshold and both leave. Expect 200–400 removals at length 5; more than ~800 means the frequency band is too wide. The script emits its removal report for review, as §8.1 requires.

At 6 and 7 letters, raise the threshold to 5 — longer words have more distinguishing positions, so the same threshold over-prunes an already thin list.

---

## 9. Simulation

Built in Phase 1, not Phase 5. MECHANICS.md §10.1 is unambiguous that every budget in §2.2 is provisional until this runs.

**Solver:** entropy-maximising. Precomputed opener per word length, candidate filtering by feedback consistency, next guess by expected information over the top 200 candidates by frequency when the set is large.

**Policies against adversarial feedback** — declare these or the numbers are meaningless:

- *Liar Letter:* solver assumes truth; when the candidate set empties, relax the most recent constraint. Models a human badly but consistently, which is what balance work needs.
- *Rangefinder:* a distance with `letter: null` is a genuine constraint (some letter of the solution sits N positions from here) — the solver must model it as such, or it will systematically under-rate the relic.
- *Deferral:* treat `HIDDEN` rows as unconstrained.
- *Decay:* the bot has perfect memory and pays no Decay cost. **Flag this in every report.** Decay is a memory tax on humans only, so simulation will systematically overrate the player on Decay words. Do not tune Decay from sim data.

**The offset.** MECHANICS.md §10.2 requires tuning to the human baseline (3.9) rather than the bot's (3.4), applied explicitly. Implement it as a handicap rather than a constant:

```ts
interface SolverConfig {
  suboptimality: number;   // p of taking the 2nd-best guess
  memoryDecay: number;     // p of forgetting a decayed green
  vocabularyGap: number;   // fraction of SOLUTIONS the bot pretends not to know
}
```

Calibrate `suboptimality` once until mean guesses/word on clean 5-letter words is 3.9, commit the value with the run that produced it, and sweep at that setting. Also sweep at `suboptimality: 0` for the ceiling. Balance to the band.

**Report** against MECHANICS.md §10.3, plus the co-occurrence tracking `relics.json` asks for (`RL.21` All In with `RL.04`/`RL.07`; `RL.30` Ouroboros with `RL.20`/`RL.21`):

| Metric | Target |
|---|---|
| Win rate, calibrated handicap | 25–35% |
| Win rate, no relics | <5%, dying in Act II |
| Deaths from word-list luck | <5% |
| Act I death rate | <15% |
| Median run length | 20–30 min |
| Emergency purchases per run | >0 median (the ladder should bite) |
| Flagged co-occurrences | no pair >15pp above baseline win rate |

Snapshot to `docs/balance/NNN.json` each tuning pass so regressions show up in diffs.

---

## 10. UI contract

The design handoff owns every visual value. Engineering owns four things it depends on:

1. **The view never re-scores.** `projectBoard` output is rendered verbatim. Keyboard state derives from the same payload. If the view scores anything, Liar Letter breaks.
2. **Letter state is derived, never stored.** Recomputed from history on each feedback event.
3. **Event batches drain atomically.** The hook→repaint map (component sheet §4) contains frame-ordering requirements — Tin Cup's +5g landing on the same frame as the pool tick — which are satisfied by emitting both events in one `reduce` return and draining a batch as a unit.
4. **The grid accepts pre-set tiles at mount** (MECHANICS.md §4.5), not only after a guess resolves. Rosetta, Hot Streak and Skeleton Key all depend on this.

`prefers-reduced-motion` collapses durations to 1 ms and stops loops; **state still changes**, because motion is never the only carrier of information. Wired as the `reducedMotion` prop.

Skip-animations toggle: the harness wants it and so do impatient players.

---

## 11. Build order

Phases follow MECHANICS.md §13. Each ends in a gate with a yes/no answer.

### Phase 0 — Scaffold

| ID | Ticket | Done when |
|---|---|---|
| S-01 | Next App Router + TS strict + `output: 'export'` + `@/*` alias | `/` and `/play` render from a static export |
| S-02 | NIKOLASS tokens imported in documented order, `data-theme="dark"` pinned, Tailwind themed from tokens (§1.5) | A hex literal in `/components` fails review; no theme toggle exists |
| S-03 | Vitest against `lib/engine` and `sim`, no Next transform | `npm test` passes with the dev server stopped |
| S-04 | ESLint boundary rules incl. `next/*` ban (§1.3) | Importing `next/navigation` into the engine fails lint |
| S-05 | CI job: `npx tsx sim/harness.ts --runs 50`, no Next build | Passes; it is the canary for boundary violations |
| S-06 | `GameShell` client boundary + `BootSplash` hydration pattern | No hydration warning on cold load or reload-with-save |
| S-07 | Commit MECHANICS.md + relics.json at root, design bundle at `design/`, briefs at `docs/`; archive the v0 brief and technical brief v1 | Repo has one canonical rules doc; every cross-reference in §0 resolves |

### Phase 1 — Rules core

| ID | Ticket | Done when |
|---|---|---|
| E-01 | Port `score()` from `Rougle.dc.html`; differential-test against the original over the same fuzzing regime | 200k randomised cases, reduced alphabet, zero mismatches; property test passes |
| E-02 | `FeedbackResult` / `Tile` types with `letter: string \| null`; deep-freeze in dev | A transform mutating its input throws in dev |
| E-03 | Address-based RNG + domain conventions (§2.5) | Same address returns the same float across processes |
| E-04 | `GameState`, `Action`, `Effect`, `applyEffect` + recursion guard | Every effect variant unit-tested; depth >8 caught |
| E-05 | `reduce` skeleton + `canDispatch` | Invalid actions return unchanged state and an error, never throw |
| E-06 | **Pool reducer + §2.4 refund floor** (§3) | All five refund-floor cases pass; `pool` never exceeds `poolMax` |
| E-07 | `resolveHook` with acquisition-order determinism | Two relics on one hook fire in acquisition order, provably |
| E-08 | Transform chain, steps 1–6, order declared not registered (§4.2) | Liar+Rangefinder interaction test: corrupted tile yields a legal-looking distance |
| E-09 | `projectBoard`: deferral gating + Decay (§4.3, pending I-02) | Fog hides row n until n+1; Cipher at depth 3 reuses it; Decay reverts greens |
| E-10 | Emergency ladder 25/50/100, mandatory offer, death causes | Offer always shown before death; `DeathCause` correct in every branch |
| E-11 | `relics.json` registry loader + all eight validation tests (§6) | Adding a code to JSON with no impl fails CI |
| E-12 | Word list loader, guess validation, `isLetterAvailable`, solution-typable invariant | Physical keyboard cannot bypass a Sieve lock |
| E-13 | Pure serialize/deserialize/migrate + client `local.ts` | Mid-word round-trip byte-identical; `localStorage` in exactly one file |
| E-14 | Debug view: state dump, guess input, feedback render, pool readout | A word is playable end to end with zero styling |
| H-01 | Entropy solver with the §9 adversarial policies | Solves 1000 clean words at mean ≤3.5 |
| H-02 | Headless harness + §10.3 report | `--runs 1000` completes under 2 minutes |
| H-03 | Handicap calibration to 3.9 | Value committed to `sim/calibration.json` with its run |

**Gate 1:** *Does the harness play 1000 seeded runs headlessly with a stable guesses-per-word number?* If it moves between identical runs, determinism is broken. Everything downstream is invalid until it is fixed.

### Phase 2 — Single act, linear

| ID | Ticket | Done when |
|---|---|---|
| V-01 | Linear 4-word act, pool 22, no branching | Four words in sequence, pool carries |
| V-02 | CMP.02 tile (all states), CMP.03 keyboard, grid, S.04 layout | Matches the component sheet at 430px |
| V-03 | CMP.01 pool meter, number + pips, critical ≤5 | Elastic `max` per §13 I-13; flicker respects reduced-motion |
| V-04 | Five relics from the registry: RL.01, RL.02, RL.11, RL.23, RL.18 | Each has a hook test; each renders as a CMP.04 chip with tooltip |
| V-05 | S.05 relic reward, 1 of 3 | Offers seeded and reproducible |
| V-06 | Act end: leftover → gold, CMP.10 receipt | Conversion legible as a trade, per the motion ledger |
| V-07 | Save/resume mid-act | Hard refresh resumes same row, same board, no hydration mismatch |
| V-08 | Event queue, atomic batch drain, skip toggle | Spamming submit cannot desync; Tin Cup gold lands on the pool-tick frame |
| V-09 | Static export deployed | Five people outside the team play the built output |

**Gate 2 — the one that matters:** *Is the shared pool tense?* Success: playtesters check the pool before choosing a guess and describe a pressure moment unprompted. Failure: they do not notice the pool, or report "just Wordle four times." The fix is the economy or the meter, **never more content**. Do not start Phase 3 on a failed Gate 2. An agent cannot answer this gate — humans must play it.

### Phase 3 — Run structure

| ID | Ticket | Done when |
|---|---|---|
| R-01 | Row-class map generation (§5) | 10k seeded maps: every path has exactly 4 solve nodes, all §3.1 constraints hold |
| R-02 | Route-meaningfulness constraint | Risk/reward spread test passes over 1000 maps |
| R-03 | S.03 act map, CMP.05 nodes | Route selectable by keyboard |
| R-04 | Three acts, transitions, refill, `actStartSnapshot` | Snapshot restores byte-identically |
| R-05 | Node dispatch: word / elite / shop / forge / event | Each routes and returns to the map |
| R-06 | Gold economy, all sources and sinks logged with reasons | Gold never negative |
| R-07 | S.06 shop + §6.4 weighting + consumables (cap 3) | Archetype floor holds over 10k offers |
| R-08 | S.07 forge: upgrade or gold→guesses | Both branches; RL.09 Anvil grants two operations |
| R-09 | Emergency purchase UI; RL.25 Insurance | Ladder resets per act; R-012 death-screen wiring verified |
| R-10 | Information cap §6.3 + suppression chip state (pending I-03) | Cap of 2 enforced; suppressed chips dim with tooltip |

**Gate 3:** *Does a no-relic bot die in Act II?* If it clears Act II, the budgets are too generous and §2.2 needs revision before content is built on top of it.

### Phase 4 — Content

| ID | Ticket | Done when |
|---|---|---|
| C-01 | `build-wordlists.ts`, 5-letter lists, removal report reviewed by hand | ~1500 / ~13k |
| C-02 | 6- and 7-letter lists, threshold 5, lazy-loaded via dynamic import | ~800 / ~500; not in the initial bundle |
| C-03 | All 9 modifiers + stacking exclusions | `Long + Liar + Decay` integration test plays to a solve |
| C-04 | Remaining INFO + TEMPO relics | Each hook-tested; none needs a reducer special-case |
| C-05 | Remaining RISK + GREED + ROUTE relics | As C-04; RL.30 Ouroboros verified against snapshot restore |
| C-06 | Player-activated relics (pending I-09): RL.07, RL.20, RL.21, RL.28, CH.03 | Activation legal only when the rule allows; caps enforced |
| C-07 | Consumables CN.01–CN.05 + `relicSkin` CONSUMABLE branch | R-010 closed |
| C-08 | Three bosses; S.09 intros; CMP.11 ticker | Twins reuses Mirror, Cipher reuses deferral at depth 3, Gauntlet on its own pool of 14 |
| C-09 | Three characters, innates as hidden registry entries | CH.02 + RL.11 yields 2, not 3 |
| C-10 | Ten events, deferred-consequence support | Unaffordable choices disabled, never hidden |
| C-11 | Copy fixes: R-009 (twenty), R-012 (death screen), R-002 (CMP.02 rangefinder glyph), R-013 (regenerate bundle) | All four design bugs closed |

**Gate 4:** *Is every relic implementable as data + hooks + effects?* If any needed a reducer special-case, the enum is incomplete — extend and refactor now, before Phase 5 bakes the shortcut in.

### Phase 5 — Balance

| ID | Ticket | Done when |
|---|---|---|
| B-01 | Full `RunStats` telemetry + committed snapshot format | Every §10.3 metric from one command |
| B-02 | Act budget sweep against §2.2 | Targets met, or §2.2 revised with an ADR |
| B-03 | Relic pick rates + flagged co-occurrence audit (RL.21, RL.30) | No pair >15pp above baseline |
| B-04 | Word-luck death audit | <5%, or curation tightened and re-run |
| B-05 | Gauntlet budget validation (§13 I-05) | 14 confirmed or revised on data |
| B-06 | Twins word-equivalent measurement (§13 I-04) | §2.2's Act I figure confirmed or corrected |
| B-07 | Long-word layout verification at 6 and 7 tiles (§12 open Q2) | Verified on a real device, not a resized desktop window |
| B-08 | Low-pool flicker playtest (§12 open Q3) | Duration decided on irritation, not accessibility |
| B-09 | S.12 victory: receipt, build, shareable seed | Pasting the seed reproduces the run |

**Gate 5:** *Do simulated numbers and playtested feel agree?* A 30% simulated win rate against a 5% playtested one means the handicap calibration is wrong. Fix calibration before touching the game.

---

## 12. What to build first

**E-01, E-03, E-06, H-01** — the ported scorer, the RNG, the pool reducer with the refund floor, and the solver. No UI, no Next, testable in isolation, and together they are the load-bearing third of the project. They also answer the only question answerable before anything is playable: whether the provisional budgets in MECHANICS.md §2.2 are reachable at all.

Everything else is downstream of those four being correct.

---

## 13. Engineering problems requiring rulings

Found while reading MECHANICS.md v1.0, `relics.json` and the design bundle. Nine need a decision before the affected ticket can be built; five are flags for simulation or design. Each should become an ADR or a MECHANICS.md §11 ruling.

### Needs a rules decision

**I-01 · Decay has no tile state.** MECHANICS.md §4.2 defines `UNKNOWN` and §5 says Decay reverts GREEN → UNKNOWN. CMP.02 specifies eight states: EMPTY, TYPED, ABSENT, PRESENT, CORRECT, RANGEFINDER, UNTRUSTWORTHY, DEFERRED/FOG. **None of them is UNKNOWN.** Rendering a decayed green as TYPED makes a submitted row look unsubmitted. → *Design bug: CMP.02 needs a ninth specimen.* Blocking E-09 and C-03.

**I-02 · Decay is missing from the transform order.** §4.4's six steps are all per-guess. Decay is a function of elapsed turns, so the same stored row must render differently at turn 3 than at turn 2 — it cannot be a step in a chain that runs once at scoring time. → *Proposed:* adopt §4.3's projection pass as normative, framed exactly as §4.4 already frames deferral: content computed once, presentation a function of when you look. Blocking E-09.

**I-03 · The information cap's suppression order is a trap.** §6.3 suppresses excess pre-guess reveals in acquisition order, earliest wins. `RL.31` Rosetta Slab is a BOSS relic that **costs −3 act pool**. A player holding Lexicon and The Concordance from Act I who then takes Rosetta pays the −3 and receives nothing, permanently. → *Proposed:* suppress by ascending rarity, ties broken by earliest acquired, so a BOSS relic always displaces two COMMONs. Alternatively let the player choose the active two from the drawer, which is better but costs UI. Blocking R-10.

**I-04 · RULED (R-015). Five relics are player-activated and no hook covers activation.** `RL.07` The Auditor is listed as `onGuessSubmit` but its rule is *"once per word, at any time."* Same shape: `RL.20` Blindfold (opt in before submitting), `RL.21` All In (wager before a word), `RL.28` Shaved Coin (once per word), `CH.03` The Cryptographer (any time). `onUse` exists but `relics.json` scopes it to consumables. → **Ruled** as proposed: `onUse` is open to relics declaring an `activation` block, and the engine owns timing, the use cap and the cost (MECHANICS.md §6.6). All five are implemented. See ADR-0008.

**I-05 · RULED (R-016). `RL.28` Shaved Coin is dead outside Act III.** It re-rolls which positions report truthfully. Nothing reports untruthfully unless Liar Letter is active, and Liar Letter is Act III only. A RARE relic offered in Acts I–II therefore does nothing for most of a run. → **Ruled:** withheld from the offer pool until Act III via `offer_from_act`. A relic that does nothing is a worse reward than a relic you were not offered, and a second clause would change what the relic is.

**I-06 · RULED (R-017). `RL.20` Blindfold's "within one letter" was undefined.** → **Ruled:** Hamming distance ≤ 1. Guess and solution are always the same length, so at most one position may differ; transpositions do not count. `hammingDistance` in `core/letters.ts` is the single home for it.

**I-07 · Pool-max reductions acquired mid-act.** `RL.31` Rosetta (−3) and `RL.09` The Anvil (−1) reduce the act pool. Applied immediately — which can kill a player at low pool the moment they take a reward — or at next act start? → *Proposed:* apply immediately, clamped so `pool` never drops below 1; any unapplied remainder is lost rather than deferred. Blocking C-05.

**I-08 · Gauntlet word length is unspecified.** §7.3 gives it 5 words and a fixed pool of 14 — 2.8 guesses/word. §2.2 puts Act III solve nodes at long words. If the Gauntlet is also 6–7 letters, 2.8 against a stated 4.6 human baseline is close to unwinnable. Needs both a length ruling and simulation before 14 is accepted. Blocking C-08 and B-05.

**I-09 · `RL.02` / `RL.04` anti-synergy looks overstated.** `relics.json` says *"Rangefinder withholds letter identity, so there is nothing for the Sieve to eliminate."* But Rangefinder nulls the letter only on YELLOW tiles (§4.4 step 3), and the Sieve locks **GREY** letters, which keep their identity. Mechanically they do not conflict. → Either the anti-synergy tag is wrong, or Rangefinder is intended to null greys too — which would be a much stronger drawback. Needs clarification before either is implemented. Blocking C-04.

### Flags, not blockers

**I-10 · MEASURED. Twins is counted as 2 word-equivalents.** Confirmed: 5.20 guesses against the ~7.8 two independent words would cost. Information is shared exactly as predicted. But the measurement also found what the estimate hid — as the Act I boss the Twins ended **20.5% of all runs**, half of every death in the game, because the *variance* landed on a wall at the end of the shortest act. Resolved by R-019 (see I-21).

**I-11 · `RL.30` Ouroboros and `actStartSnapshot` interact with the info cap.** Restoring an act-start snapshot restores the relic list as it was, but Ouroboros says relics are retained *as they are now*. Which acquisition order survives determines which reveals are suppressed under §6.3. Pick one, write it down, test it.

**I-12 · Three separate systems remove keyboard letters.** Sieve, Locked Key and The Moth. R-003 guarantees none removes a solution letter, so the solution stays typable — but this must be an asserted invariant (E-12), not an assumed one. It is the difference between a hard word and an unwinnable run.

**I-13 · Pool meter elasticity** (§12 open Q1). Engineering answer: `max` is already a prop and CMP.01 takes `value:int · max:int`, so rendering 17, 19 or 22 pips is free. The open question is only whether 17 pips *read* the same as 24. Not blocking; decide on the built component, not in the abstract.

**I-14 · `relics.json` codes RL.08 and RL.17 are absent.** Consistent with R-011 (codes are opaque, gaps are fine). Noted only so nobody "fixes" it. The registry validator asserts nothing about contiguity.
→ **Closed by R-020.** Both gaps are now filled — `RL.08` The Fence and `RL.17` The Holdout, built on the §2.5 reveal ladder. The registry validator still asserts nothing about contiguity; the test that named these two codes was rewritten to assert the rule instead, since it would otherwise fail every time R-011 was correctly followed.

### Found while building — Phase 1

Full argument for each in `docs/decisions/ADR-0006`. Three were fixed in code
because a run cannot proceed without a fix; the fix is stated so a ruling can
overturn it.

**I-15 · `RL.27` The Vault cannot be implemented as written.** The pool refills to `poolMax` at act start and `pool` never exceeds `poolMax`, so a carry has nowhere to go and a RARE relic does nothing. Needs a ruling on whether the carry raises that act's cap. Blocking C-05; `refillPool` deliberately takes no carry parameter.
→ **Ruled (R-024).** `poolMax` governs the refill at act start and is not a ceiling; the pool may sit above it. Building the §6.7 forge showed the fault was never about the Vault: `addPool` clamped every positive delta, so the forge conversion, `CN.03` The Decanter, `EV.05` The Infirmary, `RL.20` Blindfold's payout and `EV.08`'s revival were all silently inert at full pool too. Six mechanics, one clamp. `RL.27`'s "Does not raise the act cap" is now literally true and no longer self-defeating.

**I-16 · Rule A truncation kills `RL.13` and `RL.19`.** Applied at the moment a refund fires, the floor truncates any refund on guess 1 to nothing — so Opening Gambit, whose whole rule is "your first guess is refunded", never refunds, and The Moth eats a letter for free. Rule A is stated per word, not per guess. → *Implemented provisionally:* the shortfall is queued on `WordState.pendingRefunds` and retried on later guesses of the same word. ADR-0005.

**I-17 · Silent Start has no slot in §4.4, and its rule is ambiguous.** It alters feedback, so it is a transform, but the six-step chain has no place for it; and "returns GREY only; no yellows" does not say whether greens survive. → *Implemented as* declared step 0 (`suppression`), yellows→grey, greens kept.

**I-18 · Three ways for The Sieve to lock a letter the solution needs.** R-003 protects The Moth and the Locked Key modifier but not `RL.02`, and a GREY can appear on a solution letter through Liar Letter corruption, Silent Start suppression, or a decayed GREEN in the duplicate-letter case. Each produces an unwinnable word; all three were reproduced by the harness. → *Fixed in code* — proven-grey requires an honest, untainted observation and reads the undecayed projection — but the general principle belongs in MECHANICS.md §11 next to R-003.

**I-19 · Under Mirror, which solution does a pre-guess reveal describe?** Lexicon reports "how many vowels the answer holds" and the Twins has two answers. Applying solution A's reveal to solution B eliminates the real answer on turn one; this presented as an unbeatable Act I boss. → *Implemented as* "solution A only", in the engine and in the solver's model. Not blocking, but it changes what the Twins costs.

**I-20 · Character innates are missing from §6.3's affected list.** `relics.json` marks `CH.01` The Linguist `pre_guess_reveal: true`, but §6.3's prose lists only relics. A Linguist holding Lexicon and Palimpsest is already at the cap. → *Implemented per the data*, which is normative; the prose list is what needs updating.

**I-16 · RULED (R-018).** Rule A binds the word's total, as §2.4 already said. The carry stands.

**I-17 · RULED (R-028).** Silent Start's chain slot was already settled — declared step 0, `suppression`, shared with RL.20 Blindfold. The rule is now settled too: greens survive, only yellows are suppressed. Found from playtest because the banner printed the opposite reading and a green on row one looked like a scoring bug.

**I-18 · RULED (R-014).** Generalised from R-003: no mechanic may remove a letter the current solution needs, by any route. A lock derived from feedback must rest on an honest, uncorrupted, unsuppressed observation.

**I-19 · RULED for preset tiles, implemented-only for the rest.** R-036 puts the solution a preset describes on the preset itself (`solutionIndex`), so a §2.5 reveal is solution A's, is labelled `A`, and can never be shown against B. The remaining `revealed` fields — vowel count, repeat flag, named letters — are still "solution A only" by implementation rather than by rule.

**I-23 · Forge upgrades did not exist.** The design showed per-relic upgrade text for three relics and `relics.json` had no field for it, so a Forge node had nothing to offer and R-08 could not be built.
→ **Ruled (R-021).** MECHANICS.md §6.7. Every relic carries exactly one `MK.II`, in `relics.json` under `upgrade`, on one of five recorded axes. Consumables are not upgradeable.

**I-25 · R-025 traded gold tension for word-luck deaths.** Halving relic count (~15 a run to ~8) is what made gold matter, and it worked: gold left unspent fell from 671 to 312 and deaths-with-money-in-hand from 99.1% to 63.1%. But **word-luck deaths went from 8.1% of deaths to 33.7%** against a §10.3 target of under 5%. Fewer relics means less information, and a third of deaths are now ones where the answer was still in the candidate set with no way to narrow it. That is the cost of the trade showing up in the metric built to catch it. → **Not ruled.** It needs a decision about where information comes from once relics are scarcer — a cheaper first rung on the §2.5 ladder, a higher INFO weighting in shop stock, or an accepted looser target. Do not tune it by reverting R-025; the economy it fixed was the larger fault.

**I-26 · A held row and an all-absent row look nearly identical.** Found while verifying R-034 in a browser. `DEFERRED` is `bg-sunken` (#141414) with a #4A4A48 glyph and `ABSENT` is `bg-absent` (#1C1C1B) with `text-fg3`; at tile size the two are a shade apart, so a row the engine is withholding reads as a row that came back with nothing in it. That is the R-029 failure in visual form — a withholding presenting as a claim — and R-034's badge marks the row without fixing the tile. → **Not ruled.** It needs a CMP.02 decision, because the obvious separators are taken: dashed borders belong to `DECAYED` (§13 I-01) and horizontal scanlines to untrustworthy. Not blocking; the badge carries the meaning for now.

**I-27 · RESOLVED. The solver modelled a rule the engine no longer had.** R-029 changed Silent Start's suppression from `GREY` to `UNKNOWN`, and the solver's consistency check had one reading of `UNKNOWN` — a Decay-faded `GREEN`. So on the first guess of every Silent Start word it required that position to be green, eliminated the true answer, and burned the pool failing to solve a word it had already ruled out. Every sweep between R-029 and balance snapshot 004 reported it as the GAME getting harder: 43.7% → 21.7% win rate, 9.8% → 44.7% Act I deaths, all of it the bot. → **Fixed**: on a Silent Start row `UNKNOWN` means the true state is `YELLOW` (the strongest constraint on the row) and `GREY` is an ordinary grey, since suppression no longer lies. The standing rule this leaves: **a rules change that alters which feedback states the engine can emit is not done until the solver models it** — otherwise the next sweep describes the bot while appearing to describe the game.

**I-28 · RESOLVED. `--no-reveals` was accepted and ignored.** `RunOptions.noReveals` existed and `runner` honoured it, but `parseArgs` never read the flag and `sweep` typed its options as `{ noRelics?: boolean }`, so every "with reveals vs without" comparison anyone ran was the same sweep twice — including the 58.5%/32.8% figures the report prints as a caveat on its own win rate. → **Fixed**: the flag is parsed and `sweep` takes `RunOptions`. It is what made R-036's cost measurable at all.

**I-29 · RESOLVED. The word-luck metric merged a coin-flip with a budget death.** `wordLuckDeathRate` counted every death where the answer was live and 2+ candidates remained. Over 607 deaths that put 27.3% of real §8.1 coin-flips (2–5 near-twins) in the same bucket as 37.9% of "the pool ran out while the field was still wide", over half of the latter at the 20-candidate cap. The two move in OPPOSITE directions under tuning: tightening a pool kills more runs early with the field wide, so the metric that indicts the WORD LIST rises when the BUDGET changes — and §10.3 reads that number to say "fix the list, not the budget". Snapshot 005's 74.5% would have launched a curation pass at a budget problem. → **Fixed**: bounded to 2–5 candidates (`WORD_LUCK_MAX`), with wide-field deaths reported on their own line. Word luck reads 28.9% at snapshot 006's pools. The standing rule: **a metric that changes when you tune the thing it is meant to exonerate is measuring the wrong quantity.**

**I-24 · Events did not exist.** v0 named them only in the node-weight table; the design contained one. A node type with a single piece of content repeats inside one run, which the draw rule forbids.
→ **Ruled (R-022).** MECHANICS.md §6.8 and `events.json`. Twelve events, drawn without replacement, `acts` gating eligibility and `requires` gating individual options.

**I-20 · RESOLVED in favour of the data.** `isPreGuessReveal` covers relics, consumables and character innates alike; §6.3's prose list is what needs updating.

**I-21 · One node still ends a third of all runs.** R-019 moved the Twins to Act II and Act I deaths fell from 20.8% to 3.9% — inside the §10.3 target for the first time. But the spike relocated rather than dissolved: the Twins now ends **37.8%** of runs. A death there is a fairer death — the player has a built deck and chose to walk into it — but one node ending more than a third of runs should not be permanent. Giving it the Gauntlet's own-pool pattern was measured and rejected (that pattern removes the emergency ladder; 74.8% died). Not blocking; the next candidate is an emergency-ladder reset at the boss, which needs a rules decision.

**I-22 · The harness does not fire activations.** The solver holds RL.07, RL.20, RL.21, RL.28 and CH.03 without using them, so their pick rates and their contribution to the win rate are understated, and RL.21's flagged co-occurrence with RL.04/RL.07 cannot be measured at all. The report says so with every sweep. Not blocking; it is solver work, not rules work.
