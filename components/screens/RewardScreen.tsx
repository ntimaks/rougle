'use client';

import { useState } from 'react';
import type { GameState } from '@/lib/engine';
import { Button } from '@/components/cmp/Button';
import { RelicCard } from '@/components/cmp/RelicCard';
import { REGISTRY } from '@/lib/engine';
import { useGame } from '@/lib/store/useGame';

/**
 * S.05 — relic reward. One of three, seeded and reproducible.
 *
 * Selection is a two-step: tap to select, then confirm. The offer is the most
 * consequential decision in a run and a mis-tap that spends it would be the
 * worst possible way to lose one.
 */
export function RewardScreen({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch);
  const [picked, setPicked] = useState<string | null>(null);
  const offer = state.pendingOffer;
  const goldInstead = offer?.goldInstead ?? null;
  if (!offer) return null;

  const held = state.relics.map((r) => r.code);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-none border-b border-dark3 px-4 pb-[11px] pt-[14px]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] leading-none tracking-[0.2em] text-fg2">
            NODE CLEARED
          </span>
        </div>
        <h2 className="mt-[7px] font-display text-[24px] font-bold uppercase leading-none tracking-[-0.02em]">
          Take one relic
        </h2>
      </div>

      <div className="flex flex-1 flex-col gap-[10px] overflow-y-auto px-4 py-3">
        {offer.codes.map((code, i) => (
          <RelicCard
            key={code}
            code={code}
            held={held}
            index={i}
            selected={picked === code}
            dimmed={picked !== null && picked !== code}
            onTap={() => setPicked(code)}
          />
        ))}
      </div>

      <div className="flex flex-none flex-col gap-2 border-t border-dark3 bg-panel px-4 pb-[14px] pt-3">
        <Button
          primary={picked !== null}
          disabled={picked === null}
          arrow
          onClick={() => picked && dispatch({ type: 'ACCEPT_OFFER', code: picked })}
        >
          {picked ? `TAKE ${REGISTRY[picked]?.name ?? picked}` : 'SELECT ONE'}
        </Button>
        {/*
          R-025 — refusing is a purchase, not a dismissal. On a word node the
          relic and the gold are one choice, so the secondary action names its
          price. On an elite or a boss the gold is already paid and refusing
          really is refusing, so it says so rather than implying a trade.
        */}
        <button
          type="button"
          onClick={() => dispatch({ type: 'SKIP_OFFER' })}
          className={`min-h-[44px] font-mono text-[10px] leading-none tracking-[0.14em] ${
            goldInstead ? 'text-accent' : 'text-fg3'
          }`}
        >
          {goldInstead ? `TAKE ${goldInstead}g INSTEAD` : 'TAKE NOTHING'}
        </button>
      </div>
    </div>
  );
}
