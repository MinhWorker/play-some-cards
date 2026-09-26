/** Look shared by the scenes. X is red and starts, O is blue. */
import type { Mark } from '../game/model.js';

export const MARKS: Record<Mark, { piece: string; color: string; sound: string }> = {
  X: { piece: 'piece-x', color: '#ff6b6b', sound: 'mark-drop' },
  O: { piece: 'piece-o', color: '#5fb4ff', sound: 'caro-o-place' },
};

/** Tints for wooden tiles, and text colors for picked / not picked choices. */
export const TINT = { hover: 0xfff1b8, win: 0xffd34d } as const;
export const PICKED = '#ffd34d';
export const UNPICKED = '#ffffff';
