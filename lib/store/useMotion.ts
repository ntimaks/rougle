'use client';

import { useEffect, useState } from 'react';
import { useGame } from './useGame';

/**
 * Whether animation should run at all.
 *
 * Two independent reasons to stop: the player asked (`skipAnimations`), or the
 * system did (`prefers-reduced-motion`). Either one wins.
 *
 * State still changes when motion does not. Motion is never the only carrier of
 * information — a decayed green is a different tile treatment, not just a
 * different animation — so switching it off loses polish, never meaning
 * (technical brief §10).
 */
export function useMotion(): { animate: boolean; reducedMotion: boolean } {
  const skip = useGame((s) => s.skipAnimations);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return { animate: !skip && !reducedMotion, reducedMotion };
}
