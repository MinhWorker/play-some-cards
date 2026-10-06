/**
 * Fleets and shots: pure functions shared by the game, the computer player and the screen
 * (which checks a ship's new place before sending it).
 */
import { CELLS, FLEET, type Seat, type Ship, SIZE, type Waters } from './model.js';

export const rowOf = (cell: number) => Math.floor(cell / SIZE);
export const colOf = (cell: number) => cell % SIZE;
export const cellOf = (row: number, col: number) => row * SIZE + col;
export const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0);
const inside = (row: number, col: number) => row >= 0 && row < SIZE && col >= 0 && col < SIZE;

/** A ship of `length` from (row, col) going right or down, or `null` if it leaves the sea. */
export function shipAt(row: number, col: number, length: number, vertical: boolean): Ship | null {
  const cells: number[] = [];
  for (let i = 0; i < length; i++) {
    const r = vertical ? row + i : row;
    const c = vertical ? col : col + i;
    if (!inside(r, c)) return null;
    cells.push(cellOf(r, c));
  }
  return { cells };
}

/** Whether a ship lies down the sea (its cells a column apart). */
export const isVertical = (ship: Ship) =>
  ship.cells.length > 1 && (ship.cells[1] ?? 0) - (ship.cells[0] ?? 0) === SIZE;

/** The up to 8 cells around `cell`. */
export function around(cell: number): number[] {
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = rowOf(cell) + dr;
      const c = colOf(cell) + dc;
      if ((dr || dc) && inside(r, c)) out.push(cellOf(r, c));
    }
  }
  return out;
}

/** Whether `ship` is a straight run of cells inside the sea. */
function straight(ship: Ship): boolean {
  const [first] = ship.cells;
  if (first === undefined || ship.cells.some((c) => c < 0 || c >= CELLS)) return false;
  const again = shipAt(rowOf(first), colOf(first), ship.cells.length, isVertical(ship));
  return Boolean(again?.cells.every((c, i) => c === ship.cells[i]));
}

/** Whether `ship` may join `others`: no shared cell and, with spacing, no touching. */
export function fits(ship: Ship, others: Ship[], spacing: boolean): boolean {
  const taken = new Set(others.flatMap((s) => s.cells));
  if (ship.cells.some((c) => taken.has(c))) return false;
  return !spacing || !ship.cells.some((c) => around(c).some((n) => taken.has(n)));
}

/** What is wrong with a fleet (in Vietnamese), or `null` if it is fine. */
export function fleetError(ships: Ship[], spacing: boolean): string | null {
  const lengths = ships.map((s) => s.cells.length).sort((a, b) => b - a);
  if (lengths.join() !== FLEET.join()) return 'Hạm đội không đúng số tàu';
  if (!ships.every(straight)) return 'Tàu phải nằm thẳng hàng trong vùng biển';
  for (let i = 0; i < ships.length; i++) {
    const ship = ships[i];
    if (ship && !fits(ship, ships.slice(0, i), spacing)) {
      return spacing ? 'Các tàu không được nằm sát nhau' : 'Các tàu không được chồng lên nhau';
    }
  }
  return null;
}

/** A fleet placed at random (longest ship first). */
export function randomFleet(rng: () => number, spacing: boolean): Ship[] {
  for (;;) {
    const ships: Ship[] = [];
    FLEET.forEach((length, i) => {
      for (let tries = 0; tries < 200 && ships.length === i; tries++) {
        const ship = shipAt(
          Math.floor(rng() * SIZE),
          Math.floor(rng() * SIZE),
          length,
          rng() < 0.5,
        );
        if (ship && fits(ship, ships, spacing)) ships.push(ship);
      }
    });
    if (ships.length === FLEET.length) return ships;
  }
}

/** Whether every cell of `ship` has been shot. */
export const isSunk = (ship: Ship, shots: number[]) => ship.cells.every((c) => shots.includes(c));

/** One sea as `viewer` may see it: the owner sees every ship, others only the sunk ones. */
export function watersOf(fleet: Ship[], shots: number[], mine: boolean): Waters {
  const hit = new Set(fleet.flatMap((s) => s.cells));
  const sunk = fleet.filter((s) => isSunk(s, shots));
  return {
    ships: mine ? fleet : sunk,
    shots: shots.map((cell) => ({ cell, hit: hit.has(cell) })),
    sunk: sunk.map((s) => s.cells.length),
  };
}
