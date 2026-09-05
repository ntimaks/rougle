import { DOMAIN, draw, drawShuffle } from '../core/rng';
import type { ModifierId, NodeKind } from '../core/state';

/**
 * Modifiers. MECHANICS.md §5 — they are the entire difficulty curve.
 *
 * Difficulty comes from modifiers, never from rarer vocabulary. That constraint
 * is not negotiable and it is why the word lists are banded to the top ~8000
 * words by frequency (§8.1).
 */

export interface ModifierDef {
  id: ModifierId;
  /** Earliest act index (0-based) this modifier can appear in. */
  fromAct: 0 | 1 | 2;
  /** Act III only, rather than "act III and later". */
  actIIIOnly?: boolean;
  label: string;
}

export const MODIFIERS: readonly ModifierDef[] = Object.freeze([
  { id: 'LOCKED_KEY', fromAct: 0, label: 'LOCKED KEY' },
  { id: 'SILENT_START', fromAct: 0, label: 'SILENT START' },
  { id: 'LONG_WORD', fromAct: 1, label: 'LONG WORD' },
  { id: 'DECAY', fromAct: 1, label: 'DECAY' },
  { id: 'FOG', fromAct: 1, label: 'FOG' },
  { id: 'MIRROR', fromAct: 1, label: 'MIRROR' },
  { id: 'LIAR_LETTER', fromAct: 2, actIIIOnly: true, label: 'LIAR LETTER' },
  { id: 'LONGER_WORD', fromAct: 2, actIIIOnly: true, label: 'LONGER WORD' },
]);

/**
 * STACKED is not in the table above because it is not a word modifier: it is a
 * property of an Act III elite ("elites roll 2 modifiers"). Rolling it as if it
 * were one would let a word carry STACKED and nothing else.
 */
export const STACKED: ModifierId = 'STACKED';

/**
 * Stacking exclusions, MECHANICS.md §5. Symmetric — declared once, applied both
 * ways by `canStack`.
 */
const EXCLUSIONS: ReadonlyArray<readonly [ModifierId, ModifierId]> = [
  ['FOG', 'SILENT_START'],
  // Fog + Cipher is excluded too, but Cipher is a boss rather than a modifier;
  // `deferralDepth` is set once, so double deferral cannot arise.
];

export function canStack(a: ModifierId, b: ModifierId): boolean {
  if (a === b) return false;
  if (a === 'LONG_WORD' && b === 'LONGER_WORD') return false;
  if (a === 'LONGER_WORD' && b === 'LONG_WORD') return false;
  return !EXCLUSIONS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

export function availableModifiers(actIndex: number): ModifierDef[] {
  return MODIFIERS.filter((m) => (m.actIIIOnly ? actIndex === 2 : actIndex >= m.fromAct));
}

/**
 * How many modifiers a node rolls. Word nodes ramp with the act; elites take
 * one more, and two in Act III per the STACKED rule.
 */
export function modifierCount(actIndex: number, kind: NodeKind, roll: number): number {
  if (kind === 'ELITE') return actIndex === 2 ? 2 : 1;
  if (kind !== 'WORD') return 0;
  if (actIndex === 0) return roll < 0.5 ? 1 : 0;
  if (actIndex === 1) return roll < 0.75 ? 1 : 0;
  return roll < 0.4 ? 2 : 1;
}

/** Draws a legal, non-conflicting modifier set for one node. */
export function rollModifiers(
  seed: string,
  nodeId: string,
  actIndex: number,
  kind: NodeKind,
): ModifierId[] {
  const wanted = modifierCount(actIndex, kind, draw(seed, DOMAIN.modifier(nodeId), 0));
  if (wanted === 0) return [];
  const pool = drawShuffle(
    seed,
    DOMAIN.modifier(nodeId),
    1,
    availableModifiers(actIndex).map((m) => m.id),
  );
  const chosen: ModifierId[] = [];
  for (const candidate of pool) {
    if (chosen.length >= wanted) break;
    if (chosen.every((c) => canStack(c, candidate))) chosen.push(candidate);
  }
  return chosen;
}

/** Word length after modifiers. MECHANICS.md §5. */
export function lengthFor(base: 5 | 6 | 7, modifiers: readonly ModifierId[]): 5 | 6 | 7 {
  if (modifiers.includes('LONGER_WORD')) return 7;
  if (modifiers.includes('LONG_WORD')) return base === 5 ? 6 : base;
  return base;
}
