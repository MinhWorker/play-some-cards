/** Ranking the match (shared by the Game and the screen). */
import type { State } from './model.js';

/**
 * The match's ranking, best first: who stayed by points, then seat; below them who left, the
 * last to leave highest.
 */
export function standings({ points, gone }: Pick<State, 'points' | 'gone'>) {
  const stayed = points
    .map((_, seat) => seat)
    .filter((seat) => !gone.includes(seat))
    .sort((a, b) => (points[b] ?? 0) - (points[a] ?? 0) || a - b);
  return [...stayed, ...[...gone].reverse()];
}

/** Everyone still at the table with the most points (a tie: they all win). */
export function winners({ points, gone }: Pick<State, 'points' | 'gone'>) {
  const stayed = points.map((_, seat) => seat).filter((seat) => !gone.includes(seat));
  const best = Math.max(...stayed.map((seat) => points[seat] ?? 0));
  return stayed.filter((seat) => points[seat] === best);
}
