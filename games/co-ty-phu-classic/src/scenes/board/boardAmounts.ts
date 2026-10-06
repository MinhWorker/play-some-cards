import { BOARD, type State } from '../../game/model.js';
import { ownsGroup, rent, utilityMultiplier } from '../../game/rules.js';

/** Unsold deeds show purchase prices; owned deeds show their current ordinary rent. */
export function boardAmounts(
  state: Pick<State, 'properties' | 'players'> & Partial<Pick<State, 'round' | 'shortages'>>,
) {
  return BOARD.map((cell, square) => {
    const deed = state.properties[square]!;
    if (cell.kind === 'tax') return '10%';
    if (cell.price === undefined) return null;
    if (deed.owner === null) return String(cell.price);
    if (deed.mortgaged || state.players[deed.owner]?.jailed) return '0';
    if (cell.kind === 'utility') {
      const multiplier = utilityMultiplier(state, square);
      const shortage = state.shortages?.some(
        (event) => event.square === square && event.round === state.round,
      );
      return shortage ? `🎲x${multiplier / 2}x2` : `🎲x${multiplier}`;
    }
    const amount = rent(state, square, 0);
    return ownsGroup(state, deed.owner, square) ? `${amount / 3}x3` : String(amount);
  });
}
