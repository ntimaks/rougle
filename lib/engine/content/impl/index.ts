import type { RelicImpl } from '../types';

import RL01 from './RL.01';
import RL02 from './RL.02';
import RL03 from './RL.03';
import RL04 from './RL.04';
import RL06 from './RL.06';
import RL07 from './RL.07';
import RL09 from './RL.09';
import RL11 from './RL.11';
import RL12 from './RL.12';
import RL13 from './RL.13';
import RL14 from './RL.14';
import RL15 from './RL.15';
import RL19 from './RL.19';
import RL20 from './RL.20';
import RL21 from './RL.21';
import RL22 from './RL.22';
import RL23 from './RL.23';
import RL26 from './RL.26';
import RL28 from './RL.28';
import RL29 from './RL.29';
import RL30 from './RL.30';
import RL31 from './RL.31';
import CN01 from './CN.01';
import CN02 from './CN.02';
import CN03 from './CN.03';
import CN05 from './CN.05';
import CH01 from './CH.01';
import CH02 from './CH.02';
import CH03 from './CH.03';

/**
 * Static, not dynamic: the map must be complete at module load so the registry
 * validator can compare it against relics.json in one synchronous pass, and so
 * the harness never pays an await per relic across a million hook calls.
 */
export const IMPLEMENTATIONS: Readonly<Record<string, RelicImpl>> = Object.freeze({
  'RL.01': RL01,
  'RL.02': RL02,
  'RL.03': RL03,
  'RL.04': RL04,
  'RL.06': RL06,
  'RL.07': RL07,
  'RL.09': RL09,
  'RL.11': RL11,
  'RL.12': RL12,
  'RL.13': RL13,
  'RL.14': RL14,
  'RL.15': RL15,
  'RL.19': RL19,
  'RL.20': RL20,
  'RL.21': RL21,
  'RL.22': RL22,
  'RL.23': RL23,
  'RL.26': RL26,
  'RL.28': RL28,
  'RL.29': RL29,
  'RL.30': RL30,
  'RL.31': RL31,
  'CN.01': CN01,
  'CN.02': CN02,
  'CN.03': CN03,
  'CN.05': CN05,
  'CH.01': CH01,
  'CH.02': CH02,
  'CH.03': CH03,
});

/**
 * Codes that exist in relics.json and are deliberately NOT implemented yet,
 * each with the reason. This list is what lets the registry validator stay
 * strict during a phased build: a code with neither an implementation nor an
 * entry here fails CI, so the data and the code cannot drift silently, while
 * the build order in technical brief §11 can still be followed a phase at a time.
 *
 * Removing an entry is how a ticket gets closed. Adding one needs a reason that
 * names either a §13 item or the phase that builds it.
 *
 * EMPTY as of the v2.0 migration. The three that were pending were each blocked
 * by something v2.0 deleted: `RL.22` Polyglot needed a hook for the shop, and
 * §6.1 adds `onShopOpen`; `RL.30` Ouroboros needed an act-start snapshot to
 * restore, and its v2.0 rule returns the bankroll to 8 rather than restarting
 * the act; `RL.31` Rosetta Slab cut the act pool's cap, and there is no cap to
 * cut, so its cost is a payout penalty instead. All 22 relics are live.
 */
export const PENDING_IMPLEMENTATION: Readonly<Record<string, string>> = Object.freeze({});
