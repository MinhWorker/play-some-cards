/** Câu cá Trung Thu: what one game is made of. Rules for people: RULES.md. */

/** Casts in one game. */
export const CASTS = 5;

/** What can bite, with its points and how often (weights add up to 100). */
export const CATCHES = [
  { id: 'golden-carp', name: 'Cá chép vàng', points: 5, weight: 10 },
  { id: 'carp', name: 'Cá chép', points: 3, weight: 25 },
  { id: 'perch', name: 'Cá rô', points: 2, weight: 30 },
  { id: 'fry', name: 'Cá con', points: 1, weight: 25 },
  { id: 'sandal', name: 'Dép rách', points: 0, weight: 10 },
] as const;

export type CatchId = (typeof CATCHES)[number]['id'];

/** The most points one game can give: every cast a golden carp. */
export const MAX_POINTS = CASTS * Math.max(...CATCHES.map((c) => c.points));

export interface State {
  /** What each cast brought up, in order. */
  caught: CatchId[];
}

export const pointsOf = (caught: readonly CatchId[]) =>
  caught.reduce((sum, id) => sum + (CATCHES.find((c) => c.id === id)?.points ?? 0), 0);

/** The catch for a roll in [0, 1). */
export function catchFor(roll: number): CatchId {
  let left = roll * 100;
  for (const item of CATCHES) {
    if (left < item.weight) return item.id;
    left -= item.weight;
  }
  return 'sandal';
}
