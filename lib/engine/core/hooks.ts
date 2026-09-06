import { CONFIG, type GameConfig } from './config';
import type { Effect } from './effects';
import { DOMAIN, draw } from './rng';
import type { GameState, RelicInstance } from './state';
import { CHARACTER_BY_CODE, impl } from '../content/registry';
import type { HookContext, HookName, HookPayloads } from '../content/types';

/**
 * Collects the effects every holder wants to apply for one hook.
 *
 * Walk order is acquisition order — relics, then consumables, then modifiers —
 * and it is load-bearing twice over: for hook precedence, and for information
 * cap suppression (MECHANICS.md §6.3). `RelicInstance.acquiredAt` is the
 * authority; array position is kept in sync but never relied on.
 *
 * Handlers are pure and return effects; nothing here applies them. Applying is
 * `applyEffects` in reducer.ts, which owns the recursion guard.
 */
export function resolveHook<K extends HookName>(
  state: Readonly<GameState>,
  hook: K,
  payload: HookPayloads[K],
  cfg: Readonly<GameConfig> = CONFIG,
): Effect[] {
  const out: Effect[] = [];
  for (const holder of holdersInOrder(state)) {
    const handler = impl(holder.code)?.hooks?.[hook];
    if (!handler) continue;
    const ctx: HookContext = {
      state,
      self: holder,
      rng: (index: number) => draw(state.seed, DOMAIN.relic(holder.instanceId, hook), index),
      cfg,
    };
    out.push(...(handler as (c: HookContext, p: HookPayloads[K]) => Effect[])(ctx, payload));
  }
  return out;
}

/**
 * Fires `onUse` for one specific instance. Consumables and (once §13 I-04 is
 * ruled) player-activated relics come through here rather than through the
 * broadcast walk, because a use targets one item.
 */
export function resolveUse(
  state: Readonly<GameState>,
  instanceId: string,
  payload: Record<string, unknown>,
  cfg: Readonly<GameConfig> = CONFIG,
): Effect[] | null {
  const holder = holdersInOrder(state).find((h) => h.instanceId === instanceId);
  if (!holder) return null;
  const handler = impl(holder.code)?.hooks?.onUse;
  if (!handler) return null;
  const ctx: HookContext = {
    state,
    self: holder,
    rng: (index: number) => draw(state.seed, DOMAIN.relic(instanceId, 'onUse'), index),
    cfg,
  };
  return handler(ctx, { instanceId, payload });
}

/** Relics then consumables, each in acquisition order. */
export function holdersInOrder(state: Readonly<GameState>): RelicInstance[] {
  const relics = [...state.relics].sort((a, b) => a.acquiredAt - b.acquiredAt);
  const consumables = [...state.consumables]
    .sort((a, b) => a.acquiredAt - b.acquiredAt)
    .map<RelicInstance>((c) => ({ ...c, state: {}, upgraded: false }));
  return [...relics, ...consumables];
}

/** The character's innate, registered as a hidden relic at run start. */
export function innateCodeFor(characterCode: string): string | null {
  return CHARACTER_BY_CODE[characterCode] ? characterCode : null;
}
