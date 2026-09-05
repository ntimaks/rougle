/**
 * Word-list build. MECHANICS.md §8, technical brief §8.
 *
 * Build-time, never runtime. Run occasionally, review the removal report by
 * hand, commit the output in /data. Sources are fetched into `.wordsrc/` which
 * is gitignored — the generated lists are the artefact, not the inputs.
 *
 *   npx tsx scripts/build-wordlists.ts
 *
 * Pipeline (§8.1):
 *   raw → length filter                → VALID_GUESSES
 *       → frequency band (top ~8000)
 *       → strip non-words / denylist
 *       → remove ambiguity clusters    ← the important step
 *       → truncate to target           → SOLUTIONS
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve('.wordsrc');
const OUT = resolve('data');

const SOURCES = {
  dictionary: {
    file: 'words_alpha.txt',
    url: 'https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt',
  },
  frequency: {
    file: 'en_full.txt',
    url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_full.txt',
  },
  /** Case-preserving. Used only as evidence that a word exists in lower case. */
  cased: {
    file: 'words.txt',
    url: 'https://raw.githubusercontent.com/dwyl/english-words/master/words.txt',
  },
  givenNames: {
    file: 'first-names.txt',
    url: 'https://raw.githubusercontent.com/dominictarr/random-name/master/first-names.txt',
  },
  profanity: {
    file: 'profanity-en.txt',
    url: 'https://raw.githubusercontent.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/master/en',
  },
} as const;

/**
 * `rankBand` is MECHANICS.md §8.1's hard constraint: solutions come from the
 * top ~8000 words by corpus frequency. `target` is its soft one. Where they
 * disagree the band wins and the report says by how much — difficulty comes
 * from modifiers, never from rarer vocabulary (§5), so widening the band to
 * hit a list size would break the more important rule.
 *
 * `clusterThreshold` rises to 5 at length 6 and 7: longer words have more
 * distinguishing positions, so the length-5 threshold over-prunes an already
 * thin list.
 */
const LENGTHS = [
  { length: 5, rankBand: 8000, target: 1500, clusterThreshold: 4 },
  { length: 6, rankBand: 8000, target: 800, clusterThreshold: 5 },
  { length: 7, rankBand: 8000, target: 500, clusterThreshold: 5 },
] as const;

/**
 * Hand-maintained curation lists. MECHANICS.md §8.1 requires the removal report
 * to be reviewed by hand; these three lists are where that review is recorded,
 * so a judgement call made once is not made again from memory next build.
 */

/**
 * Proper nouns the mechanical name filter cannot see: surnames, places,
 * demonyms, deities, brands, and the days and months (proper nouns by English
 * convention, however ordinary they feel). Also the contraction stems the
 * subtitle corpus leaves behind when it strips apostrophes.
 */
const DENYLIST = new Set(
  (
    // Given names and surnames the filter missed
    'aaron adams allen andre anton artie avery boris brent brian bruce bruno bryan burke ' +
    'caleb carlo chang clark claus clive clyde colin craig cyrus damon dante davis derek ' +
    'devon diego doyle dylan eddie edgar elvis ernie ethan evans felix franz fritz gemma ' +
    'glenn hanna hayes hogan homer isaac jacob jared jason jonah jonas jules julio keith ' +
    'kevin klaus lewis lloyd logan louie louis manny marco mario marty matty mikey monty ' +
    'moore nigel oscar pablo pedro percy ralph reese riley romeo scott simon singh steve ' +
    'trent tyler vince wayne adrian albert andrew arthur carlos carson carter cooper ' +
    'daniel dennis donald edward elliot foster gordon graham harold harper harris harvey ' +
    'howard jeremy jordan joseph julian justin martin mickey miller nathan nelson norman ' +
    'oliver parker philip pierre robert steven taylor thomas travis victor walker walter ' +
    'warren wilson barbara charles charlie jackson johnson michael patrick richard ' +
    'russell stephen vincent william holmes hitler ' +
    // Places and demonyms
    'delhi miami milan seoul spain tokyo vegas dutch irish latin swiss africa berlin ' +
    'boston canada europe france london mexico moscow russia sydney america angeles ' +
    'chicago england germany french german indian jewish korean polish soviet united ' +
    'british chinese english italian russian spanish ' +
    // Deities, myth, brands, fiction
    'allah satan santa shiva moses christ caesar nazis spock batman ' +
    // Days and months
    'april august friday monday sunday tuesday ' +
    // Apostrophe-stripped contraction stems from the subtitle corpus
    'doesn needn weren wasn didn couldn shouldn wouldn haven hasn aren isn thats ' +
    'dunno gimme gonna gotta wanna ' +
    // Second review pass over the generated lists
    'asian china david drake egypt harry henry india italy james japan jesus jimmy jones ' +
    'kenny korea larry lenny paris peter smith texas woody ' +
    'bailey barney brazil curtis duncan hector israel johnny murphy stuart trevor watson ' +
    'anthony britain francis germans matthew ' +
    // Sexual or slur terms the shared profanity list misses
    'asses boobs horny penis prick pussy queer raped sperm'
  )
    .split(' ')
    .filter(Boolean)
    .map((w) => w.toUpperCase()),
);

/**
 * Ordinary words that are also given names. The name filter would eat them and
 * the list is thin enough already, so they are rescued explicitly.
 */
const NAME_ALLOWLIST = new Set(
  (
    'adore amber angel bliss bride bunny camel carol charity cherry cookie crystal daisy ' +
    'destiny faith fancy glory grace happy honey honor hope jewel lucky mercy olive pearl ' +
    'piper poppy raven robin storm summer sunny tuesday violet'
  )
    .split(' ')
    .map((w) => w.toUpperCase()),
);

/**
 * Is this a proper noun? Two signals, and both must agree, because either alone
 * is wrong far too often.
 *
 * 1. The word is a given name.
 * 2. The case-preserving dictionary has no lower-case entry for it — i.e. there
 *    is no evidence it is also an ordinary word.
 *
 * Surname lists were tried and rejected: 88k US surnames swallow BLACK, CHILD,
 * HOUSE, QUEEN and WHITE. The residue that this filter misses goes in DENYLIST
 * above, which is what the review step is for.
 */
function isProperNoun(word: string, givenNames: ReadonlySet<string>, cased: ReadonlySet<string>): boolean {
  if (NAME_ALLOWLIST.has(word)) return false;
  const lower = word.toLowerCase();
  const capitalised = lower[0]!.toUpperCase() + lower.slice(1);
  return givenNames.has(capitalised) && !cased.has(lower);
}

/**
 * MECHANICS.md §8.1: families where >= `threshold` candidates share >= all but
 * one position. A one-wildcard bucket finds them in a single pass.
 *
 * `_ATCH` (WATCH/BATCH/CATCH/MATCH/HATCH/LATCH) and the `-IGHT` set are the
 * canonical examples: positions where correct play still loses. Acceptable in a
 * daily puzzle, run-ending in a roguelike. They stay legal guesses.
 */
export function clusters(words: readonly string[], threshold: number): Set<string> {
  const buckets = new Map<string, string[]>();
  for (const w of words) {
    for (let i = 0; i < w.length; i++) {
      const key = `${w.slice(0, i)}_${w.slice(i + 1)}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(w);
      else buckets.set(key, [w]);
    }
  }
  const out = new Set<string>();
  for (const [, members] of buckets) {
    if (members.length >= threshold) for (const w of members) out.add(w);
  }
  return out;
}

/** Which cluster keys tripped the threshold, for the review report. */
export function clusterReport(
  words: readonly string[],
  threshold: number,
): Array<{ key: string; members: string[] }> {
  const buckets = new Map<string, string[]>();
  for (const w of words) {
    for (let i = 0; i < w.length; i++) {
      const key = `${w.slice(0, i)}_${w.slice(i + 1)}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(w);
      else buckets.set(key, [w]);
    }
  }
  return [...buckets.entries()]
    .filter(([, m]) => m.length >= threshold)
    .map(([key, members]) => ({ key, members: members.sort() }))
    .sort((a, b) => b.members.length - a.members.length || a.key.localeCompare(b.key));
}

async function ensureSource(file: string, url: string): Promise<string> {
  mkdirSync(SRC, { recursive: true });
  const path = resolve(SRC, file);
  if (!existsSync(path)) {
    process.stdout.write(`fetching ${url}\n`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    writeFileSync(path, await res.text(), 'utf8');
  }
  return readFileSync(path, 'utf8');
}

async function main(): Promise<void> {
  const dictText = await ensureSource(SOURCES.dictionary.file, SOURCES.dictionary.url);
  const freqText = await ensureSource(SOURCES.frequency.file, SOURCES.frequency.url);
  const casedText = await ensureSource(SOURCES.cased.file, SOURCES.cased.url);
  const namesText = await ensureSource(SOURCES.givenNames.file, SOURCES.givenNames.url);
  const profaneText = await ensureSource(SOURCES.profanity.file, SOURCES.profanity.url);

  const cased = new Set(casedText.split('\n').map((w) => w.trim()).filter(Boolean));
  const givenNames = new Set(
    namesText
      .split('\n')
      .map((w) => w.trim())
      .filter(Boolean)
      .map((w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase()),
  );
  const profanity = new Set(
    profaneText.split('\n').map((w) => w.trim().toUpperCase()).filter(Boolean),
  );

  const dictionary = new Set(
    dictText
      .split('\n')
      .map((w) => w.trim().toUpperCase())
      .filter((w) => /^[A-Z]+$/.test(w)),
  );

  // Rank within the dictionary, so corpus junk and proper nouns that are not
  // words never earn a rank in the first place.
  const rank = new Map<string, number>();
  for (const line of freqText.split('\n')) {
    const word = line.split(' ')[0]?.trim().toUpperCase();
    if (!word || !/^[A-Z]+$/.test(word)) continue;
    if (!dictionary.has(word) || rank.has(word)) continue;
    rank.set(word, rank.size);
  }

  mkdirSync(OUT, { recursive: true });
  const report: string[] = [
    '# Word-list build report',
    '',
    'Generated by `npx tsx scripts/build-wordlists.ts`. Review the removals by hand',
    'before committing — MECHANICS.md §8.1 requires it.',
    '',
    `Dictionary: ${dictionary.size.toLocaleString()} words. Ranked by corpus frequency: ${rank.size.toLocaleString()}.`,
    '',
  ];

  for (const spec of LENGTHS) {
    const valid = [...dictionary].filter((w) => w.length === spec.length).sort();

    const inBand = valid
      .filter((w) => (rank.get(w) ?? Infinity) < spec.rankBand)
      .sort((a, b) => rank.get(a)! - rank.get(b)!);

    const properNouns = inBand.filter((w) => isProperNoun(w, givenNames, cased));
    const afterNames = inBand.filter((w) => !isProperNoun(w, givenNames, cased));

    const denied = afterNames.filter((w) => DENYLIST.has(w) || profanity.has(w));
    const afterDenylist = afterNames.filter((w) => !DENYLIST.has(w) && !profanity.has(w));

    const clustered = clusters(afterDenylist, spec.clusterThreshold);
    const afterClusters = afterDenylist.filter((w) => !clustered.has(w));

    const solutions = afterClusters.slice(0, spec.target);
    const truncated = afterClusters.length - solutions.length;

    writeFileSync(
      resolve(OUT, `valid-${spec.length}.json`),
      JSON.stringify({ length: spec.length, count: valid.length, words: valid.join('\n') }),
      'utf8',
    );
    writeFileSync(
      resolve(OUT, `solutions-${spec.length}.json`),
      JSON.stringify({
        length: spec.length,
        count: solutions.length,
        // Alphabetical, not frequency order: the list is indexed by a seeded
        // draw, and a frequency-ordered list would bias low indices toward
        // common words if any caller ever forgot to shuffle.
        words: [...solutions].sort().join('\n'),
      }),
      'utf8',
    );

    const top = clusterReport(afterDenylist, spec.clusterThreshold);
    report.push(
      `## Length ${spec.length}`,
      '',
      `| Stage | Count |`,
      `|---|---|`,
      `| Valid guesses (dictionary, length ${spec.length}) | ${valid.length} |`,
      `| In frequency band (top ${spec.rankBand}) | ${inBand.length} |`,
      `| Removed as proper nouns | ${properNouns.length} |`,
      `| Removed by denylist / profanity | ${denied.length} |`,
      `| Removed as ambiguity clusters (threshold ${spec.clusterThreshold}) | ${clustered.size} |`,
      `| Truncated to target ${spec.target} | ${truncated} |`,
      `| **Solutions** | **${solutions.length}** |`,
      '',
    );
    if (solutions.length < spec.target * 0.9) {
      report.push(
        `> ⚠ Short of the ~${spec.target} target by ${spec.target - solutions.length}. The`,
        `> frequency band is the hard constraint (§8.1) and the target is the soft one, so`,
        `> the band was not widened. Difficulty comes from modifiers, never from rarer`,
        `> vocabulary (§5).`,
        '',
      );
    }
    if (clustered.size > 800) {
      report.push(
        `> ⚠ ${clustered.size} cluster removals is more than the ~200–400 expected at`,
        `> length 5. The frequency band is probably too wide.`,
        '',
      );
    }
    report.push(
      `Largest clusters removed (${top.length} in total):`,
      '',
      '```',
      ...top.slice(0, 25).map((c) => `${c.key.padEnd(10)} ${c.members.join(' ')}`),
      '```',
      '',
    );
    if (properNouns.length) {
      report.push('Removed as proper nouns — review these:', '', '```', properNouns.join(' '), '```', '');
    }
    if (denied.length) {
      report.push('Removed by denylist or profanity list:', '', '```', denied.join(' '), '```', '');
    }

    process.stdout.write(
      `length ${spec.length}: ${valid.length} valid, ${solutions.length} solutions ` +
        `(${properNouns.length} proper nouns, ${clustered.size} clustered, ${denied.length} denied)\n`,
    );
  }

  writeFileSync(resolve(OUT, 'BUILD-REPORT.md'), report.join('\n'), 'utf8');
  process.stdout.write('wrote data/ and data/BUILD-REPORT.md\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    process.stderr.write(`${String(err)}\n`);
    process.exit(1);
  });
}
