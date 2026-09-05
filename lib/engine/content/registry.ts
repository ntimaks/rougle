import relicsJson from '../../../relics.json';
import type { CharacterDef, HookName, RelicDef, RelicImpl } from './types';
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

/** Relics only (no consumables), for offer generation. */
export const OFFERABLE_RELICS: readonly RelicDef[] = RELIC_DEFS.filter(
  (d) => !d.isConsumable && isImplemented(d.code),
);

export const OFFERABLE_CONSUMABLES: readonly RelicDef[] = RELIC_DEFS.filter(
  (d) => d.isConsumable && isImplemented(d.code),
);

/**
 * MECHANICS.md §6.3: the pre-guess reveal effects the cap applies to.
 *
 * Includes CHARACTER INNATES. §6.3's prose lists six relics and does not mention
 * characters, but `relics.json` marks CH.01 The Linguist `pre_guess_reveal: true`
 * and its innate — "sees the solution vowel count on every word, before the
 * first guess" — is precisely the effect the cap exists to bound. The flag is
 * the data and the data is normative, so the flag wins; the prose list is the
 * thing that needs updating. Raised as §13 I-20.
 *
 * It matters: a Linguist holding Lexicon and Palimpsest is at the cap before
 * taking a single reveal relic, which changes what those relics are worth.
 */
export const PRE_GUESS_REVEAL_CODES: readonly string[] = [
  ...RELIC_DEFS.filter((d) => d.pre_guess_reveal).map((d) => d.code),
  ...CHARACTERS.filter((c) => c.pre_guess_reveal).map((c) => c.code),
];

const REVEAL_SET = new Set(PRE_GUESS_REVEAL_CODES);

/** Does this code produce a pre-guess reveal? Relics, consumables and innates. */
export function isPreGuessReveal(code: string): boolean {
  return REVEAL_SET.has(code);
}

export function isHookName(value: unknown): value is HookName {
  return typeof value === 'string' && (HOOK_NAMES as readonly string[]).includes(value);
}
