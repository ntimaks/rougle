'use client';

import { BOSSES, type GameState } from '@/lib/engine';
import { useMotion } from '@/lib/store/useMotion';

/**
 * S.09 — the boss ticker. A marquee, duplicated content, −50% travel, so the
 * loop is seamless.
 *
 * It is decoration with one job: to make the player stop before the fight that
 * ends a fifth of runs. Reduced motion turns the march off and leaves the text.
 */
export function BossTicker({ state }: { state: GameState }) {
  const { animate } = useMotion();
  const boss = BOSSES[state.actIndex];
  const phrase = `${boss.name} · ${boss.code === 'TWINS' ? 'TWO MOUTHS · ONE THROAT' : boss.code === 'CIPHER' ? 'NO ANSWER UNTIL THE THIRD' : 'FIVE WORDS · NO MERCY'} · `;

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
