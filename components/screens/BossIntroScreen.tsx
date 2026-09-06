'use client';

import { BOSSES, type GameState } from '@/lib/engine';
import { useMotion } from '@/lib/store/useMotion';

/**
 * S.09 — the boss ticker. A marquee, duplicated content, −50% travel, so the
 * loop is seamless.
 *
 * NOT mounted during a word any more (R-033). It was a third row saying "boss"
 * above a BOSS badge and a node line already saying the same, and because a
 * marquee is clipped at both edges the boss's RULE — the only place it was
 * stated — read as broken text: "IO ANSWER UNTIL THE THIRD". The rule now sits
 * in the modifier banner, where rules live and where it holds still.
 *
 * Kept for the S.09 intro screen, which `BOSS_INTRO` is declared for and which
 * nothing enters yet. A marquee is fine as atmosphere on a screen whose only
 * job is atmosphere.
 */
export function BossTicker({ state }: { state: GameState }) {
  const { animate } = useMotion();
  // From the node, never state.actIndex — the drift R-026 was written for.
  const node = state.word ? state.map.nodes[state.word.nodeId] : null;
  const boss = BOSSES[node?.actIndex ?? state.actIndex];
  // The rule comes from the boss definition now, rather than a conditional
  // here that could drift from what the engine actually does.
  const phrase = `${boss.name} · ${boss.rule} · `;

  return (
    <div className="flex h-[22px] flex-none items-center overflow-hidden border-b border-red bg-panel">
      <div
        className="flex whitespace-nowrap font-mono text-[9px] leading-none tracking-[0.2em] text-red"
        style={animate ? { animation: 'rg-march 14s linear infinite' } : undefined}
      >
        <span>{phrase.repeat(6)}</span>
        <span aria-hidden>{phrase.repeat(6)}</span>
      </div>
    </div>
  );
}
