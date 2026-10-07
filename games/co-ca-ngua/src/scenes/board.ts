import { type State, squareOf } from '../game/model.js';

export const COLORS = [
  { name: 'Đỏ', frame: 'horse-red', ink: 0xe95853, text: '#ffb5a4' },
  { name: 'Xanh dương', frame: 'horse-blue', ink: 0x52a5ee, text: '#a8d9ff' },
  { name: 'Vàng', frame: 'horse-yellow', ink: 0xf7c94f, text: '#ffe5a0' },
  { name: 'Xanh lá', frame: 'horse-green', ink: 0x54bb86, text: '#a8ebc7' },
] as const;

export function rotate(x: number, y: number, color: number): [number, number] {
  for (let i = 0; i < color; i++) [x, y] = [14 - y, x];
  return [x, y];
}

const SEGMENT = [
  [0, 6],
  [1, 6],
  [2, 6],
  [3, 6],
  [4, 6],
  [5, 6],
  [6, 5],
  [6, 4],
  [6, 3],
  [6, 2],
  [6, 1],
  [6, 0],
  [7, 0],
] as const;
const TRACK = Array.from({ length: 4 }, (_, color) =>
  SEGMENT.map(([x, y]) => rotate(x, y, color)),
).flat();

/** Grid coordinates share the exact top-down Blender board projection. */
export function horsePoint(state: State, seat: number, horse: number, position: number) {
  const color = state.colors[seat] ?? 0;
  if (position < 0)
    return rotate(1.6 + (horse % 2) * 1.8, 1.6 + Math.floor(horse / 2) * 1.8, color);
  if (position >= 52) return rotate(position - 51, 7, color);
  return TRACK[squareOf(state, seat, position)] ?? [7, 7];
}
