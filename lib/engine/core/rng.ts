/**
 * Address-based deterministic RNG. Technical brief §2.5, MECHANICS.md §9.
 *
 * There is no cursor and no stream object. A draw is a pure function of
 * (seed, domain, index), so adding a roll to one subsystem cannot shift another
 * — not even within the same subsystem. That is a stronger guarantee than named
 * streams give, and it is what makes an existing seed survive a content patch.
 *
 * Domain strings are conventions, not types: they end up in bug reports, so they
 * are written out in DOMAIN below and used verbatim.
 */

/** 32-bit string hash (xmur3-style finalizer). */
export function hash32(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** One float in [0, 1). Same address, same value, in any process, forever. */
export function draw(seed: string, domain: string, index: number): number {
  let a = hash32(`${seed}|${domain}|${index}`);
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [0, bound). */
export function drawInt(seed: string, domain: string, index: number, bound: number): number {
  if (bound <= 0) throw new Error(`drawInt bound must be positive, got ${bound}`);
  return Math.floor(draw(seed, domain, index) * bound);
}

/** One element of a non-empty array. */
export function drawPick<T>(seed: string, domain: string, index: number, items: readonly T[]): T {
  if (items.length === 0) throw new Error(`drawPick on an empty array (${domain}:${index})`);
  return items[drawInt(seed, domain, index, items.length)]!;
}

/**
 * Weighted pick. `weights` is parallel to `items`; entries must be >= 0 and not
 * all zero. Deterministic for a given address.
 */
export function drawWeighted<T>(
  seed: string,
  domain: string,
  index: number,
  items: readonly T[],
  weights: readonly number[],
): T {
  if (items.length !== weights.length) throw new Error('drawWeighted: length mismatch');
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) throw new Error(`drawWeighted: weights sum to ${total} (${domain}:${index})`);
  let roll = draw(seed, domain, index) * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

/**
 * Fisher-Yates against consecutive addresses under one domain. The caller owns
 * the base index; a shuffle of n items consumes indices [base, base + n - 1).
 */
export function drawShuffle<T>(
  seed: string,
  domain: string,
  base: number,
  items: readonly T[],
): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = drawInt(seed, domain, base + i, i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/** Domain string builders. Use these rather than interpolating at the call site. */
export const DOMAIN = {
  map: (act: number) => `map:${act}`,
  word: (nodeId: string) => `word:${nodeId}`,
  modifier: (nodeId: string) => `modifier:${nodeId}`,
  offer: (nodeId: string) => `offer:${nodeId}`,
  shop: (nodeId: string) => `shop:${nodeId}`,
  forge: (nodeId: string) => `forge:${nodeId}`,
  liar: (nodeId: string) => `liar:${nodeId}`,
  truth: (nodeId: string) => `truth:${nodeId}`,
  moth: (nodeId: string) => `moth:${nodeId}`,
  relic: (instanceId: string, hook: string) => `relic:${instanceId}:${hook}`,
} as const;

const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // base32, no 0/O/1/I
export const SEED_LENGTH = 8;

/**
 * Renders a run seed from an arbitrary 32-bit entropy source. The engine never
 * generates entropy itself (no Date.now, no crypto) — the caller supplies it.
 */
export function formatSeed(entropy: number): string {
  let n = entropy >>> 0;
  let out = '';
  for (let i = 0; i < SEED_LENGTH; i++) {
    out += SEED_ALPHABET[n % SEED_ALPHABET.length];
    n = Math.floor(n / SEED_ALPHABET.length) || hash32(`${out}|${i}`);
  }
  return out;
}

export function isValidSeed(seed: string): boolean {
  return (
    seed.length === SEED_LENGTH && [...seed].every((c) => SEED_ALPHABET.includes(c))
  );
}
