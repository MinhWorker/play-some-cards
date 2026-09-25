/**
 * Randomness helpers. Games get `rng` (a float in [0, 1)) from `setup` / `applyMove`; never use
 * Math.random(), so tests can replay a game exactly.
 */
export type Rng = () => number;

/** Whole number from `min` to `max`, both included. */
export function int(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One random item. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() from an empty list');
  return items[int(rng, 0, items.length - 1)] as T;
}

/** A shuffled copy (Fisher–Yates). */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = int(rng, 0, i);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** A repeatable rng for tests: the same seed gives the same numbers. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    // mulberry32
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
