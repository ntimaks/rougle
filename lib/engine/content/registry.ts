import relicsJson from '../../../relics.json';
import type { ActivationDef, CharacterDef, HookName, RelicDef, RelicImpl } from './types';
import { HOOK_NAMES } from './types';
import { IMPLEMENTATIONS, PENDING_IMPLEMENTATION } from './impl';

/**
 * Loads and validates relics.json, and pairs each entry with its implementation
 * module. Technical brief §6.
 *
 * relics.json is normative and is never transcribed into TypeScript. This file
 * reads it; `impl/` supplies the mechanism, keyed by code. `registry.test.ts`
 * runs the eight validations that keep the data and the code from drifting —
 * on a project with 31 relics across three documents, drift is otherwise
 * certain.
 */

interface RelicsFile {
  archetypes: Record<string, { label: string; summary: string }>;
  rarities: string[];
  relics: Array<Record<string, unknown>>;
  consumables: Array<Record<string, unknown>>;
  characters: Array<Record<string, unknown>>;
}

const FILE = relicsJson as unknown as RelicsFile;

function toDef(row: Record<string, unknown>, isConsumable: boolean): RelicDef {
  return { ...(row as unknown as RelicDef), isConsumable };
}

export const RELIC_DEFS: readonly RelicDef[] = [
  ...FILE.relics.map((r) => toDef(r, false)),
  ...FILE.consumables.map((c) => toDef(c, true)),
];

export const REGISTRY: Readonly<Record<string, RelicDef>> = Object.freeze(
  Object.fromEntries(RELIC_DEFS.map((d) => [d.code, d])),
);

export const CHARACTERS: readonly CharacterDef[] = FILE.characters as unknown as CharacterDef[];

export const CHARACTER_BY_CODE: Readonly<Record<string, CharacterDef>> = Object.freeze(
  Object.fromEntries(CHARACTERS.map((c) => [c.code, c])),
);

export const ARCHETYPES = Object.keys(FILE.archetypes) as Array<RelicDef['archetype'] & string>;
export const RARITIES = FILE.rarities as RelicDef['rarity'][];

export function def(code: string): RelicDef {
  const d = REGISTRY[code];
  if (!d) throw new Error(`Unknown code ${code}. relics.json is the registry; add it there first.`);
  return d;
}

export function impl(code: string): RelicImpl | undefined {
  return IMPLEMENTATIONS[code];
}

/** Codes that are in relics.json but deliberately not built yet, with the reason. */
export { PENDING_IMPLEMENTATION };

export function isImplemented(code: string): boolean {
  return code in IMPLEMENTATIONS;
}

/**
 * The activation block for a code, if it has one. Characters carry theirs on
 * the character entry rather than the relic list, so both are looked up here —
 * a caller should never need to know which array a code came from.
 */
export function activationFor(code: string): ActivationDef | undefined {
  return REGISTRY[code]?.activation ?? CHARACTER_BY_CODE[code]?.activation;
}

export function isActivated(code: string): boolean {
  return activationFor(code) !== undefined;
}

/**
 * Relics only (no consumables), for offer generation.
 *
 * A function, not a module-level constant. Relic implementation modules import
 * shared engine helpers, and those helpers may import this file; evaluating
 * `IMPLEMENTATIONS` while that cycle is still resolving reads it as undefined.
 * Deferring the filter to call time removes the hazard entirely rather than
 * relying on import order staying lucky.
 */
export function offerableRelics(): readonly RelicDef[] {
  return RELIC_DEFS.filter((d) => !d.isConsumable && isImplemented(d.code));
}

/**
 * May this relic be offered in this act? R-015: a relic that provably does
 * nothing yet is withheld rather than given a second clause, so RL.28 Shaved
 * Coin waits for the Liar Letter modifier to exist.
 */
export function offerableInAct(d: RelicDef, actIndex: number): boolean {
  return d.offer_from_act === undefined || actIndex >= d.offer_from_act - 1;
}

export function offerableConsumables(): readonly RelicDef[] {
  return RELIC_DEFS.filter((d) => d.isConsumable && isImplemented(d.code));
}

export function isHookName(value: unknown): value is HookName {
  return typeof value === 'string' && (HOOK_NAMES as readonly string[]).includes(value);
}
