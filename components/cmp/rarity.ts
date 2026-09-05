import type { RelicDef } from '@/lib/engine';

/**
 * CMP.04's rarity treatment. Carried by the 5px spine and the badge, never by
 * the card fill — a rarity that tints the whole card competes with the tile
 * language for the same colours.
 *
 * R-010: CONSUMABLE is its own class. The prototype's `relicSkin()` had no
 * branch for it and fell through to common styling, which is the filed bug.
 */
export const RARITY_SPINE: Record<RelicDef['rarity'], string> = {
  COMMON: 'bg-fg3',
  UNCOMMON: 'bg-[var(--kelly)]',
  RARE: 'bg-[var(--magenta)]',
  BOSS: 'bg-accent',
  CONSUMABLE: 'bg-[var(--cyan)]',
};

export const RARITY_TEXT: Record<RelicDef['rarity'], string> = {
  COMMON: 'text-fg2',
  UNCOMMON: 'text-[var(--kelly)]',
  RARE: 'text-[var(--magenta)]',
  BOSS: 'text-accent',
  CONSUMABLE: 'text-[var(--cyan)]',
};

/** One glyph per archetype. Shape, so rarity keeps the colour to itself. */
export const ARCHETYPE_GLYPH: Record<string, string> = {
  INFO: '◇',
  TEMPO: '▲',
  RISK: '✦',
  GREED: '◈',
  ROUTE: '●',
};

export function glyphFor(def: RelicDef | undefined): string {
  if (!def) return '◇';
  if (def.isConsumable) return '✚';
  return ARCHETYPE_GLYPH[def.archetype ?? ''] ?? '◇';
}
