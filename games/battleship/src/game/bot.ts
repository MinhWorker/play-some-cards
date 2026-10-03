/**
 * The computer's shots. It knows only what a player knows: where it fired, which shots hit and
 * which ships sank.
 *
 *   easy    random shots; after a hit, often a neighbor of it
 *   normal  hunts on a checkerboard; after a hit, follows the line of hits to sink the ship
 *   hard    fires where the ships still afloat fit in the most ways (a probability map)
 */
import { type BotLevel, CELLS, FLEET, type Ship, SIZE } from './model.js';
import { around, cellOf, colOf, rowOf, shipAt } from './rules.js';

export interface Sight {
  shots: { cell: number; hit: boolean }[];
  sunk: Ship[];
  /** Ships keep a cell of water between them. */
  spacing: boolean;
}

const pick = <T>(items: T[], rng: () => number) => items[Math.floor(rng() * items.length)];
const ORTHO = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

/** Cells that can't hold a ship afloat: shot already, or (with spacing) next to a sunk ship. */
function blocked({ shots, sunk, spacing }: Sight) {
  const out = new Set(shots.map((s) => s.cell));
  if (spacing)
    for (const ship of sunk) for (const c of ship.cells) for (const n of around(c)) out.add(n);
  return out;
}

/** Hits that belong to no sunk ship yet. */
function openHits({ shots, sunk }: Sight) {
  const sunkCells = new Set(sunk.flatMap((s) => s.cells));
  return shots.filter((s) => s.hit && !sunkCells.has(s.cell)).map((s) => s.cell);
}

/** Unshot neighbors (up, down, left, right) of a cell that could still hold a ship. */
function neighbors(cell: number, block: Set<number>) {
  const out: number[] = [];
  for (const [dr, dc] of ORTHO) {
    const r = rowOf(cell) + dr;
    const c = colOf(cell) + dc;
    if (r >= 0 && r < SIZE && c >= 0 && c < SIZE && !block.has(cellOf(r, c)))
      out.push(cellOf(r, c));
  }
  return out;
}

/** The lengths of the ships still afloat. */
function afloat(sunk: Ship[]) {
  const left: number[] = [...FLEET];
  for (const ship of sunk) left.splice(left.indexOf(ship.cells.length), 1);
  return left;
}

/** Where the ships afloat fit, weighted towards open hits: the best cell to fire at. */
function densest(sight: Sight, rng: () => number): number | undefined {
  const block = blocked(sight);
  const hits = new Set(openHits(sight));
  // A ship next to an open hit's diagonal would touch it: with spacing, those cells are water.
  const water = new Set<number>();
  if (sight.spacing) {
    for (const h of hits) {
      for (const n of around(h)) if (rowOf(n) !== rowOf(h) && colOf(n) !== colOf(h)) water.add(n);
    }
  }
  const weight = new Float64Array(CELLS);
  for (const length of afloat(sight.sunk)) {
    for (let cell = 0; cell < CELLS; cell++) {
      for (const vertical of [false, true]) {
        const ship = shipAt(rowOf(cell), colOf(cell), length, vertical);
        if (!ship) continue;
        let covers = 0;
        let ok = true;
        for (const c of ship.cells) {
          if (hits.has(c)) covers++;
          else if (block.has(c) || water.has(c)) ok = false;
        }
        if (!ok || (hits.size && !covers)) continue;
        const w = 1 + covers * covers * 20;
        for (const c of ship.cells) if (!hits.has(c)) weight[c] = (weight[c] ?? 0) + w;
      }
    }
  }
  let best = 0;
  for (let c = 0; c < CELLS; c++) if (!block.has(c)) best = Math.max(best, weight[c] ?? 0);
  if (!best) return undefined;
  const top: number[] = [];
  for (let c = 0; c < CELLS; c++) if (!block.has(c) && (weight[c] ?? 0) === best) top.push(c);
  return pick(top, rng);
}

/** Where to finish off a ship already hit: past either end of a line of hits, or next to a
 * lone hit. */
function follow(sight: Sight, block: Set<number>, rng: () => number): number | undefined {
  const hits = new Set(openHits(sight));
  const inside = (r: number, c: number) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  for (const h of hits) {
    for (const [dr, dc] of [
      [0, 1],
      [1, 0],
    ] as const) {
      if (!inside(rowOf(h) + dr, colOf(h) + dc) || !hits.has(h + dr * SIZE + dc)) continue;
      const ends: number[] = [];
      for (const dir of [1, -1]) {
        let r = rowOf(h);
        let c = colOf(h);
        while (inside(r, c) && hits.has(cellOf(r, c))) {
          r += dr * dir;
          c += dc * dir;
        }
        if (inside(r, c) && !block.has(cellOf(r, c))) ends.push(cellOf(r, c));
      }
      if (ends.length) return pick(ends, rng);
    }
  }
  const near = [...hits].flatMap((h) => neighbors(h, block));
  return near.length ? pick(near, rng) : undefined;
}

/** The cell the computer fires at next. */
export function botShot(sight: Sight, rng: () => number, level: BotLevel): number {
  const block = blocked(sight);
  const free: number[] = [];
  for (let c = 0; c < CELLS; c++) if (!block.has(c)) free.push(c);
  // Every cell left is blocked only when the rules forgot something: fire anywhere unshot.
  const unshot = free.length
    ? free
    : [...Array(CELLS).keys()].filter((c) => !sight.shots.some((s) => s.cell === c));
  const any = () => pick(unshot, rng) ?? 0;

  if (level === 'hard') return densest(sight, rng) ?? any();
  if (level === 'normal') {
    const target = follow(sight, block, rng);
    if (target !== undefined) return target;
    // Every ship covers two cells at least: a checkerboard of shots finds them all.
    const even = unshot.filter((c) => (rowOf(c) + colOf(c)) % 2 === 0);
    return pick(even.length ? even : unshot, rng) ?? any();
  }
  const hits = openHits(sight);
  if (hits.length && rng() < 0.6) {
    const near = hits.flatMap((h) => neighbors(h, block));
    if (near.length) return pick(near, rng) ?? any();
  }
  return any();
}
