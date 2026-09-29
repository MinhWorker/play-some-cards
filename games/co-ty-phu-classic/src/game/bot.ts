import type { GameEvent } from '@psc/sdk';
import { BOARD, groupSquares, isDeed, type State } from './model.js';
import { bankHotels, bankHouses, buildingsInGroup, ownsGroup } from './rules.js';

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
    const offered = deedValue(trade.give) + trade.giveCash;
    const requested = deedValue(trade.take) + trade.takeCash;
    return event(offered >= requested ? 'accept-trade' : 'decline-trade');
  }

  if (state.phase === 'auction') {
    const auction = state.auction;
    if (!auction || auction.bidder !== seat) return null;
    const max = Math.min(me.cash - 100, Math.floor((BOARD[auction.square]?.price ?? 0) * 0.9));
    const amount = auction.highest + 10;
    return max >= amount ? event('bid', { amount }) : event('pass');
  }

  if (state.turn !== seat) return null;
  if (state.phase === 'roll') {
    if (me.jailed && me.freeCards.length) return event('use-card');
    if (me.jailed && me.jailRolls >= 2 && me.cash >= 50) return event('pay-bail');
    return event('roll');
  }
  if (state.phase === 'buy') {
    const price = BOARD[state.pending ?? -1]?.price ?? Infinity;
    return event(me.cash >= price + 100 ? 'buy' : 'auction');
  }
  if (state.phase === 'debt') {
    if (me.cash >= state.debt!.amount) return event('pay-debt');
    const house = state.properties.findIndex(
      (property, square) =>
        property.owner === seat &&
        property.houses > 0 &&
        (property.houses !== 5 || bankHouses(state) >= 4) &&
        property.houses ===
          Math.max(...groupSquares(BOARD[square]!.group!).map((i) => state.properties[i]!.houses)),
    );
    if (house >= 0) return event('sell-house', { square: house });
    const mortgage = state.properties.findIndex(
      (property, square) =>
        property.owner === seat &&
        !property.mortgaged &&
        isDeed(BOARD[square]!) &&
        !buildingsInGroup(state, square),
    );
    return mortgage >= 0 ? event('mortgage', { square: mortgage }) : event('bankrupt');
  }
  if (state.phase === 'end') {
    const build = state.properties.findIndex((property, square) => {
      const cell = BOARD[square]!;
      if (property.owner !== seat || cell.kind !== 'street' || property.houses >= 5) return false;
      if (!ownsGroup(state, seat, square) || me.cash < cell.houseCost! + 200) return false;
      const group = groupSquares(cell.group!);
      if (group.some((i) => state.properties[i]!.mortgaged)) return false;
      if (property.houses > Math.min(...group.map((i) => state.properties[i]!.houses)))
        return false;
      return property.houses === 4 ? bankHotels(state) > 0 : bankHouses(state) > 0;
    });
    return build >= 0 ? event('build', { square: build }) : event('end-turn');
  }
  return null;
}
