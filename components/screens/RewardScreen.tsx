'use client';

import { useState } from 'react';
import { heldRelics, type GameState } from '@/lib/engine';
import { Button } from '@/components/cmp/Button';
import { RelicCard } from '@/components/cmp/RelicCard';
import { REGISTRY } from '@/lib/engine';
import { useGame } from '@/lib/store/useGame';

/**
 * S.05 — two screens that are the same screen.
 *
 * §3.3's boss reward is a choice of 1 of 2 boss relics, and §6.2's full board
 * is a choice of which of 5 to destroy for an incoming 6th. Both are "pick one
 * card, confirm, or take nothing", and both are the moment a run's build is
 * decided — so they share the layout, the two-step commit and the decline.
 *
 * Selection is a two-step: tap to select, then confirm. A mis-tap that spent a
 * boss relic, or destroyed the wrong one of five, would be the worst possible
 * way to lose a run.
 */
export function RewardScreen({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch);
  const [picked, setPicked] = useState<string | null>(null);
  const replacing = state.pendingReplace;
  const offer = state.pendingOffer;
  if (!offer && !replacing) return null;

  const held = state.relics.map((r) => r.code);
  // §6.2 — "with the incoming relic visible alongside the five held". The card
  // being chosen is a DESTRUCTION when replacing, so the cards on offer are the
  // ones held, and the incoming relic is the header.
  const codes = replacing ? heldRelics(state).map((r) => r.code) : offer!.codes;
  const instanceOf = (code: string) =>
    heldRelics(state).find((r) => r.code === code)?.instanceId ?? null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-none border-b border-dark3 px-4 pb-[11px] pt-[14px]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] leading-none tracking-[0.2em] text-fg2">
            {replacing ? 'FIVE SLOTS · ALL FULL' : 'BOSS CLEARED'}
          </span>
        </div>
        <h2 className="mt-[7px] font-display text-[24px] font-bold uppercase leading-none tracking-[-0.02em]">
          {replacing
            ? `Destroy one for ${REGISTRY[replacing.code]?.name ?? replacing.code}`
            : 'Take one relic'}
        </h2>
      </div>

      <div className="flex flex-1 flex-col gap-[10px] overflow-y-auto px-4 py-3">
        {/*
          §6.2 — "the incoming relic visible alongside the five held". Shown
          as a full card, read-only: it is not one of the five destroy targets,
          so it never takes onTap and can never itself be picked.
        */}
        {replacing && (
          <RelicCard code={replacing.code} held={held} index={0} selected={false} dimmed={false} badge="INCOMING" />
        )}
        {codes.map((code, i) => (
          <RelicCard
            key={code}
            code={code}
            held={held}
            index={replacing ? i + 1 : i}
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
          onClick={() => {
            if (!picked) return;
            if (!replacing) return dispatch({ type: 'ACCEPT_OFFER', code: picked });
            const instanceId = instanceOf(picked);
            if (instanceId) dispatch({ type: 'REPLACE_RELIC', instanceId });
          }}
        >
          {picked
            ? `${replacing ? 'DESTROY' : 'TAKE'} ${REGISTRY[picked]?.name ?? picked}`
            : 'SELECT ONE'}
        </Button>
        {/*
          §3.3 — "the player may decline both". Declining a replacement drops
          the incoming relic and keeps the five; the copy has to say which,
          because "TAKE NOTHING" over a screen full of relics you already own
          reads as "keep nothing".
        */}
        <button
          type="button"
          onClick={() => dispatch({ type: 'SKIP_OFFER' })}
          className="min-h-[44px] font-mono text-[10px] leading-none tracking-[0.14em] text-fg3"
        >
          {replacing ? 'KEEP ALL FIVE — LOSE THE NEW ONE' : 'TAKE NOTHING'}
        </button>
      </div>
    </div>
  );
}
