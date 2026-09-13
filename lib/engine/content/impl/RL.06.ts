import type { RelicImpl } from '../types';

/**
 * CARTOGRAPHER — "See the modifiers on every node in the act before choosing a
 * path." Also the rewards at MK.II.
 *
 * `onNodeEnter` rather than the act hook it used to use: §6.1 drops `onActStart`
 * and the flag is idempotent, so revealing again on every node costs nothing
 * and covers the case that matters — taking the relic mid-act, when the map you
 * are standing on is exactly the one you wanted to read.
 */
export default {
  hooks: {
    onNodeEnter: () => [{ kind: 'REVEAL_MAP_MODIFIERS' }],
  },
} satisfies RelicImpl;
