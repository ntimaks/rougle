import {
  CONFIG,
  DOMAIN,
  draw,
  formatSeed,
  hash32,
  initialState,
  projectBoard,
  reduce,
  heldRelics,
  refillCost,
  scalingCounters,
  shopPrice,
  type CharacterCode,
  type GameConfig,
  type GameState,
  wordList,
} from '../lib/engine';
import { EVENTS } from '../lib/engine/content/events';
import { REGISTRY } from '../lib/engine/content/registry';
import '../lib/engine/words/all';
import {
  DEFAULT_SOLVER,
  chooseGuess,
  knownSolutions,
  type SolverConfig,
  type SolverView,
} from './solver';

/**
 * Plays one seeded run headlessly. No UI, no timers, no I/O.
 *
 * Every decision the bot makes is addressed off the run seed, so a run is a
 * pure function of (seed, character, solver config) and replays byte-identically
 * — which is Gate 1.
 */

export interface RunResult {
  seed: string;
  characterCode: CharacterCode;
  won: boolean;
  deathCause: string | null;
  deathActIndex: number;
  deathNodeId: string | null;
  /**
   * Death-cause attribution (MECHANICS.md §10.1). Captured at the guess that
   * emptied the pool:
   *  - answerKnown: the answer was still in the bot's candidate set, so the
   *    deduction was sound and the budget or the word ran out, not the player.
   *  - candidatesRemaining: how many indistinguishable candidates were left.
   * Together they separate "ran out of guesses" from "was forced to coin-flip
   * between four words that differ by one letter", which is the §8.1 failure.
   */
  deathWithAnswerKnown: boolean;
  deathCandidatesRemaining: number;
  wordsSolved: number;
  guessesSpent: number;
  /** §2.3 payout, run total. With `guessesSpent`, this is the bleed. */
  payoutsGranted: number;
  guessesPerWord: number[];
  guessesPerWordByAct: Array<number[]>;
  /** Guesses spent on each act's boss. B-06 measures the Twins from this. */
  bossGuessesByAct: Array<number[]>;
  cleanFiveLetterGuesses: number[];
  goldEarned: number;
  goldSpent: number;
  /** §4.1 — rungs of the shared refill ladder bought, shop and forge together. */
  refillsBought: number;
  emergencyPurchases: number;
  relicsTaken: string[];
  /** §11.5 — "median relics held at death", target 3-5. */
  relicsHeld: number;
  /** §11.3 — "scaling-relic counter values at run end". */
  scalingAtEnd: Array<{ code: string; label: string; value: number }>;
  /** §11.3 — the bankroll after each word, so the curve can be plotted. */
  bankrollByWord: number[];
  /**
   * §11.2 — words between DOOMED and DEAD, or null if the run never became
   * doomed (it won, or it died from a spike rather than a spiral).
   *
   * "Doomed" is approximated as: the bankroll can no longer cover the words
   * left before the next boss at the run's own measured cost per word, with no
   * emergency rung and no refill left to buy. That is weaker than §11.2's "no
   * reachable line of play" — a lucky run of two-guess solves can still escape
   * it — so treat it as an UPPER bound on the doomed count and a lower bound on
   * how bad the spiral is. The exact metric needs a search over lines of play
   * and is still owed.
   */
  doomedWords: number | null;
  finalGold: number;
  finalBankroll: number;
  turns: number;
}

const MAX_ACTIONS = 4000;

export interface RunOptions {
  /** §11.5 — "win rate, no relics purchased", target <2%. */
  noRelics?: boolean;
  /** Measure the game with the shop inert, for an A/B on the §4 sinks. */
  noShopping?: boolean;
  /** Never buy a refill or an emergency rung, for an A/B on the valves. */
  noValves?: boolean;
  /** Overrides for the shop policy below. */
  shopPolicy?: Partial<ShopPolicy>;
}

/**
 * When the bot buys what. A FLOOR, not optimal play, and every number the
 * harness reports is bounded by it.
 *
 * §4's whole claim is that gold buys builds and buys survival at a penalty, so
 * the policy has to be able to express both and choose. It does it in one
 * order: survive if you are about to die, otherwise buy the best relic you can
 * afford. It never rerolls and never sells, because both are judgement calls
 * about a board the bot cannot evaluate — which means the measured relic count
 * is a lower bound and the measured gold surplus an upper one.
 */
export interface ShopPolicy {
  /** Buy a refill at or below this bankroll, before buying anything else. */
  refillAt: number;
  /** Keep this much gold back for the next shop rather than spending it all. */
  reserve: number;
}

export const SHOP_POLICY: ShopPolicy = {
  refillAt: 6,
  reserve: 0,
};

export function playRun(
  seed: string,
  characterCode: CharacterCode = 'CH.01',
  solver: SolverConfig = DEFAULT_SOLVER,
  cfg: Readonly<GameConfig> = CONFIG,
  options: RunOptions = {},
): RunResult {
  let s: GameState = initialState(seed, characterCode);
  s = reduce(s, { type: 'START_RUN', seed, characterCode }, cfg).state;

  const guessesPerWordByAct: number[][] = [[], [], []];
  const bossGuessesByAct: number[][] = [[], [], []];
  const cleanFive: number[] = [];
  const bankrollByWord: number[] = [];
  let deathWithAnswerKnown = false;
  let deathCandidatesRemaining = 0;
  let actions = 0;
  let doomedAtWord: number | null = null;
  const policy = { ...SHOP_POLICY, ...options.shopPolicy };

  const known = new Map<number, ReturnType<typeof knownSolutions>>();
  const vocabRng = (i: number) => draw(seed, 'solver:vocab', i);

  while (s.phase !== 'DEATH' && s.phase !== 'VICTORY') {
    if (++actions > MAX_ACTIONS) {
      throw new Error(`Run ${seed} exceeded ${MAX_ACTIONS} actions — the loop is not terminating.`);
    }

    switch (s.phase) {
      case 'MAP': {
        // Route choice is a real decision now (R-01), and the bot does not make
        // it: it always walks the first available node. That is a deliberate
        // floor, not an oversight — a bot that picked optimally would hide how
        // punishing a bad route is, which is the thing route design is for.
        const nodeId = s.map.available[0];
        if (!nodeId) throw new Error(`Run ${seed} is on the map with nowhere to go.`);
        s = reduce(s, { type: 'SELECT_NODE', nodeId }, cfg).state;
        break;
      }

      case 'SHOP': {
        // Survival first: one refill when the bankroll is nearly out. §4.2
        // prices it deliberately worse than a relic, so a bot that reaches for
        // it before it has to is measuring the wrong game.
        if (!options.noValves && s.bankroll <= policy.refillAt) {
          const refill = reduce(s, { type: 'BUY_REFILL' }, cfg);
          if (!refill.error) s = refill.state;
        }

        // Then build. "Most expensive affordable" is "highest rarity" under
        // §4.2's flat table, and R-048 makes rarity a real proxy for value —
        // so this is the closest a policy gets to "buy the best thing" without
        // the bot evaluating a board it cannot read.
        if (!options.noRelics && !options.noShopping) {
          for (;;) {
            const best = (s.shop?.stock ?? [])
              .map((item, slot) => ({ item, slot }))
              .filter(
                ({ item }) =>
                  !item.sold &&
                  item.price <= s.gold - policy.reserve &&
                  !REGISTRY[item.code]?.isConsumable,
              )
              .sort((a, b) => b.item.price - a.item.price)[0];
            if (!best) break;
            const bought = reduce(s, { type: 'BUY_STOCK', slot: best.slot }, cfg);
            if (bought.error) break;
            s = bought.state;
            // §6.2 — a full board turns the purchase into a comparison. The bot
            // makes the crudest version of it: destroy the cheapest thing held.
            if (s.pendingReplace) s = dropCheapest(s, cfg);
          }
        }
        s = reduce(s, { type: 'LEAVE_NODE' }, cfg).state;
        break;
      }

      case 'FORGE': {
        // Upgrade the first relic THIS FORGE OFFERS (R-035); if it offers
        // nothing upgradeable, buy guesses. Reading `relics` here instead would
        // pick something outside the offer, take NOT_IN_OFFER, and break out of
        // the loop — leaving the bot standing in a forge doing nothing at all,
        // which is a silent measurement bug rather than a visible failure.
        while ((s.forge?.operationsLeft ?? 0) > 0) {
          const target = s.forge!.candidates.find(
            (id) => !s.relics.find((r) => r.instanceId === id)?.upgraded,
          );
          const op = target
            ? reduce(s, { type: 'FORGE_UPGRADE', instanceId: target }, cfg)
            : options.noValves
              ? { state: s, error: { code: 'NO_OPERATIONS' } as const }
              : reduce(s, { type: 'FORGE_REFILL' }, cfg);
          if (op.error) break;
          s = op.state;
        }
        s = reduce(s, { type: 'LEAVE_NODE' }, cfg).state;
        break;
      }

      case 'EVENT': {
        // Always the last option, which §6.8 guarantees is the non-destructive
        // one. Understates events badly and says so in the report caveat — a bot
        // that never gambles cannot measure a system built on gambles.
        const def = s.event ? EVENTS[s.event.code] : undefined;
        const key = def?.options.at(-1)?.key;
        const chosen = key
          ? reduce(s, { type: 'CHOOSE_EVENT_OPTION', key }, cfg)
          : { state: s, error: { code: 'NO_SUCH_OPTION' } as const };
        s = chosen.error ? reduce(s, { type: 'LEAVE_NODE' }, cfg).state : chosen.state;
        break;
      }

      case 'WORD': {
        const word = s.word!;
        const actIndex = s.actIndex;
        const before = word.history.length;
        const solutionIndex = word.solved.findIndex((v) => !v);
        const target = word.solutions[Math.max(0, solutionIndex)]!;

        if (!known.has(word.length)) {
          known.set(word.length, knownSolutions(word.length, solver, vocabRng));
        }

        const buildView = (state: GameState): SolverView => {
          const w = state.word!;
          const projected = projectBoard(state, w, undefined, cfg);
          return {
            length: w.length,
            modifiers: w.modifiers,
            board: projected,
            // board.locked, not word.lockedLetters: RL.02 The Sieve adds
            // proven-grey letters, and the engine will reject a guess using one.
            locked: projected.locked,
            presetTiles: w.presetTiles,
            revealed: w.revealed,
            solutionIndex: Math.max(0, solutionIndex),
          };
        };

        const view = buildView(s);

        const choice = chooseGuess(
          view,
          known.get(word.length)!,
          {
            cfg: solver,
            rng: (i) => draw(seed, DOMAIN.relic(`solver:${word.nodeId}`, 'choose'), i),
          },
          target,
        );

        const result = reduce(s, { type: 'SUBMIT_GUESS', guess: choice.guess }, cfg);
        if (result.error) {
          // An illegal guess (locked letter, not in the list) costs the bot a
          // turn's worth of nothing; fall back to any legal candidate.
          const fallback = fallbackGuess(s, view);
          if (!fallback) throw new Error(`Run ${seed}: no legal guess (${result.error.code}).`);
          s = reduce(s, { type: 'SUBMIT_GUESS', guess: fallback }, cfg).state;
        } else {
          s = result.state;
        }

        if (!s.word || s.word.history.length !== before + 1 || s.phase !== 'WORD') {
          // The word ended on this guess.
          const used = before + 1;
          if (s.stats.guessesPerWord.length > guessesPerWordByAct.flat().length) {
            guessesPerWordByAct[actIndex]!.push(used);
            if (word.nodeId.endsWith('-boss')) bossGuessesByAct[actIndex]!.push(used);
            if (word.length === 5 && word.modifiers.length === 0) cleanFive.push(used);
            bankrollByWord.push(s.bankroll);
            if (doomedAtWord === null && isDoomed(s, cfg)) {
              doomedAtWord = bankrollByWord.length;
            }
          }
        }
        if (s.phase === 'EMERGENCY' || s.phase === 'DEATH') {
          deathWithAnswerKnown = !choice.lostTheAnswer;
          deathCandidatesRemaining = choice.candidatesRemaining;
        }
        break;
      }

      case 'REWARD': {
        // §3.3 — the only offer left in the game is the boss's 1-of-2. It is
        // free, so `noRelics` has to decline it explicitly or the "bought
        // nothing" run would still finish holding three boss relics.
        const offer = s.pendingOffer;
        if (!offer || options.noRelics) {
          s = reduce(s, { type: offer ? 'SKIP_OFFER' : 'ADVANCE' }, cfg).state;
          break;
        }
        s = reduce(s, { type: 'ACCEPT_OFFER', code: offer.codes[0]! }, cfg).state;
        break;
      }

      case 'REPLACE': {
        s = dropCheapest(s, cfg);
        break;
      }

      case 'EMERGENCY': {
        const buy = options.noValves
          ? { state: s, error: { code: 'UNAFFORDABLE' } as const }
          : reduce(s, { type: 'BUY_EMERGENCY' }, cfg);
        s = buy.error ? reduce(s, { type: 'DECLINE_EMERGENCY' }, cfg).state : buy.state;
        break;
      }

      default:
        s = reduce(s, { type: 'ADVANCE' }, cfg).state;
    }
  }

  return {
    seed,
    characterCode,
    won: s.phase === 'VICTORY',
    deathCause: s.outcome?.cause ?? null,
    deathActIndex: s.actIndex,
    deathNodeId: s.stats.deathNodeId,
    deathWithAnswerKnown,
    deathCandidatesRemaining,
    wordsSolved: s.stats.wordsSolved,
    guessesSpent: s.stats.guessesSpent,
    payoutsGranted: s.stats.payoutsGranted,
    guessesPerWord: s.stats.guessesPerWord,
    guessesPerWordByAct,
    bossGuessesByAct,
    cleanFiveLetterGuesses: cleanFive,
    goldEarned: s.stats.goldEarned,
    goldSpent: s.stats.goldSpent,
    refillsBought: s.stats.refillsBought,
    emergencyPurchases: s.stats.emergencyPurchases,
    relicsTaken: s.stats.relicsTaken,
    relicsHeld: heldRelics(s).length,
    scalingAtEnd: scalingCounters(s).map(({ code, label, value }) => ({ code, label, value })),
    bankrollByWord,
    doomedWords:
      doomedAtWord === null ? null : Math.max(0, bankrollByWord.length - doomedAtWord),
    finalGold: s.gold,
    finalBankroll: s.bankroll,
    turns: actions,
  };
}

/**
 * §6.2's comparison, at its crudest: destroy the cheapest relic held.
 *
 * Under §4.2 price IS rarity, so this drops the lowest tier — which is the
 * right shape and the wrong resolution, because it cannot tell a common that
 * anchors a build from one that does nothing. The measured relic quality is
 * therefore a lower bound.
 */
function dropCheapest(s: GameState, cfg: Readonly<GameConfig>): GameState {
  const held = [...heldRelics(s)].sort((a, b) => shopPrice(a.code) - shopPrice(b.code));
  const victim = held[0];
  if (!victim) return reduce(s, { type: 'SKIP_OFFER' }, cfg).state;
  const done = reduce(s, { type: 'REPLACE_RELIC', instanceId: victim.instanceId }, cfg);
  return done.error ? reduce(s, { type: 'SKIP_OFFER' }, cfg).state : done.state;
}

/**
 * §11.2's DOOMED, approximated. See `RunResult.doomedWords` for what this is
 * and is not.
 *
 * "No valve left" is the load-bearing half: while an emergency rung or a refill
 * is still affordable there is a line of play, however bad. Once both are gone
 * the bankroll is all there is, and 1.8 a word is the §2.3 bleed a solver at
 * the human baseline actually pays.
 */
const BLEED_PER_WORD = 1.8;

function isDoomed(s: GameState, cfg: Readonly<GameConfig>): boolean {
  const rung = cfg.economy.emergencyCosts[s.emergencyPurchases];
  if (rung !== undefined && s.gold >= rung) return false;
  const refill = refillCost(s, cfg);
  if (refill !== null && s.gold >= refill) return false;
  // Words still to play before the next boss pays out: the act's solve nodes
  // not yet visited, plus the boss itself.
  const solveNodesLeft = Math.max(
    0,
    cfg.acts[s.actIndex]!.solveNodes - s.stats.guessesPerWord.length % cfg.acts[s.actIndex]!.solveNodes,
  );
  return s.bankroll < (solveNodesLeft + 1) * BLEED_PER_WORD;
}

/**
 * Any legal word at all. Reached when the solver's candidate set has been
 * locked out from under it; searches the full guess list rather than the
 * solution list, because a probe only has to be legal, not plausible.
 */
function fallbackGuess(s: GameState, view: SolverView): string | null {
  const locked = new Set(view.locked);
  for (const word of wordList(view.length).valid) {
    if ([...word].some((c) => locked.has(c))) continue;
    if (!reduce(s, { type: 'SUBMIT_GUESS', guess: word }).error) return word;
  }
  return null;
}

/** Deterministic seed for run `n` of a sweep. */
export function sweepSeed(label: string, n: number): string {
  return formatSeed(hash32(`${label}:${n}`));
}
