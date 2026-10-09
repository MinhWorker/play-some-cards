import type { GameEvent } from '@xomdao/sdk';
import { auctionRaise, BOARD, isDeed, STATION_CONTRIBUTION_STEP, type State } from './model.js';
import { bankHotels, bankHouses, redeemAmount } from './rules.js';

const event = (name: string, payload?: object): GameEvent => ({ event: name, payload });
const deedValue = (square: number | null) =>
  square === null ? 0 : (BOARD[square]?.price ?? 0) * 1.1;

/** One legal decision per server tick. Every active phase has an exit. */
export function botMove(state: State, seat: number): GameEvent | null {
  const me = state.players[seat];
  if (!me || me.bankrupt || state.winner !== null) return null;

  if (state.phase === 'trade') {
    const trade = state.trade;
    if (trade?.to !== seat) return null;
    const offered = deedValue(trade.give) + trade.giveCash + (trade.giveCard ? 200 : 0);
    const requested = deedValue(trade.take) + trade.takeCash + (trade.takeCard ? 200 : 0);
    return event(offered >= requested ? 'accept-trade' : 'decline-trade');
  }

  if (state.phase === 'auction') {
    const auction = state.auction;
    if (!auction || auction.bidder !== seat) return null;
    const max = Math.min(me.cash - 100, Math.floor((BOARD[auction.square]?.price ?? 0) * 0.9));
    const amount = auction.highest + auctionRaise(auction.square);
    if (auction.seller === undefined) {
      const contribution = auction.highest + STATION_CONTRIBUTION_STEP;
      const limit = Math.min(me.cash - 100, Math.floor(BOARD[auction.square]!.price! * 0.9));
      return limit >= contribution ? event('bid', { amount: contribution }) : event('pass');
    }
    return max >= amount ? event('bid', { amount }) : event('pass');
  }

  if ((state.phase === 'debt' ? (state.debt?.payer ?? state.turn) : state.turn) !== seat)
    return null;
  if (state.phase === 'event') return event('confirm-event');
  if (state.phase === 'buy') {
    const price = BOARD[state.pending ?? -1]?.price ?? Infinity;
    return event(me.cash >= price + 100 ? 'buy' : 'end-turn');
  }
  if (state.phase === 'debt') {
    if (me.cash >= state.debt!.amount) return event('pay-debt');
    const house = state.properties.findIndex(
      (property) =>
        property.owner === seat &&
        !property.mortgaged &&
        property.houses > 0 &&
        (property.houses !== 5 || bankHouses(state) >= 4),
    );
    if (house >= 0) return event('sell-house', { square: house });
    const mortgage = state.properties.findIndex(
      (property, square) =>
        property.owner === seat && !property.mortgaged && isDeed(BOARD[square]!),
    );
    return mortgage >= 0 ? event('mortgage', { square: mortgage }) : event('bankrupt');
  }
  if (state.phase === 'end' || state.phase === 'roll') {
    const redeem = state.properties.findIndex(
      (property, square) =>
        property.owner === seat &&
        property.mortgaged &&
        me.cash >= redeemAmount(state, square) + 100,
    );
    if (redeem >= 0) return event('redeem', { square: redeem });
    const build = state.properties.findIndex((property, square) => {
      const cell = BOARD[square]!;
      if (property.owner !== seat || cell.kind !== 'street' || property.houses >= 5) return false;
      if (state.buildable !== square || me.position !== square || property.mortgaged) return false;
      if (me.cash < cell.houseCost! + 200) return false;
      return property.houses === 4 ? bankHotels(state) > 0 : bankHouses(state) > 0;
    });
    if (build >= 0) return event('build', { square: build });
    if (state.phase === 'end') return event('end-turn');
  }
  if (state.phase === 'roll') {
    if (me.jailed && me.freeCards.length) return event('use-card');
    if (me.jailed && me.jailRolls >= 2 && me.cash >= 50) return event('pay-bail');
    return event('roll');
  }
  return null;
}
