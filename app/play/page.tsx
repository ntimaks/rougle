import { GameShell } from '@/components/GameShell';

/**
 * The only other route. Game phase is never a route: `PhaseSwitch` switches on
 * `state.phase` instead. A URL like /word would not be linkable, refreshable or
 * back-safe (technical brief §1.4).
 */
export default function PlayPage() {
  return <GameShell />;
}
