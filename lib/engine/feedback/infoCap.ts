import { CONFIG, type GameConfig } from '../core/config';
import { holdersInOrder } from '../core/hooks';
import type { GameState } from '../core/state';
import { isPreGuessReveal } from '../content/registry';

/**
 * The information cap. MECHANICS.md §6.3: at most 2 pre-guess reveal effects
 * active on any word.
 *
 * Data-driven: `relics.json` flags each affected entry with
 * `pre_guess_reveal: true`, so adding a reveal relic puts it under the cap
 * automatically rather than requiring a list here to be kept in sync.
 */

export interface RevealCap {
  active: string[];
  suppressed: string[];
}

/**
 * Suppression order. MECHANICS.md §6.3 says acquisition order, earliest wins.
 *
 * That ordering is a trap and §13 I-03 raises it: RL.31 Rosetta Slab is a BOSS
 * relic that costs −3 act pool, so a player already holding two COMMON reveals
 * pays the cost and receives nothing, permanently. The proposed fix — suppress
 * by ascending rarity, ties broken by earliest acquired — is NOT implemented
 * here, because it is a rules change and rules are MECHANICS.md's to make.
 *
 * This implements the spec as written. When I-03 is ruled, this function is the
 * only thing that changes. See ADR-0003.
 */
export function orderForSuppression(
  instances: ReadonlyArray<{ instanceId: string; code: string; acquiredAt: number }>,
): Array<{ instanceId: string; code: string; acquiredAt: number }> {
  return [...instances].sort((a, b) => a.acquiredAt - b.acquiredAt);
}

export function activeReveals(
  s: Readonly<GameState>,
  cfg: Readonly<GameConfig> = CONFIG,
): RevealCap {
  const candidates = holdersInOrder(s).filter((h) => isPreGuessReveal(h.code));
  const ordered = orderForSuppression(candidates);
  return {
    active: ordered.slice(0, cfg.preGuessRevealCap).map((i) => i.instanceId),
    suppressed: ordered.slice(cfg.preGuessRevealCap).map((i) => i.instanceId),
  };
}

/** Is this holder allowed to fire its pre-guess reveal on the current word? */
export function revealAllowed(
  s: Readonly<GameState>,
  instanceId: string,
  cfg: Readonly<GameConfig> = CONFIG,
): boolean {
  return activeReveals(s, cfg).active.includes(instanceId);
}
