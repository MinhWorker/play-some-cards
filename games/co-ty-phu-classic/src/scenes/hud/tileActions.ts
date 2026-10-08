import {
  auctionRaise,
  BOARD,
  isDeed,
  STATION_CONTRIBUTION_STEP,
  type View,
} from '../../game/model.js';
import { bankHotels, bankHouses, mortgageAmount, redeemAmount } from '../../game/rules.js';

export type TileAction = {
  label: string;
  event: string;
  payload: Record<string, number>;
  /** Absent means enabled; unaffordable purchases and construction stay visible. */
  enabled?: boolean;
};

/** Actions available to this seat, rather than every possible property command. */
export function tileActions(state: View, seat: number | null, square: number): TileAction[] {
  if (seat === null || state.winner !== null || state.players[seat]?.bankrupt) return [];
  const cell = BOARD[square];
  const deed = state.properties[square];
  if (!cell || !deed || !isDeed(cell)) return [];
  if (state.phase === 'buy' && state.turn === seat && state.pending === square) {
    return state.players[seat]!.cash >= cell.price!
      ? [{ label: `Mua ${cell.price} ₫`, event: 'buy', payload: {} }]
      : [{ label: 'Ko đủ ₫', event: 'buy', payload: {}, enabled: false }];
  }
  if (state.phase === 'auction') {
    const auction = state.auction;
    if (auction?.square !== square || auction.bidder !== seat) return [];
    if (auction.seller === undefined) {
      if (
        state.turn !== seat ||
        state.pending !== square ||
        state.players[seat]!.position !== square ||
        auction.passed.includes(seat) ||
        auction.leader === seat
      )
        return [];
      const amount = auction.highest + STATION_CONTRIBUTION_STEP;
      return [
        ...(amount <= state.players[seat]!.cash
          ? [{ label: `Góp ${amount} ₫`, event: 'bid', payload: { amount } }]
          : []),
        { label: 'Từ bỏ', event: 'pass', payload: {} },
      ];
    }
    return [
      ...[1, 2, 3]
        .map((step) => step * auctionRaise(square))
        .filter((plus) => auction.highest + plus <= state.players[seat]!.cash)
        .map((plus) => ({
          label: `+${plus} (${auction.highest + plus})`,
          event: 'bid',
          payload: { amount: auction.highest + plus },
        })),
      ...(auction.leader !== seat ? [{ label: 'Rút / Bỏ giá', event: 'pass', payload: {} }] : []),
    ];
  }
  if (state.phase === 'event' || state.phase === 'trade' || deed.owner !== seat) return [];
  const actions: TileAction[] = [];
  const payload = { square };
  const cash = state.players[seat]!.cash;
  if (cell.kind === 'street') {
    actions.push({
      label:
        cash < cell.houseCost!
          ? 'Ko đủ ₫'
          : `${deed.houses >= 4 ? 'Xây khách sạn' : 'Xây nhà'} ${cell.houseCost!.toLocaleString('vi-VN')} ₫`,
      event: 'build',
      payload,
      enabled:
        state.turn === seat &&
        state.buildable === square &&
        state.players[seat]!.position === square &&
        !deed.mortgaged &&
        deed.houses < 5 &&
        cash >= cell.houseCost! &&
        (deed.houses === 4 ? bankHotels(state) > 0 : bankHouses(state) > 0),
    });
  }
  if (
    cell.kind === 'street' &&
    !deed.mortgaged &&
    deed.houses > 0 &&
    (deed.houses !== 5 || bankHouses(state) >= 4)
  )
    actions.push({ label: 'Bán nhà', event: 'sell-house', payload });
  const canManage =
    (state.phase === 'debt' ? (state.debt?.payer ?? state.turn) : state.turn) === seat;
  if (!canManage) return actions;
  actions.push({ label: 'Đấu giá', event: 'auction', payload });
  if (deed.mortgaged) {
    if (cash >= redeemAmount(state, square))
      actions.push({
        label: `Chuộc ${redeemAmount(state, square).toLocaleString('vi-VN')} ₫`,
        event: 'redeem',
        payload,
      });
  } else {
    actions.push({
      label: `Thế chấp +${mortgageAmount(state, square).toLocaleString('vi-VN')} ₫`,
      event: 'mortgage',
      payload,
    });
  }
  return actions;
}
