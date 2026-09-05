import type { RelicImpl } from '../types';

/** THE CONCORDANCE — "reports whether the answer repeats any letter." */
export default {
  hooks: {
    onWordStart: () => [{ kind: 'REVEAL_META', field: 'hasRepeat' }],
  },
} satisfies RelicImpl;
