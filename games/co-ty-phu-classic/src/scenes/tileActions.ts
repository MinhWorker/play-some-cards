import { BOARD, isDeed, type View } from '../game/model.js';
import { bankHotels, bankHouses } from '../game/rules.js';

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
    // Open to everyone still in the auction; the leader waits (a station's leader may withdraw).
    const auction = state.auction;
    if (auction?.square !== square || auction.passed.includes(seat)) return [];
    if (auction.leader === seat && cell.kind !== 'station') return [];
    return [
      ...(cell.kind === 'station' ? [10] : [1, 10, 50])
        .filter(
          (plus) =>
            auction.highest + plus <= state.players[seat]!.cash + auction.bids[seat]! &&
            (cell.kind !== 'station' ||
              state.players[seat]!.cash + auction.bids[seat]! >= cell.price!),
        )
        .filter(() => auction.leader !== seat)
        .map((plus) => ({
          label: `+${plus} (${auction.highest + plus})`,
          event: 'bid',
          payload: { amount: auction.highest + plus },
        })),
      { label: cell.kind === 'station' ? 'Rút / Bỏ giá' : 'Bỏ giá', event: 'pass', payload: {} },
    ];
  }
  if (state.phase === 'event' || state.phase === 'trade' || deed.owner !== seat) return [];
  const actions: TileAction[] = [];
  const payload = { square };
  const cash = state.players[seat]!.cash;
  if (cell.kind === 'street' && state.turn === seat && state.buildable === square) {
    if (
      !deed.mortgaged &&
      deed.houses < 5 &&
      state.players[seat]!.position === square &&
      cash >= cell.houseCost! &&
      (deed.houses === 4 ? bankHotels(state) > 0 : bankHouses(state) > 0)
    )
      actions.push({
        label: deed.houses === 4 ? 'Xây khách sạn' : 'Xây nhà',
        event: 'build',
        payload,
      });
  }
  if (cell.kind === 'street' && deed.houses > 0 && (deed.houses !== 5 || bankHouses(state) >= 4))
    actions.push({ label: 'Bán nhà', event: 'sell-house', payload });
  if (deed.mortgaged) {
    if (cash >= Math.ceil((cell.price! / 2) * 1.1))
      actions.push({ label: 'Chuộc đất', event: 'redeem', payload });
  } else if (!deed.houses) {
    actions.push({ label: 'Thế chấp', event: 'mortgage', payload });
  }
  return actions;
}
