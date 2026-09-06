import { BOSSES } from '../content/bosses';
import { rollModifiers } from '../content/modifiers';
import type { GameConfig } from '../core/config';
import { DOMAIN, drawInt, drawWeighted } from '../core/rng';
import type { MapNode, MapState, NodeId, NodeKind } from '../core/state';

/**
 * R-01 — row-class act generation (technical brief §5).
 *
 * MECHANICS.md §3.1 asks for exactly 4 solve nodes on EVERY legal path through
 * a branching DAG, plus five other constraints. Drawing against weights and
 * repairing does not reliably deliver a per-path invariant: a repair on one
 * path breaks another, and rejection sampling on a constraint this tight is
 * slow and can fail to terminate.
 *
 * So the shape comes first and the weights fill what is left. Rows are typed
 * before their contents: four SOLVE rows and two SERVICE rows. Every path
 * crosses every row exactly once, so "4 solve nodes per path" is true by
 * construction rather than by checking. The other constraints fall out of the
 * same choice — "no two shops adjacent" holds because the service rows are
 * non-adjacent, and the pre-boss node cannot be a service node or an elite
 * because row 6 is always SOLVE and excluded from the elite draw.
 *
 * What is left for the weights is the interesting part, and it is where route
 * choice lives: WORD or ELITE within a solve row, SHOP or FORGE or EVENT within
 * a service row. The player picks a path, not just the next step.
 */

const ROWS = 6;
/** Which rows may be SERVICE. Row 6 is excluded: the pre-boss node is a solve node. */
const SERVICE_CANDIDATES = [1, 2, 3, 4, 5] as const;

export interface GeneratedAct {
  map: MapState;
  /** Retries spent. 0 in the overwhelming majority; surfaced so tests can see drift. */
  attempts: number;
}

/**
 * Two non-adjacent rows from 1..5, chosen by index so the choice is addressed
 * rather than sequential.
 */
function chooseServiceRows(seed: string, actIndex: number, salt: number): [number, number] {
  const pairs: Array<[number, number]> = [];
  for (const a of SERVICE_CANDIDATES) {
    for (const b of SERVICE_CANDIDATES) {
      if (b > a + 1) pairs.push([a, b]);
    }
  }
  const i = drawInt(seed, DOMAIN.map(actIndex), 100 + salt, pairs.length);
  return pairs[i]!;
}

/** 2–3 nodes per row, so branching exists without the map becoming a mesh. */
function rowWidth(seed: string, actIndex: number, row: number, salt: number): number {
  return 2 + drawInt(seed, DOMAIN.map(actIndex), 200 + salt * 10 + row, 2);
}

function solveKind(
  seed: string,
  actIndex: number,
  id: string,
  salt: number,
  elitesLeft: number,
  isPreBoss: boolean,
  weights: Readonly<Record<string, number>>,
): NodeKind {
  // §3.1: the node immediately before the boss is never an elite, and each act
  // caps how many it may hold at all.
  if (isPreBoss || elitesLeft <= 0) return 'WORD';
  return drawWeighted<NodeKind>(
    seed,
    DOMAIN.map(actIndex),
    300 + salt,
    ['WORD', 'ELITE'],
    [weights['WORD']!, weights['ELITE']!],
  );
}

function serviceKind(
  seed: string,
  actIndex: number,
  salt: number,
  weights: Readonly<Record<string, number>>,
): NodeKind {
  return drawWeighted<NodeKind>(
    seed,
    DOMAIN.map(actIndex),
    400 + salt,
    ['SHOP', 'FORGE', 'EVENT'],
    [weights['SHOP']!, weights['FORGE']!, weights['EVENT']!],
  );
}

function buildOnce(
  seed: string,
  actIndex: 0 | 1 | 2,
  cfg: Readonly<GameConfig>,
  salt: number,
): MapState {
  const act = cfg.acts[actIndex];
  const [serviceA, serviceB] = chooseServiceRows(seed, actIndex, salt);
  const isService = (row: number) => row === serviceA || row === serviceB;

  const nodes: Record<NodeId, MapNode> = {};
  const rows: NodeId[][] = [];
  let elitesLeft = act.maxElites;

  for (let row = 1; row <= ROWS; row++) {
    const width = rowWidth(seed, actIndex, row, salt);
    const ids: NodeId[] = [];
    for (let col = 0; col < width; col++) {
      const id: NodeId = `a${actIndex}-r${row}c${col}`;
      const salted = salt * 1000 + row * 10 + col;
      let kind: NodeKind;
      if (isService(row)) {
        kind = serviceKind(seed, actIndex, salted, cfg.nodeWeights);
      } else {
        kind = solveKind(
          seed,
          actIndex,
          id,
          salted,
          elitesLeft,
          row === ROWS,
          cfg.nodeWeights,
        );
        if (kind === 'ELITE') elitesLeft--;
      }
      nodes[id] = {
        id,
        kind,
        row: row - 1,
        col,
        next: [],
        // Only solve nodes carry word modifiers; a shop has no word to modify.
        modifiers:
          kind === 'WORD' || kind === 'ELITE' ? rollModifiers(seed, id, actIndex, kind) : [],
        visited: false,
      };
      ids.push(id);
    }
    rows.push(ids);
  }

  // §3.1 guarantees at least one shop AND at least one forge-or-event. The
  // brief spells out only the shop rule; both service rows drawing SHOP is just
  // as possible and leaves the act with no forge and no event.
  //
  // Order matters. The forge fix targets the LATER service row and runs first;
  // the shop fix targets the EARLIER one and runs last, so it always wins. Were
  // it the other way round, forcing a forge could delete the only shop.
  const kinds = () => rows.flat().map((id) => nodes[id]!.kind);
  if (!kinds().some((k) => k === 'FORGE' || k === 'EVENT')) {
    const forced = rows[serviceB - 1]![0]!;
    nodes[forced] = { ...nodes[forced]!, kind: 'FORGE' };
  }
  if (!kinds().includes('SHOP')) {
    const forced = rows[serviceA - 1]![0]!;
    nodes[forced] = { ...nodes[forced]!, kind: 'SHOP' };
  }

  const bossId: NodeId = `a${actIndex}-boss`;
  nodes[bossId] = {
    id: bossId,
    kind: 'BOSS',
    row: ROWS,
    col: 0,
    next: [],
    modifiers: [...BOSSES[actIndex].modifiers],
    visited: false,
  };
  rows.push([bossId]);

  connect(nodes, rows);

  return { nodes, rows, bossId, currentId: null, available: [...rows[0]!], modifiersRevealed: false };
}

/**
 * Edges join adjacent-or-equal column indices, then every node in the next row
 * is guaranteed an inbound edge and every node in this row an outbound one.
 *
 * Without both repairs a wider row can strand a node — unreachable, or a dead
 * end the player can walk into. Either would break the per-path invariant by
 * making some "path" not a path at all.
 */
function connect(nodes: Record<NodeId, MapNode>, rows: NodeId[][]): void {
  for (let r = 0; r < rows.length - 1; r++) {
    const here = rows[r]!;
    const next = rows[r + 1]!;
    const scale = (col: number) => Math.round((col * (next.length - 1)) / Math.max(1, here.length - 1));

    for (const id of here) {
      const node = nodes[id]!;
      const centre = scale(node.col);
      const targets = new Set<NodeId>();
      for (const d of [-1, 0, 1]) {
        const t = next[centre + d];
        if (t) targets.add(t);
      }
      node.next = [...targets];
    }

    // Anything in the next row nothing points at: attach it to the nearest node here.
    const reached = new Set(here.flatMap((id) => nodes[id]!.next));
    for (const target of next) {
      if (reached.has(target)) continue;
      const col = nodes[target]!.col;
      let best = here[0]!;
      for (const id of here) {
        if (Math.abs(scale(nodes[id]!.col) - col) < Math.abs(scale(nodes[best]!.col) - col)) best = id;
      }
      nodes[best]!.next = [...new Set([...nodes[best]!.next, target])];
    }
  }
}

/**
 * Every path from row 1 to the boss holds exactly `expected` solve nodes.
 *
 * True by construction — asserted anyway, because the whole design rests on it
 * and a future change to row typing or edge repair would otherwise break the
 * budget silently, which is exactly how §2.2's arithmetic broke in v0.
 */
export function solveCountsOnEveryPath(map: MapState): Set<number> {
  const counts = new Set<number>();
  const isSolve = (id: NodeId) => {
    const k = map.nodes[id]!.kind;
    return k === 'WORD' || k === 'ELITE';
  };
  const walk = (id: NodeId, acc: number): void => {
    const node = map.nodes[id]!;
    const total = acc + (isSolve(id) ? 1 : 0);
    if (node.next.length === 0) {
      counts.add(total);
      return;
    }
    for (const n of node.next) walk(n, total);
  };
  for (const start of map.rows[0]!) walk(start, 0);
  return counts;
}

/**
 * Route meaningfulness (design handoff S.03: "the player picks the path, not
 * just the next step").
 *
 * A crude risk/reward score per path. If every route scores within 15% of every
 * other, the branching is decoration and the map is regenerated. Cheap here,
 * free at runtime, and testable — which is why it is a generation constraint
 * rather than a design aspiration.
 */
export function routeSpread(map: MapState): number {
  const scores: number[] = [];
  const walk = (id: NodeId, acc: number): void => {
    const node = map.nodes[id]!;
    let s = acc;
    if (node.kind === 'ELITE') s += 3;
    if (node.kind === 'WORD') s += 1;
    if (node.kind === 'SHOP') s -= 2;
    if (node.kind === 'FORGE') s -= 1;
    if (node.kind === 'EVENT') s -= 1;
    s += node.modifiers.length;
    if (node.next.length === 0) {
      scores.push(s);
      return;
    }
    for (const n of node.next) walk(n, s);
  };
  for (const start of map.rows[0]!) walk(start, 0);
  const lo = Math.min(...scores);
  const hi = Math.max(...scores);
  if (hi === 0 && lo === 0) return 0;
  return (hi - lo) / Math.max(1, Math.abs(hi));
}

const MIN_ROUTE_SPREAD = 0.15;
const MAX_ATTEMPTS = 12;

/**
 * The Phase 3 act generator. Retries with `salt + 1000` on a failed constraint,
 * which keeps the retry itself reproducible — the brief's rule, and the reason
 * a regeneration never costs determinism.
 */
export function generateAct(
  seed: string,
  actIndex: 0 | 1 | 2,
  cfg: Readonly<GameConfig>,
): GeneratedAct {
  let last: MapState | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const map = buildOnce(seed, actIndex, cfg, attempt * 1000);
    last = map;
    // §3.1 counts WORD and ELITE only — the boss is counted separately in §3.2's
    // "4 solve nodes x 3 acts = 12, plus bosses". Getting this wrong silently
    // burned every retry, since the check could never pass.
    const counts = solveCountsOnEveryPath(map);
    const structural = counts.size === 1 && counts.has(cfg.acts[actIndex].solveNodes);
    if (structural && routeSpread(map) >= MIN_ROUTE_SPREAD) {
      return { map, attempts: attempt };
    }
  }
  // Structure is guaranteed by construction; only the spread heuristic can
  // genuinely exhaust the retries, and a flat map is worse than no map only in
  // the aesthetic sense. Take the last one rather than throw mid-run.
  return { map: last!, attempts: MAX_ATTEMPTS };
}
