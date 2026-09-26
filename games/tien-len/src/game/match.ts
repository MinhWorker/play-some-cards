/** Ranking a round and the match (shared by the Game and the screen). */
import type { State } from './model.js';

/**
 * A round's points: the best of `order` gets one less than the number of players in it, the
 * last gets 0 (4 players: 3, 2, 1, 0). Who left gets 0 whatever their place.
 */
export function roundPoints(order: number[], seats: number, sunk: number[]): number[] {
  const points = Array<number>(seats).fill(0);
  order.forEach((seat, place) => {
    if (!sunk.includes(seat)) points[seat] = order.length - 1 - place;
  });
  return points;
}

/**
 * The match's ranking, best first: who stayed by points, then rounds won, then seat; below
 * them who left, the last to leave highest.
 */
export function standings({ points, firsts, gone }: Pick<State, 'points' | 'firsts' | 'gone'>) {
  const stayed = points
    .map((_, seat) => seat)
    .filter((seat) => !gone.includes(seat))
    .sort(
      (a, b) => (points[b] ?? 0) - (points[a] ?? 0) || (firsts[b] ?? 0) - (firsts[a] ?? 0) || a - b,
    );
  return [...stayed, ...[...gone].reverse()];
}
