import { BOARD_HOMOGRAPHY } from './boardGeometry.js';

/**
 * A point of the printed board, in board units (0–1 across it, as PLAYER_PANEL's sockets), where
 * it shows in board-25d.webp (0–1 of the image's width and height).
 */
export function planePoint(u: number, v: number) {
  const [a, b, c, d, e, f, g, h, i] = BOARD_HOMOGRAPHY;
  const w = g * u + h * v + i;
  return { x: (a * u + b * v + c) / w, y: (d * u + e * v + f) / w };
}
