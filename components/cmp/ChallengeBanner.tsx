'use client';

import type { PendingChallenge } from '@/lib/engine';

/**
 * An event's `word_challenge`, riding on the word it applies to.
 *
 * Distinct from the modifier banner on purpose. A modifier says how this word
 * is HARDER; a challenge says what you have STAKED on it — EV.01 puts a relic
 * on a two-guess solve. Those are different kinds of pressure and reading them
 * as one strip would bury the one that can cost you a relic.
 *
 * So it sits above the modifiers, reads in the red rather than the amber, and
 * states the count as a countdown rather than a rule.
 */
export function ChallengeBanner({
  challenge,
  guessesUsed,
}: {
  challenge: PendingChallenge;
  guessesUsed: number;
}) {
  const left = challenge.limit === null ? null : challenge.limit - guessesUsed;
  const doomed = left !== null && left <= 0;

  return (
    <div
      className="flex flex-none items-center gap-2 border-b px-3 py-[7px]"
      style={{
        borderColor: 'var(--term-red)',
        background: 'color-mix(in srgb, var(--term-red) 10%, var(--term-bg))',
      }}
      role="status"
    >
      <span className="flex-none border border-red px-[5px] py-[3px] font-mono text-[9px] font-bold leading-none tracking-[0.16em] text-red">
        WAGER
      </span>
      <span className="font-mono text-[9px] leading-none tracking-[0.14em] text-fg1">
        {challenge.limit === null ? 'CLEAR THIS WORD' : `SOLVE IN ${challenge.limit}`}
      </span>
      {left !== null && (
        <span
          className={`ml-auto font-mono text-[11px] font-bold leading-none ${
            doomed ? 'text-red' : 'text-amber'
          }`}
        >
          {doomed ? 'LOST' : `${left} LEFT`}
        </span>
      )}
    </div>
  );
}
