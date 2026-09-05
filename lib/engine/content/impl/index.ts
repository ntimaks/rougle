import type { RelicImpl } from '../types';

import RL01 from './RL.01';
import RL02 from './RL.02';
import RL03 from './RL.03';
import RL04 from './RL.04';
import RL05 from './RL.05';
import RL06 from './RL.06';
import RL07 from './RL.07';
import RL10 from './RL.10';
import RL11 from './RL.11';
import RL12 from './RL.12';
import RL13 from './RL.13';
import RL14 from './RL.14';
import RL18 from './RL.18';
import RL19 from './RL.19';
import RL20 from './RL.20';
import RL21 from './RL.21';
import RL23 from './RL.23';
import RL24 from './RL.24';
import RL26 from './RL.26';
import RL28 from './RL.28';
import RL29 from './RL.29';
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
  'RL.05': RL05,
  'RL.06': RL06,
  'RL.07': RL07,
  'RL.10': RL10,
  'RL.11': RL11,
  'RL.12': RL12,
  'RL.13': RL13,
  'RL.14': RL14,
  'RL.18': RL18,
  'RL.19': RL19,
  'RL.20': RL20,
  'RL.21': RL21,
  'RL.23': RL23,
  'RL.24': RL24,
  'RL.26': RL26,
  'RL.28': RL28,
  'RL.29': RL29,
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
 */
export const PENDING_IMPLEMENTATION: Readonly<Record<string, string>> = Object.freeze({
  'RL.09': 'Needs forge nodes (Phase 3, R-08) and the §13 I-07 pool-max ruling. Ticket C-05.',
  'RL.15': 'Needs elite nodes and the node reward path (Phase 3, R-05). Ticket C-05.',
  'RL.16': 'Needs shop nodes and purchase tracking (Phase 3, R-07). Ticket C-05.',
  'RL.22': 'Needs long words and rarity-tier bumping in offer generation (Phase 4). Ticket C-05.',
  'RL.25': 'Needs the emergency ladder wired to the shop economy (Phase 3, R-09).',
  'RL.27': 'Blocked by §13 I-15 — a pool that refills to its cap has no room for a carry.',
  'RL.30': 'Needs actStartSnapshot restore and the §13 I-11 acquisition-order ruling. C-05.',
  'RL.31': 'Blocked by §13 I-03 (suppression order) and §13 I-07 (mid-act pool-max). C-05.',
});
