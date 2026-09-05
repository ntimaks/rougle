import type { RelicImpl } from '../types';

/**
 * THE TIN CUP — "Every guess you spend rattles 5g loose."
 *
 * The +5g and the pool decrement are emitted in the same event batch, which the
 * UI drains atomically, so the two counters move on one frame rather than
 * competing for attention (relics.json engine_note).
 */
export default {
  hooks: {
    onGuessSubmit: () => [{ kind: 'GOLD', delta: 5, reason: 'RL.23' }],
  },
} satisfies RelicImpl;
