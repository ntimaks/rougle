import type { RelicImpl } from '../types';

/** CARTOGRAPHER — "See the modifiers on every node in the act before choosing a path." */
export default {
  hooks: {
    onActStart: () => [{ kind: 'REVEAL_MAP_MODIFIERS' }],
  },
} satisfies RelicImpl;
