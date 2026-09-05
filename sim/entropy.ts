import type { WordLength } from '../lib/engine';

/**
 * A fast, allocation-free scorer used ONLY by the solver's entropy search.
 *
 * The engine's `scoreStates` is the ported, proven implementation and stays the
 * reference; nothing here replaces it. But the search scores hundreds of
 * thousands of pairs per word, and the reference's `split('')` and
 * `.join('')` allocations dominate the harness's runtime — 200 guesses against
 * 1000 candidates costs about 600 ms with the reference and about 25 ms here.
 *
 * `entropy.test.ts` differentially tests this against `scoreStates` over the
 * same fuzzing regime as the port itself. If the two ever disagree, this file
 * is the one that is wrong.
 */

const A = 'A'.charCodeAt(0);
export const MAX_LENGTH = 7;

const POW3 = new Int32Array(MAX_LENGTH);
for (let i = 0; i < MAX_LENGTH; i++) POW3[i] = 3 ** i;
export const PATTERN_SPACE = 3 ** MAX_LENGTH;

/** Packs a word list into one flat Uint8Array of letter indices. */
export interface Encoded {
  length: WordLength;
  count: number;
  codes: Uint8Array;
  words: readonly string[];
}

export function encode(words: readonly string[], length: WordLength): Encoded {
  const codes = new Uint8Array(words.length * length);
  for (let w = 0; w < words.length; w++) {
    const word = words[w]!;
    for (let i = 0; i < length; i++) codes[w * length + i] = word.charCodeAt(i) - A;
  }
  return { length, count: words.length, codes, words };
}

export function encodeOne(word: string): Uint8Array {
  const out = new Uint8Array(word.length);
  for (let i = 0; i < word.length; i++) out[i] = word.charCodeAt(i) - A;
  return out;
}

/**
 * Base-3 feedback pattern: 0 grey, 1 yellow, 2 green, least significant digit
 * first. Same two passes as the reference scorer, on typed arrays.
 */
export function pattern(
  guess: Uint8Array,
  solutions: Uint8Array,
  offset: number,
  length: number,
  counts: Int32Array,
  green: Uint8Array,
): number {
  counts.fill(0);
  let pat = 0;
  for (let i = 0; i < length; i++) {
    const s = solutions[offset + i]!;
    if (guess[i] === s) {
      green[i] = 1;
      pat += 2 * POW3[i]!;
    } else {
      green[i] = 0;
      counts[s]! += 1;
    }
  }
  for (let i = 0; i < length; i++) {
    if (green[i] === 1) continue;
    const g = guess[i]!;
    if (counts[g]! > 0) {
      counts[g]! -= 1;
      pat += POW3[i]!;
    }
  }
  return pat;
}

/** Scratch buffers, allocated once per process rather than per call. */
export class EntropyScratch {
  readonly counts = new Int32Array(26);
  readonly green = new Uint8Array(MAX_LENGTH);
  readonly buckets = new Int32Array(PATTERN_SPACE);
  readonly touched = new Int32Array(PATTERN_SPACE);
}

/** Shannon entropy, in bits, of the partition `guess` induces over `set`. */
export function entropyOf(
  guess: Uint8Array,
  set: Encoded,
  scratch: EntropyScratch,
): number {
  const { buckets, touched, counts, green } = scratch;
  const { codes, count, length } = set;
  let distinct = 0;

  for (let c = 0; c < count; c++) {
    const p = pattern(guess, codes, c * length, length, counts, green);
    if (buckets[p] === 0) touched[distinct++] = p;
    buckets[p]! += 1;
  }

  let bits = 0;
  for (let i = 0; i < distinct; i++) {
    const p = touched[i]!;
    const share = buckets[p]! / count;
    bits -= share * Math.log2(share);
    buckets[p] = 0; // reset only what we touched
  }
  return bits;
}
