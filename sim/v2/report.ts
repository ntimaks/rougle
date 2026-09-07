import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ECONOMY, withEconomy } from '../../lib/engine/economy/config';
import { DEFAULT_SOLVER, type SolverConfig } from '../solver';
import { playBleed, runStructure, type BleedResult } from './bleed';
import { LOADOUTS, guessDistribution, guessSequence, valueOf } from './relicvalue';

/** The calibrated handicap — a competent human at ~3.9 guesses/word, not the bot. */
function calibrated(): SolverConfig {
  const path = resolve('sim/calibration.json');
  if (!existsSync(path)) return DEFAULT_SOLVER;
  const saved = JSON.parse(readFileSync(path, 'utf8')) as { solver?: Partial<SolverConfig> };
  return { ...DEFAULT_SOLVER, ...(saved.solver ?? {}) };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: readonly number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

function sweep(runs: number, opts: Parameters<typeof playBleed>[1]): BleedResult[] {
  return Array.from({ length: runs }, (_, i) => playBleed(`V2B${i}`, opts));
}

function row(label: string, rs: BleedResult[]): string {
  const dead = rs.filter((r) => !r.survived);
  const doomed = dead.filter((r) => r.doomedAtWord >= 0);
  return (
    `  ${label.padEnd(30)}` +
    ` ${pct(rs.filter((r) => r.survived).length / rs.length).padStart(6)}` +
    `  ${median(dead.map((r) => r.diedAtWord)).toFixed(0).padStart(3)}` +
    `  ${mean(rs.map((r) => mean(r.guessesByWord))).toFixed(2)}` +
    `  ${mean(rs.map((r) => r.goldEarned)).toFixed(0).padStart(5)}` +
    `  ${mean(rs.map((r) => r.refillsBought)).toFixed(1).padStart(4)}` +
    `  ${mean(rs.map((r) => r.emergenciesBought)).toFixed(2)}` +
    `  ${median(doomed.map((r) => r.doomedToDead)).toFixed(1).padStart(4)}`
  );
}

function main(): void {
  const runs = Number(process.argv[2] ?? 400);
  const solver = calibrated();
  const base = {
    buyRefills: true,
    longWords: false,
    elites: [1, 2, 3],
    goldScale: 1,
    refillsPerShop: 3,
    payoutBonus: () => 0,
    solver,
    cfg: ECONOMY,
  };

  console.log(`ROUGLE v2.0 BLEED MODEL · ${runs} runs · MECHANICS.md §2.3, §11.2, §14 Phase 2`);
  console.log(`solver: suboptimality=${solver.suboptimality} vocabularyGap=${solver.vocabularyGap}`);
  console.log(`\nNO RELICS. §11.5 wants a relic-less run to win under 2%.`);
  console.log(`${runStructure(false).length} words: 12 solve nodes + bosses of 2, 1 and 5.\n`);
  console.log(
    '  setting                          win  died@  g/word   gold  refl  emerg  d2d',
  );

  console.log(row('start 12 · refills', sweep(runs, { ...base, start: 12 })));
  console.log(row('start 12 · NO refills', sweep(runs, { ...base, start: 12, buyRefills: false })));
  console.log(row('start 14 (Linguist)', sweep(runs, { ...base, start: 14 })));
  console.log(row('start  9 (Gambler)', sweep(runs, { ...base, start: 9 })));
  console.log(row('start 12 · long words', sweep(runs, { ...base, start: 12, longWords: true })));
  console.log(row('start 12 · no elites (poorest)', sweep(runs, { ...base, start: 12, elites: [0, 0, 0] })));

  console.log(`\n§4.1 sells a guess refill at ${ECONOMY.refillCost}g, 3 a shop, 12 shops.`);
  console.log(`That is 36 bankroll for ${36 * ECONOMY.refillCost}g against ~900g of income.\n`);
  console.log(
    '  setting                          win  died@  g/word   gold  refl  emerg  d2d',
  );
  for (const refillCost of [25, 50, 75, 100, 150]) {
    console.log(
      row(`refill ${refillCost}g`, sweep(runs, { ...base, start: 12, cfg: withEconomy({ refillCost }) })),
    );
  }
  // §7 makes modifiers "the entire difficulty curve" and this model has none,
  // so 3.93 guesses/word is a FLOOR. A worse solver stands in for harder words:
  // the question is how much harder the game has to get before a relic-less run
  // stops winning, and the answer is the honest size of the gap.
  console.log(`\n§7's modifiers are absent here, so guesses/word is a floor.`);
  console.log(
    '  setting                          win  died@  g/word   gold  refl  emerg  d2d',
  );
  for (const gap of [0.0938, 0.25, 0.45, 0.65]) {
    console.log(
      row(
        `vocabularyGap ${gap}`,
        sweep(runs, { ...base, start: 12, solver: { ...solver, vocabularyGap: gap } }),
      ),
    );
  }

  console.log('');
  for (const scale of [1, 0.6, 0.4]) {
    console.log(
      row(
        `node gold x${scale}`,
        sweep(runs, { ...base, start: 12, goldScale: scale }),
      ),
    );
  }

  // The number the design actually needs: what a run is short by, per word.
  const rs = sweep(runs, { ...base, start: 12 });
  const dead = rs.filter((r) => !r.survived);
  console.log(`\n§2.3 says the default state is a bleed and every relic exists to close it.`);
  console.log(`  runs finishing all 20 words          ${pct(1 - dead.length / rs.length)}`);
  console.log(`  median word a run dies on            ${median(dead.map((r) => r.diedAtWord))} of 20`);
  console.log(`  median words left unplayed at death  ${median(dead.map((r) => r.deficit))}`);
  console.log(`  mean guesses/word (the whole story)  ${mean(rs.map((r) => mean(r.guessesByWord))).toFixed(2)}`);

  const curve = rs[0]!.bankrollByWord.length;
  const byWord = Array.from({ length: curve }, (_, i) =>
    mean(rs.filter((r) => r.bankrollByWord.length > i).map((r) => r.bankrollByWord[i]!)),
  );
  console.log(`\n§11.3 bankroll curve, mean by word index (start ${12}):`);
  console.log('  ' + byWord.map((b, i) => `${i + 1}:${b.toFixed(0)}`).join('  '));

  // §14's other half: does buying a relic feel like relief?
  const words = 1500;
  const dist = guessDistribution(words, solver);
  const seq = guessSequence(words, solver);
  console.log(`\n§6.4 the impact test — what a §2.3 payout relic is worth`);
  console.log(`  ${words} real solves, 5-letter, mean ${dist.mean.toFixed(2)} guesses`);
  console.log(
    '  ' +
      dist.counts
        .map((n, i) => (n ? `${i}:${pct(n / words)}` : null))
        .filter(Boolean)
        .join('  '),
  );
  console.log(
    `  solves in three or fewer            ${pct(dist.fastShare)}   <- every one of them is gated on this`,
  );
  console.log('');
  console.log('  loadout                            net/word  mean bonus  pays on');
  const bleedNow = valueOf(LOADOUTS[0]!, seq).netPerWord;
  for (const l of LOADOUTS) {
    const v = valueOf(l, seq);
    console.log(
      `  ${v.label.padEnd(34)}` +
        ` ${v.netPerWord.toFixed(2).padStart(6)}` +
        `    ${v.meanBonus.toFixed(2).padStart(5)}` +
        `      ${pct(v.hitRate).padStart(6)}`,
    );
  }
  console.log(`\n  §2.3's bleed with nothing held is ${bleedNow.toFixed(2)} a word.`);
  console.log(`  A relic must be worth ${(-bleedNow).toFixed(2)} a word just to reach break-even.`);

  const doomed = dead.filter((r) => r.doomedAtWord >= 0);
  console.log(`\n§11.2 the death spiral — the gating metric`);
  console.log(`  deaths where the run was already arithmetically over  ${pct(doomed.length / Math.max(1, dead.length))}`);
  console.log(`  median words played between doomed and dead           ${median(doomed.map((r) => r.doomedToDead))}`);
  console.log(`  §11.2 wants this under two minutes of play. A word is roughly 30-60s,`);
  console.log(`  so more than about 3 words is over budget.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
