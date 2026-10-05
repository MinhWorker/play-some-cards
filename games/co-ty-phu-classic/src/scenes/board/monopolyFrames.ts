import { BOARD, type Property } from '../../game/model.js';

/** Adjacent deeds in one group only merge while their owner is the same. */
export function monopolyFrames(properties: readonly Property[]) {
  const frames: { squares: number[]; color: number; count: number }[] = [];
  BOARD.forEach((cell, square) => {
    if (!cell.group) return;
    const owner = properties[square]?.owner;
    const previous = frames.at(-1);
    const last = previous?.squares.at(-1);
    if (
      owner !== null &&
      owner !== undefined &&
      last === square - 1 &&
      BOARD[last]?.group === cell.group &&
      properties[last]?.owner === owner
    ) {
      previous!.squares.push(square);
      previous!.count++;
    } else frames.push({ squares: [square], color: 0, count: 1 });
  });
  return frames;
}
