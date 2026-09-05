import { BOSSES } from '../content/bosses';
import { rollModifiers } from '../content/modifiers';
import type { GameConfig } from '../core/config';
import type { MapNode, MapState, NodeId } from '../core/state';

/**
 * Act structure.
 *
 * `generateLinearAct` is the Phase 1/2 shape (ticket V-01): four solve nodes in
 * a row, then the boss, no branching. It exists so the pool economy can be
 * measured and played before route choice is built, which is the order
 * MECHANICS.md §13 asks for — Phase 2 answers "is the shared pool tense?" and
 * branching would only add noise to that question.
 *
 * The row-class DAG generator (technical brief §5, ticket R-01) replaces this
 * in Phase 3. It is deliberately not written yet: it generates SHOP, FORGE and
 * EVENT nodes, and a path that reaches a node type the reducer cannot dispatch
 * is worse than no branching at all.
 */
export function generateLinearAct(
  seed: string,
  actIndex: 0 | 1 | 2,
  cfg: Readonly<GameConfig>,
): MapState {
  const act = cfg.acts[actIndex];
  const nodes: Record<NodeId, MapNode> = {};
  const rows: NodeId[][] = [];

  for (let i = 0; i < act.solveNodes; i++) {
    const id: NodeId = `a${actIndex}-n${i}`;
    nodes[id] = {
      id,
      kind: 'WORD',
      row: i,
      col: 0,
      next: [],
      modifiers: rollModifiers(seed, id, actIndex, 'WORD'),
      visited: false,
    };
    rows.push([id]);
  }

  const bossId: NodeId = `a${actIndex}-boss`;
  nodes[bossId] = {
    id: bossId,
    kind: 'BOSS',
    row: act.solveNodes,
    col: 0,
    next: [],
    modifiers: [...BOSSES[actIndex].modifiers],
    visited: false,
  };
  rows.push([bossId]);

  for (let i = 0; i < rows.length - 1; i++) nodes[rows[i]![0]!]!.next = [rows[i + 1]![0]!];

  return {
    nodes,
    rows,
    bossId,
    currentId: null,
    available: [rows[0]![0]!],
    modifiersRevealed: false,
  };
}
