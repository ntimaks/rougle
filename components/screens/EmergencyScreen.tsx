'use client';

import { CONFIG, emergencyCost, type GameState } from '@/lib/engine';
import { Button } from '@/components/cmp/Button';
import { useGame } from '@/lib/store/useGame';

/**
 * The emergency purchase. MECHANICS.md §2.3: the offer is MANDATORY, not
 * optional UI — the player must always see the out they did or did not buy.
 *
 * R-012 is the reason this screen exists as its own step rather than a toast on
 * the death screen: the design's death mock showed "POOL EXHAUSTED" next to
 * 145g unspent, which would have covered all three purchases. That is what an
 * unexercised branch looks like.
 */
export function EmergencyScreen({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch);
  const cost = emergencyCost(state, CONFIG);
  const affordable = cost !== null && state.gold >= cost;
  const step = state.emergencyPurchasesThisAct + 1;

  return (
    <div className="flex flex-1 flex-col justify-center gap-4 px-4 py-6">
      <div className="border border-red bg-panel p-4">
        <p className="font-mono text-[9px] leading-none tracking-[0.2em] text-red">
          POOL EXHAUSTED · WORD UNSOLVED
        </p>
        <h2 className="mt-[10px] font-display text-[28px] font-bold uppercase leading-none tracking-[-0.02em] text-fg0">
          Buy a guess?
        </h2>
        <p className="mt-3 font-mono text-[11px] leading-[1.6] text-fg2">
          Purchase {step} of {CONFIG.emergencyCosts.length} this act. The price escalates and
          resets when the act does.
        </p>

        <div className="mt-4 flex items-baseline gap-3">
          <span className="font-pixel text-[40px] leading-[0.8] text-red">{cost}g</span>
          <span className="font-mono text-[11px] text-fg3">you hold {state.gold}g</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button primary={affordable} disabled={!affordable} onClick={() => dispatch({ type: 'BUY_EMERGENCY' })}>
          {affordable ? 'BUY ONE GUESS' : 'CANNOT AFFORD IT'}
        </Button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'DECLINE_EMERGENCY' })}
          className="min-h-[44px] font-mono text-[10px] leading-none tracking-[0.14em] text-fg3"
        >
          WALK AWAY — END THE RUN
        </button>
      </div>
    </div>
  );
}
