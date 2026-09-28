'use client';

import { useState } from 'react';
import {
  CONFIG,
  REGISTRY,
  canDispatch,
  heldRelics,
  refillCost,
  relicSlots,
  rerollCost,
  scalingCounter,
  sellPrice,
  type GameState,
} from '@/lib/engine';
import { Button } from '@/components/cmp/Button';
import { RARITY_TEXT, glyphFor } from '@/components/cmp/rarity';
import { useGame } from '@/lib/store/useGame';

/**
 * S.06 — the shop. MECHANICS.md §4.
 *
 * It opens after every solve node now, twelve times a run, and it is where a
 * build comes from: §4 made relics BOUGHT rather than granted, so this screen
 * is the only place a non-boss relic enters a run. That is a much bigger job
 * than the v1.3 shelf, and it has four controls instead of one.
 *
 * The layout puts them in the order the money should go, top to bottom:
 * **relics, then a consumable, then a reroll, then a refill.** §4.2's rule is
 * that gold buys builds and buys survival at a penalty, and a screen that leads
 * with the refill teaches the opposite. The refill sits last and states its
 * rung, so the player can see it getting worse.
 *
 * Every price and every refusal comes from the engine — `canDispatch` decides
 * what is legal, so a control the player cannot use says why rather than just
 * going grey.
 */
export function ShopScreen({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch);
  const [selling, setSelling] = useState(false);
  const stock = state.shop?.stock ?? [];
  const held = heldRelics(state);
  const slots = relicSlots(state, CONFIG);

  const reroll = rerollCost(state.shop?.rerolls ?? 0, CONFIG);
  const rerollBlocked = canDispatch(state, { type: 'REROLL_SHOP' });
  const refill = refillCost(state, CONFIG);
  const refillBlocked = canDispatch(state, { type: 'BUY_REFILL' });
  const rung = state.stats.refillsBought + 1;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-none items-baseline gap-2 border-b border-dark3 px-4 pb-[11px] pt-[14px]">
        <div className="flex flex-col">
          <span className="font-mono text-[9px] leading-none tracking-[0.2em] text-fg2">SHOP</span>
          <h2 className="mt-[7px] font-display text-[24px] font-bold uppercase leading-none tracking-[-0.02em]">
            Stock
          </h2>
        </div>
        <div className="ml-auto flex flex-col items-end gap-[3px]">
          <span className="font-mono text-[13px] font-bold leading-none text-accent">
            {state.gold}g
          </span>
          {/*
            §6.2 — "a full board turns every subsequent offer into a comparison".
            The count has to be on screen for that to be true before the player
            taps, rather than a surprise when the replace screen appears.
          */}
          <span
            className={`font-mono text-[9px] leading-none tracking-[0.14em] ${
              held.length >= slots ? 'text-red' : 'text-fg3'
            }`}
          >
            {held.length}/{slots} RELICS
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        <ul className="flex flex-col gap-[6px]">
          {stock.map((item, slot) => {
            const def = REGISTRY[item.code];
            if (!def) return null;
            const blocked = canDispatch(state, { type: 'BUY_STOCK', slot });
            return (
              <li key={`${item.code}-${slot}`}>
                <button
                  type="button"
                  disabled={blocked !== null}
                  onClick={() => dispatch({ type: 'BUY_STOCK', slot })}
                  className={`flex w-full items-start gap-[9px] border px-[10px] py-[9px] text-left transition-[transform,box-shadow] duration-[120ms] ease-linear ${
                    item.sold
                      ? 'border-dark2 bg-sunken opacity-50'
                      : blocked
                        ? 'border-dark2 opacity-60'
                        : 'border-line-strong shadow-[3px_3px_0_0_var(--line-strong)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none'
                  }`}
                >
                  <span className={`mt-[1px] text-[13px] leading-none ${RARITY_TEXT[def.rarity]}`} aria-hidden>
                    {glyphFor(def)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-[4px]">
                    <span className="flex items-baseline gap-2">
                      <span className="font-mono text-[11px] font-bold leading-none tracking-[0.1em]">
                        {def.name}
                      </span>
                      <span className={`font-mono text-[8px] leading-none tracking-[0.14em] ${RARITY_TEXT[def.rarity]}`}>
                        {def.rarity}
                      </span>
                    </span>
                    <span className="font-mono text-[9px] leading-[1.5] text-fg2">{def.rule}</span>
                  </span>
                  <span
                    className={`ml-auto flex-none font-mono text-[11px] font-bold leading-none ${
                      item.sold ? 'text-fg3' : blocked ? 'text-red' : 'text-accent'
                    }`}
                  >
                    {item.sold ? 'SOLD' : `${item.price}g`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* §4.2 — 20g, and 10g more every time within this shop. */}
        <button
          type="button"
          disabled={rerollBlocked !== null}
          onClick={() => dispatch({ type: 'REROLL_SHOP' })}
          className={`flex items-baseline gap-2 border px-[10px] py-2 text-left font-mono text-[10px] font-bold leading-none tracking-[0.12em] ${
            rerollBlocked ? 'border-dark2 text-fg3' : 'border-line-soft text-fg0'
          }`}
        >
          <span>REROLL THE SHELF</span>
          <span className="ml-auto font-normal text-[9px] tracking-[0.1em] text-fg2">
            {(state.shop?.rerolls ?? 0) > 0 && `${state.shop!.rerolls} SO FAR · `}
            {reroll}g
          </span>
        </button>

        {/*
          §4.1 — one per shop, on a ladder that escalates across the RUN and is
          shared with the forge (R-046). Both facts are on the control, because
          "40g" alone reads as a price rather than as a position on a ladder,
          and a player who cannot see it getting worse will treat it as an
          infinite tap — which is exactly the behaviour R-042 repriced it to
          stop.
        */}
        <button
          type="button"
          disabled={refillBlocked !== null}
          onClick={() => dispatch({ type: 'BUY_REFILL' })}
          className={`flex flex-col gap-[5px] border px-[10px] py-2 text-left ${
            refillBlocked ? 'border-dark2' : 'border-red'
          }`}
        >
          <span className="flex items-baseline gap-2">
            <span
              className={`font-mono text-[10px] font-bold leading-none tracking-[0.12em] ${
                refillBlocked ? 'text-fg3' : 'text-red'
              }`}
            >
              +1 GUESS
            </span>
            <span className="ml-auto font-mono text-[9px] leading-none tracking-[0.1em] text-fg2">
              {refill === null ? 'LADDER SPENT' : `${refill}g`}
            </span>
          </span>
          <span className="font-mono text-[8px] leading-[1.5] tracking-[0.1em] text-fg3">
            {refillBlocked
              ? refillBlocked.message.toUpperCase()
              : `RUNG ${rung} OF ${CONFIG.economy.refillCosts.length} · SHARED WITH THE FORGE · ` +
                `NEXT ${CONFIG.economy.refillCosts[rung] ?? '—'}g`}
          </span>
        </button>

        {/* §4.2 — sell a held relic for half. Two-step: nothing is destroyed on
            contact, because the mis-tap here costs a build. */}
        {held.length > 0 && (
          <section className="flex flex-col gap-[6px] border-t border-line-soft pt-3">
            <button
              type="button"
              onClick={() => setSelling((v) => !v)}
              aria-expanded={selling}
              className="text-left font-mono text-[9px] leading-none tracking-[0.18em] text-fg2"
            >
              {selling ? '− SELL A RELIC' : '+ SELL A RELIC'}
            </button>
            {selling &&
              held.map((r) => {
                const def = REGISTRY[r.code];
                if (!def) return null;
                // §6.5 — the counter has to be visible here too: selling a
                // built-up scaling relic is exactly the decision it informs.
                const counter = scalingCounter(state, r);
                return (
                  <button
                    key={r.instanceId}
                    type="button"
                    onClick={() => dispatch({ type: 'SELL_RELIC', instanceId: r.instanceId })}
                    className="flex flex-col gap-[4px] border border-line-soft px-[10px] py-2 text-left"
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="font-mono text-[10px] font-bold leading-none tracking-[0.1em]">
                        {r.upgraded ? (def.upgrade?.name ?? def.name) : def.name}
                      </span>
                      <span className="ml-auto font-mono text-[10px] font-bold leading-none text-amber">
                        +{sellPrice(r.code, CONFIG)}g
                      </span>
                    </span>
                    {counter && (
                      <span className="flex items-baseline gap-2 font-mono text-[9px] leading-none tracking-[0.14em]">
                        <span className="text-fg3">{counter.label}</span>
                        <span
                          className={`font-bold ${
                            counter.cap !== null && counter.value >= counter.cap
                              ? 'text-amber'
                              : 'text-accent'
                          }`}
                        >
                          {counter.value}
                          {counter.cap !== null && ` / ${counter.cap}`}
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
          </section>
        )}
      </div>

      <div className="flex-none border-t border-dark3 bg-panel px-4 pb-[14px] pt-3">
        <Button primary arrow onClick={() => dispatch({ type: 'LEAVE_NODE' })}>
          LEAVE
        </Button>
      </div>
    </div>
  );
}
