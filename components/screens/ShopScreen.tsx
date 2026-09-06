'use client';

import { REGISTRY, canDispatch, type GameState } from '@/lib/engine';
import { Button } from '@/components/cmp/Button';
import { RARITY_TEXT, glyphFor } from '@/components/cmp/rarity';
import { useGame } from '@/lib/store/useGame';

/**
 * S.06 — the shop. R-07.
 *
 * What a shop is FOR, now that R-025 made node rewards a choice: targeting.
 * A reward node deals you one of three at random; here the stock is visible and
 * you pick. That is what the gold you refused relics for is buying.
 *
 * Every price and every refusal comes from the engine — `canDispatch` decides
 * what is affordable, so a slot the player cannot buy says why rather than just
 * going grey.
 */
export function ShopScreen({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch);
  const stock = state.shop?.stock ?? [];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-none items-baseline gap-2 border-b border-dark3 px-4 pb-[11px] pt-[14px]">
        <div className="flex flex-col">
          <span className="font-mono text-[9px] leading-none tracking-[0.2em] text-fg2">SHOP</span>
          <h2 className="mt-[7px] font-display text-[24px] font-bold uppercase leading-none tracking-[-0.02em]">
            Stock
          </h2>
        </div>
        <span className="ml-auto font-mono text-[13px] font-bold leading-none text-accent">
          {state.gold}g
        </span>
      </div>

      <ul className="flex flex-1 flex-col gap-[6px] overflow-y-auto px-4 py-3">
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

      <div className="flex-none border-t border-dark3 bg-panel px-4 pb-[14px] pt-3">
        <Button primary arrow onClick={() => dispatch({ type: 'LEAVE_NODE' })}>
          LEAVE
        </Button>
      </div>
    </div>
  );
}
