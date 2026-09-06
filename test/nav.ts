import { reduce, type GameState } from '@/lib/engine';

/**
 * Walk a fresh run to its first WORD.
 *
 * Before R-01 the act was a line of four word nodes, so every test could reach
 * a word with `SELECT_NODE(available[0])`. The map branches now and row 1 can be
 * a service row, so that lands on a shop about a third of the time. This walks
 * the DAG instead: pick the first available node, leave whatever service node it
 * turns out to be, repeat.
 *
 * Tests that care about a specific node kind should build the state directly.
 * This is for the majority that just need a board.
 */
export function enterFirstWord(start: GameState, maxSteps = 20): GameState {
  let s = start;
  for (let i = 0; i < maxSteps; i++) {
    if (s.phase === 'WORD') return s;
    if (s.phase === 'MAP') {
      const next = s.map.available[0];
      if (!next) break;
      s = reduce(s, { type: 'SELECT_NODE', nodeId: next }).state;
      continue;
    }
    if (s.phase === 'SHOP' || s.phase === 'FORGE' || s.phase === 'EVENT') {
      s = reduce(s, { type: 'LEAVE_NODE' }).state;
      continue;
    }
    if (s.phase === 'REWARD') {
      s = reduce(s, { type: 'SKIP_OFFER' }).state;
      continue;
    }
    break;
  }
  if (s.phase !== 'WORD') {
    throw new Error(`enterFirstWord: stuck in ${s.phase} after ${maxSteps} steps`);
  }
  return s;
}
