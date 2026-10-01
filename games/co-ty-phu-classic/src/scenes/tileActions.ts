import { BOARD, groupSquares, isDeed, type View } from '../game/model.js';
import { bankHotels, bankHouses, buildingsInGroup, ownsGroup } from '../game/rules.js';

export type TileAction = { label: string; event: string; payload: Record<string, number> };

/** Actions available to this seat, rather than every possible property command. */
export function tileActions(state: View, seat: number | null, square: number): TileAction[] {
  if (seat === null || state.winner !== null || state.players[seat]?.bankrupt) return [];
  const cell = BOARD[square];
  const deed = state.properties[square];
  if (!cell || !deed || !isDeed(cell)) return [];
  if (state.phase === 'buy' && state.turn === seat && state.pending === square) {
    return [
      ...(state.players[seat]!.cash >= cell.price!
        ? [{ label: `Mua ${cell.price} ₫`, event: 'buy', payload: {} }]
        : []),
      { label: 'Đấu giá', event: 'auction', payload: {} },
    ];
  }
  if (state.phase === 'auction') {
    const auction = state.auction;
    if (auction?.square !== square || auction.bidder !== seat) return [];
    return [
      ...[1, 10, 50]
        .filter((plus) => auction.highest + plus <= state.players[seat]!.cash)
        .map((plus) => ({
          label: `+${plus} (${auction.highest + plus})`,
          event: 'bid',
          payload: { amount: auction.highest + plus },
        })),
      { label: 'Bỏ giá', event: 'pass', payload: {} },
    ];
  }
  if (state.phase === 'event' || state.phase === 'trade' || deed.owner !== seat) return [];
  const actions: TileAction[] = [];
  const payload = { square };
  const cash = state.players[seat]!.cash;
  const buildings = groupSquares(cell.group ?? 'nau').map((i) => state.properties[i]!.houses);
  if (cell.kind === 'street' && ownsGroup(state, seat, square)) {
    const mortgaged = groupSquares(cell.group!).some((i) => state.properties[i]!.mortgaged);
    if (
      !mortgaged &&
      deed.houses < 5 &&
      deed.houses === Math.min(...buildings) &&
      cash >= cell.houseCost! &&
      (deed.houses === 4 ? bankHotels(state) > 0 : bankHouses(state) > 0)
    )
      actions.push({
        label: deed.houses === 4 ? 'Xây khách sạn' : 'Xây nhà',
        event: 'build',
        payload,
      });
  }
  if (
    cell.kind === 'street' &&
    deed.houses > 0 &&
    deed.houses === Math.max(...buildings) &&
    (deed.houses !== 5 || bankHouses(state) >= 4)
  )
    actions.push({ label: 'Bán nhà', event: 'sell-house', payload });
  if (deed.mortgaged) {
    if (cash >= Math.ceil((cell.price! / 2) * 1.1))
      actions.push({ label: 'Chuộc đất', event: 'redeem', payload });
  } else if (!buildingsInGroup(state, square)) {
    actions.push({ label: 'Thế chấp', event: 'mortgage', payload });
  }
  return actions;
}
