/**
 * Extracts the game-local `--g-*` colour layer from the design prototype into
 * `app/game-tokens.css`.
 *
 * Why this exists: technical brief §1.5 says design values are imported, never
 * redeclared, and the NIKOLASS token bundle is the source of colour. But the
 * `--g-*` layer is not in the bundle — it lives in a `:root{}` block inside
 * `design/Rougle.dc.html`, which is the prototype, not a token file. Rather
 * than hand-copying nine hex literals into the app (which is exactly the drift
 * the rule exists to prevent), we extract them mechanically and assert in
 * `test/game-tokens.test.ts` that the generated file still matches the design.
 *
 * Run: npx tsx scripts/extract-game-tokens.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const PROTOTYPE = 'design/Rougle.dc.html';
export const OUTPUT = 'app/game-tokens.css';

const HEADER = `/* GENERATED — do not edit by hand.
   Source: ${PROTOTYPE} (the design prototype's game-local colour layer).
   Regenerate: npx tsx scripts/extract-game-tokens.ts
   Guarded by: test/game-tokens.test.ts

   These are design values, not engineering ones. Technical brief §1.5: a hex
   literal in /components is a review rejection — it belongs here, extracted,
   or in the NIKOLASS token bundle. */
`;

/** Pulls the first `:root{ ... }` declaration block out of the prototype. */
export function extractRootBlock(html: string): string {
  const match = /:root\s*\{([\s\S]*?)\}/.exec(html);
  if (!match?.[1]) throw new Error(`No :root block found in ${PROTOTYPE}`);
  return match[1];
}

/**
 * Pulls the `@keyframes rg-*` animations the component sheet references.
 * Brace-counted rather than regexed: keyframe bodies nest one level deep and a
 * flat `[^}]*` truncates them silently, which is worse than not extracting at all.
 */
export function extractKeyframes(html: string): string[] {
  const out: string[] = [];
  const opener = /@keyframes\s+rg-[\w-]+\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(html)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < html.length && depth > 0) {
      if (html[i] === '{') depth++;
      else if (html[i] === '}') depth--;
      i++;
    }
    if (depth !== 0) throw new Error(`Unbalanced braces after ${m[0]}`);
    out.push(html.slice(m.index, i));
  }
  return out;
}

export function buildCss(html: string): string {
  const root = extractRootBlock(html)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const keyframes = extractKeyframes(html);
  return [
    HEADER,
    ':root {',
    ...root.map((l) => `  ${l}`),
    '}',
    '',
    ...keyframes,
    '',
  ].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const html = readFileSync(resolve(PROTOTYPE), 'utf8');
  writeFileSync(resolve(OUTPUT), buildCss(html), 'utf8');
  console.log(`wrote ${OUTPUT}`);
}
