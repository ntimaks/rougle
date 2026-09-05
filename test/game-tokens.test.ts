import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OUTPUT, PROTOTYPE, buildCss } from '../scripts/extract-game-tokens';

/**
 * S-02 — design values are imported, never redeclared.
 *
 * The `--g-*` colour layer is not in the NIKOLASS token bundle; it lives in the
 * prototype. It has to live somewhere in the app, so it is generated, and this
 * asserts the generated file still matches its source. Without the check the
 * "never redeclare a design value" rule is a convention; with it, it is a
 * failing test.
 */
describe('generated game tokens', () => {
  it('match the design prototype', () => {
    const expected = buildCss(readFileSync(resolve(PROTOTYPE), 'utf8'));
    const actual = readFileSync(resolve(OUTPUT), 'utf8');
    expect(actual, 'run: npx tsx scripts/extract-game-tokens.ts').toBe(expected);
  });
});

/** Comments are prose. A hex NAMED in an explanation is documentation. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('no hex literals in components', () => {
  it('every colour comes from a token', async () => {
    const { globSync } = await import('node:fs');
    const files = globSync('components/**/*.{ts,tsx}');
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const code = stripComments(readFileSync(file, 'utf8'));
      const hexes = code.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
      expect(hexes, `${file} declares a colour instead of importing one`).toEqual([]);
    }
  });

  it('the check would still catch a real declaration', () => {
    expect(stripComments('const a = "#FF0000";').match(/#[0-9a-fA-F]{3,8}\b/g)).toEqual(['#FF0000']);
    expect(stripComments('// the prototype says #FF0000').match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
  });
});
