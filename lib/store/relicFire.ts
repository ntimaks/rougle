import { REGISTRY, type GameEvent } from '@/lib/engine';

/**
 * Which relics fired in this event batch, and what each of them did.
 *
 * Raised from playtest: relics are "very low feedback". Tin Cup pays 5g a guess
 * and the only evidence is a gold counter that was going to move anyway; the
 * Moth eats a letter and hands back a guess and the pool just... looks
 * different. A player who cannot see a relic fire cannot learn what it does,
 * and a build they cannot read is a build they cannot make on purpose.
 *
 * No engine change was needed. Relic implementations already stamp their code
 * into the `reason` or `source` of every effect they emit, because those
 * strings were written for the debug log. Reading them back is free.
 */

export interface RelicFire {
  code: string;
  /** What it did, in the fewest words that are still true. */
  label: string;
}

const CODE = /^(RL|CN|CH)\.\d+$/;

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/** The source code stamped on an event, or null if it was not a relic's doing. */
function sourceOf(event: GameEvent): string | null {
  const raw =
    'source' in event && typeof event.source === 'string'
      ? event.source
      : 'reason' in event && typeof event.reason === 'string'
        ? event.reason
        : null;
  return raw && CODE.test(raw) ? raw : null;
}

function labelFor(event: GameEvent): string | null {
  switch (event.type) {
    case 'GOLD_CHANGED':
      return `${signed(event.delta)}g`;
    case 'POOL_CHANGED':
      return `${signed(event.delta)} guess${Math.abs(event.delta) === 1 ? '' : 'es'}`;
    case 'REFUND_GRANTED':
      return `+${event.amount} refunded`;
    case 'POOL_MAX_CHANGED':
      return `${signed(event.delta)} max`;
    case 'LETTER_LOCKED':
      return `${event.letter} locked`;
    case 'TILE_PRESET':
      return 'letter revealed';
    case 'META_REVEALED':
      return event.field === 'vowelCount' ? 'vowel count' : 'read';
    case 'RELIC_UPGRADED':
      return 'MK.II';
    default:
      return null;
  }
}

/**
 * Collapses a batch to one entry per relic. Two effects from one relic on one
 * frame read as one thing happening, because that is what it was — the player
 * pressed once.
 */
export function relicFires(events: readonly GameEvent[]): RelicFire[] {
  const byCode = new Map<string, string[]>();
  for (const event of events) {
    const code = sourceOf(event);
    if (!code || !REGISTRY[code]) continue;
    const label = labelFor(event);
    if (!label) continue;
    const list = byCode.get(code) ?? [];
    if (!list.includes(label)) list.push(label);
    byCode.set(code, list);
  }
  return [...byCode.entries()].map(([code, labels]) => ({ code, label: labels.join(' · ') }));
}
