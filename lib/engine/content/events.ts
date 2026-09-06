import eventsJson from '../../../events.json';

/**
 * Loads and validates events.json (MECHANICS.md §6.8, ruled R-022).
 *
 * Same contract as the relic registry: the JSON is normative and is never
 * transcribed into TypeScript. This file reads it and types it; the effect
 * vocabulary is closed, so an event that needs a verb the vocabulary lacks is
 * a signal to extend the vocabulary deliberately — never to special-case one
 * event in the reducer.
 *
 * Prose carries no mechanical meaning. `effect` is the whole of what happens.
 */

export type EventEffect =
  | { gold_delta: number }
  | { pool_delta: number }
  | { relic_grant: { rarity: string; choose: boolean; count: number } }
  | { relic_destroy: { mode: 'choice' | 'random'; count: number } }
  | { relic_upgrade: { mode: 'choice' } }
  | { consumable_grant: { count: number; random: boolean } }
  | { reveal: { scope: 'act_first_letters' | 'act_map' | 'next_word_length' } }
  | {
      modifier_apply: {
        modifier: string;
        scope: 'next_word' | 'next_n_words' | 'rest_of_act';
        n?: number;
      };
    }
  | { modifier_reroll: { scope: 'rest_of_act' } }
  | {
      word_challenge: {
        limit: number | null;
        on_success: EventEffect[];
        on_failure: EventEffect[];
      };
    }
  | { map_skip: { nodes: number } }
  | { flag_set: { flag: string; value: number | boolean } };

/** Gates an option, never the event — §6.8: show the door you cannot afford. */
export interface EventRequirement {
  gold_min?: number;
  relics_min?: number;
}

export interface EventOption {
  key: string;
  label: string;
  /** The full consequence, failure branch included. §6.8: an event never hides its odds. */
  stake: string;
  effect: EventEffect[];
  requires?: EventRequirement;
}

export interface EventDef {
  code: string;
  name: string;
  /** 1-indexed acts this may be drawn in. */
  acts: number[];
  prose: string;
  options: EventOption[];
}

interface EventsFile {
  effect_vocabulary: Record<string, string>;
  events: EventDef[];
}

const FILE = eventsJson as unknown as EventsFile;

export const EVENT_DEFS: readonly EventDef[] = FILE.events;

export const EVENTS: Readonly<Record<string, EventDef>> = Object.freeze(
  Object.fromEntries(EVENT_DEFS.map((e) => [e.code, e])),
);

/** The closed vocabulary, exported so the validator can assert against it. */
export const EFFECT_VERBS: readonly string[] = Object.keys(FILE.effect_vocabulary);

/** Eligible in this act and not already seen. `acts` in the JSON is 1-indexed. */
export function eventsForAct(actIndex: 0 | 1 | 2, seen: readonly string[]): EventDef[] {
  const used = new Set(seen);
  return EVENT_DEFS.filter((e) => e.acts.includes(actIndex + 1) && !used.has(e.code));
}

/** Every verb an effect tree uses, including inside word_challenge branches. */
export function verbsIn(effects: readonly EventEffect[]): string[] {
  const out: string[] = [];
  for (const effect of effects) {
    for (const [verb, value] of Object.entries(effect)) {
      out.push(verb);
      if (verb === 'word_challenge') {
        const wc = value as { on_success: EventEffect[]; on_failure: EventEffect[] };
        out.push(...verbsIn(wc.on_success), ...verbsIn(wc.on_failure));
      }
    }
  }
  return out;
}
