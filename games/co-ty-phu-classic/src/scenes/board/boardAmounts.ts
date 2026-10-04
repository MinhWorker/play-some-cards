import { BOARD, type State } from '../../game/model.js';
import { rent, utilityTax } from '../../game/rules.js';

/** Unsold deeds show purchase prices; owned deeds show their current ordinary rent. */
export function boardAmounts(
  state: Pick<State, 'properties' | 'players'> & Partial<Pick<State, 'round' | 'shortages'>>,
) {
  return BOARD.map((cell, square) => {
    const deed = state.properties[square]!;
    if (cell.kind === 'tax') return '10%';
    if (cell.kind === 'utility')
      return String(
        utilityTax({ round: state.round ?? 0, shortages: state.shortages ?? [] }, square),
      );
    if (cell.price === undefined) return null;
    if (deed.owner === null) return String(cell.price);
    if (deed.mortgaged || state.players[deed.owner]?.jailed) return '0';
    return String(rent(state, square, 0));
  });
}
