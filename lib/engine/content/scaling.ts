import { REGISTRY } from './registry';
import type { GameState, RelicInstance } from '../core/state';

/**
 * §6.5 — the six scaling relics, and where each one's counter actually lives.
 *
 * "They are marked `scaling` in the registry and their current counter value is
 * always visible on the card." The registry supplies the LABEL; only the
 * implementation knows the field, and the two have to be joined somewhere. This
 * is that somewhere, and it is in the engine rather than in a component because
 * AGENTS.md non-negotiable 3 says a view never derives a rule — a card reading
 * `relic.state.heads` directly is a second place that has to be updated when a
 * relic's internals change, and the one that nobody remembers.
 *
 * `RL.03` Palimpsest is the odd one out: its counter is "solutions remembered",
 * which is run state rather than relic state, because the relic reads
 * `usedSolutions` and never stores a memory of its own. Reading it from the
 * same place the relic does is what keeps the card honest.
 */
type Reader = (s: GameState, self: RelicInstance) => number;

const READERS: Readonly<Record<string, Reader>> = {
  'RL.03': (s) => s.usedSolutions.length,
  'RL.12': (_s, self) => Number(self.state['streak'] ?? 0),
  'RL.14': (_s, self) => Number(self.state['heads'] ?? 0),
  'RL.19': (_s, self) => Number(self.state['words'] ?? 0),
  'RL.23': (_s, self) => Number(self.state['rate'] ?? 2),
  'RL.26': (_s, self) => Number(self.state['lit'] ?? 0),
};

export interface ScalingCounter {
  /** §6.5's own name for it, from the registry. */
  label: string;
  value: number;
  /** Hot Streak's cap, where the registry declares one. */
  cap: number | null;
}

/**
 * The counter to print on this relic's card, or null if it does not scale.
 *
 * Returns the raw counter, NOT the effect it produces — the Lantern's card says
 * TIMES LIT 4, not "lights 2". §6.5 wants the counter visible because the
 * counter is the thing the player is building; how it converts is the rule text
 * directly above it.
 */
export function scalingCounter(s: GameState, self: RelicInstance): ScalingCounter | null {
  const def = REGISTRY[self.code];
  const read = READERS[self.code];
  if (!def?.scaling || !read) return null;
  return { label: def.scaling.counter, value: read(s, self), cap: def.scaling.cap ?? null };
}

/**
 * Every scaling relic held, with its counter. §11.3 asks the harness for
 * "scaling-relic counter values at run end", and this is that reading — one
 * source for the report and the drawer both.
 */
export function scalingCounters(s: GameState): Array<{ code: string } & ScalingCounter> {
  const out: Array<{ code: string } & ScalingCounter> = [];
  for (const relic of s.relics) {
    const counter = scalingCounter(s, relic);
    if (counter) out.push({ code: relic.code, ...counter });
  }
  return out;
}

/** The codes §6.5 marks as scaling. Six of them; the count is normative. */
export function scalingCodes(): string[] {
  return Object.values(REGISTRY)
    .filter((d) => d.scaling)
    .map((d) => d.code);
}
