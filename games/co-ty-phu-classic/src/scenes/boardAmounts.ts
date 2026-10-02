import { BOARD, type State } from '../game/model.js';
import { rent } from '../game/rules.js';

/** Unsold deeds show purchase prices; owned deeds show their current ordinary rent. */
export function boardAmounts(state: Pick<State, 'properties' | 'players'>) {
  return BOARD.map((cell, square) => {
    const deed = state.properties[square]!;
    if (cell.tax !== undefined) return String(cell.tax);
    if (cell.price === undefined) return null;
    if (deed.owner === null) return String(cell.price);
    if (deed.mortgaged || state.players[deed.owner]?.jailed) return '0';
    if (cell.kind === 'utility') {
      const both =
        state.properties[12]?.owner === deed.owner && state.properties[28]?.owner === deed.owner;
      return `${both ? 10 : 4}×`;
    }
    return String(rent(state, square, 0));
  });
}
