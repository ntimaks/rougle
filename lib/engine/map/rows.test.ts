import { describe, expect, it } from 'vitest';
import { CONFIG } from '../core/config';
import { generateAct, routeSpread, solveCountsOnEveryPath } from './rows';
import type { MapState, NodeId } from '../core/state';

/**
 * R-01 — "10k seeded maps: every path has exactly 4 solve nodes, all §3.1
 * constraints hold."
 *
 * The point of generating by construction is that these cannot fail. Which is
 * exactly why they are asserted at volume: the invariant is load-bearing for
 * §2.2's budget arithmetic, and the failure mode is silent.
 */

const ACTS = [0, 1, 2] as const;
const N = 10_000;

function* maps(n: number) {
  for (let i = 0; i < n; i++) {
    const act = ACTS[i % 3]!;
    yield { seed: `MAP${i.toString(36).toUpperCase()}`, act, ...generateAct(`MAP${i}`, act, CONFIG) };
  }
}

/** Every node reachable from row 1, following edges. */
function reachable(map: MapState): Set<NodeId> {
  const seen = new Set<NodeId>();
  const stack = [...map.rows[0]!];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...map.nodes[id]!.next);
  }
  return seen;
}

describe('§3.1 constraints over 10k maps', () => {
  it('every path holds exactly 4 solve nodes, in every act', () => {
    for (const { map, act, seed } of maps(N)) {
      const counts = solveCountsOnEveryPath(map);
      // §3.1's "exactly 4 solve nodes" means WORD and ELITE. The boss is
      // counted separately — §3.2 is "4 solve nodes x 3 acts = 12, plus bosses".
      expect([...counts], `${seed} act ${act}`).toEqual([CONFIG.acts[act].solveNodes]);
    }
  });

  it('holds every other §3.1 constraint', () => {
    for (const { map, act, seed } of maps(N)) {
      const all = Object.values(map.nodes);
      const where = `${seed} act ${act}`;

      expect(all.filter((n) => n.kind === 'SHOP').length, `${where}: at least 1 shop`)
        .toBeGreaterThanOrEqual(1);

      const services = all.filter((n) => ['FORGE', 'EVENT'].includes(n.kind));
      expect(services.length, `${where}: at least 1 forge or event`).toBeGreaterThanOrEqual(1);

      expect(all.filter((n) => n.kind === 'ELITE').length, `${where}: elite cap`)
        .toBeLessThanOrEqual(CONFIG.acts[act].maxElites);

      // No two shops adjacent: no shop may point at a shop.
      for (const node of all) {
        if (node.kind !== 'SHOP') continue;
        for (const next of node.next) {
          expect(map.nodes[next]!.kind, `${where}: ${node.id} -> ${next} both shops`).not.toBe('SHOP');
        }
      }

      // The node immediately before the boss is never an elite.
      for (const node of all) {
        if (!node.next.includes(map.bossId)) continue;
        expect(node.kind, `${where}: ${node.id} is elite before the boss`).not.toBe('ELITE');
      }
    }
  });

  it('every node is reachable and every node leads somewhere', () => {
    // A stranded node is not merely ugly: it makes "every path" a claim about a
    // graph the player cannot actually walk.
    for (const { map, seed } of maps(2000)) {
      const seen = reachable(map);
      for (const node of Object.values(map.nodes)) {
        expect(seen.has(node.id), `${seed}: ${node.id} unreachable`).toBe(true);
        if (node.kind !== 'BOSS') {
          expect(node.next.length, `${seed}: ${node.id} is a dead end`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('only solve nodes carry word modifiers', () => {
    for (const { map, seed } of maps(2000)) {
      for (const node of Object.values(map.nodes)) {
        if (['SHOP', 'FORGE', 'EVENT'].includes(node.kind)) {
          expect(node.modifiers, `${seed}: ${node.id} is a ${node.kind} with modifiers`).toEqual([]);
        }
      }
    }
  });
});

describe('R-02 route meaningfulness', () => {
  it('routes differ by more than 15% on risk/reward, over 1000 maps', () => {
    let flat = 0;
    for (const { map } of maps(1000)) {
      if (routeSpread(map) < 0.15) flat++;
    }
    // The generator retries a flat map, so survivors should be rare. Not zero:
    // MAX_ATTEMPTS can genuinely run out, and shipping a flat map beats
    // throwing mid-run.
    expect(flat / 1000, 'too many maps where the route choice is decoration').toBeLessThan(0.05);
  });

  it('the map actually branches', () => {
    for (const { map, seed } of maps(500)) {
      const widths = map.rows.slice(0, 6).map((r) => r.length);
      expect(Math.max(...widths), `${seed} has no branching`).toBeGreaterThan(1);
    }
  });
});

describe('determinism', () => {
  it('the same seed and act produce an identical map', () => {
    for (let i = 0; i < 200; i++) {
      const a = generateAct(`DET${i}`, (i % 3) as 0 | 1 | 2, CONFIG);
      const b = generateAct(`DET${i}`, (i % 3) as 0 | 1 | 2, CONFIG);
      expect(JSON.stringify(a.map)).toBe(JSON.stringify(b.map));
    }
  });

  it('different acts of one seed are different maps', () => {
    const a0 = generateAct('SAME', 0, CONFIG);
    const a1 = generateAct('SAME', 1, CONFIG);
    expect(JSON.stringify(a0.map)).not.toBe(JSON.stringify(a1.map));
  });

  it('a retry is itself reproducible', () => {
    // The salt is derived from the attempt number, not from a mutable cursor,
    // so a map that needed three attempts replays in three attempts.
    for (let i = 0; i < 100; i++) {
      const a = generateAct(`RETRY${i}`, 0, CONFIG);
      const b = generateAct(`RETRY${i}`, 0, CONFIG);
      expect(a.attempts).toBe(b.attempts);
    }
  });
});

describe('the opening move is always playable', () => {
  it('row 1 is never a service row', () => {
    // A run starts with 0 gold, so a shop or a forge on row 1 is a first move
    // that can do nothing. Found in playtest, fixed in generation rather than
    // by handing out starting gold.
    for (const { map, seed } of maps(4000)) {
      for (const id of map.rows[0]!) {
        expect(['WORD', 'ELITE'], `${seed}: row 1 holds a ${map.nodes[id]!.kind}`)
          .toContain(map.nodes[id]!.kind);
      }
    }
  });
});
