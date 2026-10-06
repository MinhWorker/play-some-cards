import type { GameContext } from '@psc/sdk';
import { CHANCE, CHEST, type Deck } from './cards.js';
import {
  BOARD,
  groupSquares,
  isDeed,
  type Options,
  type SpecialEventEffect,
  STATION_BASE_FEE,
  type State,
  UTILITY_SQUARES,
} from './model.js';

export type Context = GameContext<State, Options>;

export const copy = (state: State): State => ({
  ...state,
  moneySequence: (state.moneySequence ?? 0) + 1,
  transfers: [],
  playerTurns: [...state.playerTurns],
  players: state.players.map((p) => ({ ...p, freeCards: [...p.freeCards] })),
  properties: state.properties.map((p) => ({ ...p, mortgage: p.mortgage && { ...p.mortgage } })),
  chance: [...state.chance],
  chest: [...state.chest],
  shortages: state.shortages.map((event) => ({ ...event })),
  stationAuctions: Object.fromEntries(
    Object.entries(state.stationAuctions).map(([square, auction]) => [
      square,
      { ...auction, passed: [...auction.passed], bids: [...auction.bids] },
    ]),
  ),
  auction: state.auction && {
    ...state.auction,
    passed: [...state.auction.passed],
    bids: [...state.auction.bids],
  },
  debt: state.debt && { ...state.debt },
  trade: state.trade && { ...state.trade },
});

export const active = (s: State) => s.players.flatMap((p, i) => (p.bankrupt ? [] : [i]));

export function next(s: State, from: number): number {
  for (let step = 1; step <= s.players.length; step++) {
    const i = (from + step) % s.players.length;
    if (!s.players[i]?.bankrupt) return i;
  }
  return from;
}

/** Count a new personal turn after ending a turn or bankruptcy, never after extra rolls. */
export function startTurn(s: State, seat: number) {
  s.turn = seat;
  s.playerTurns[seat]!++;
}

/** Foreclose at the end of the borrower's third subsequent turn. */
export function expireMortgages(s: State, borrower: number, forced = false): string[] {
  const expired: string[] = [];
  for (const [square, deed] of s.properties.entries()) {
    if (
      !deed.mortgaged ||
      deed.mortgage?.borrower !== borrower ||
      (!forced && s.playerTurns[borrower]! < deed.mortgage.deadline)
    )
      continue;
    deed.owner = null;
    deed.houses = 0;
    deed.mortgaged = false;
    deed.mortgage = undefined;
    expired.push(BOARD[square]!.name);
  }
  return expired;
}

/** Buildings stay on the deed and are pledged at their full original construction cost. */
export function mortgageAmount(s: Pick<State, 'properties'>, square: number) {
  const cell = BOARD[square]!;
  return (cell.price! + s.properties[square]!.houses * (cell.houseCost ?? 0)) / 2;
}

export function redeemAmount(s: Pick<State, 'properties'>, square: number) {
  const principal = s.properties[square]!.mortgage?.principal ?? mortgageAmount(s, square);
  return Math.ceil((principal * 11) / 10);
}

export function mortgageSquares(s: Pick<State, 'properties'>, seat: number) {
  return s.properties.flatMap((deed, square) =>
    deed.owner === seat && !deed.mortgaged && isDeed(BOARD[square]!) ? [square] : [],
  );
}

export function mortgageStatus(
  s: Pick<State, 'playerTurns' | 'turn'>,
  deed: State['properties'][number],
) {
  if (!deed.mortgage) return 'Đang thế chấp';
  const { borrower, deadline } = deed.mortgage;
  const remaining = deadline - s.playerTurns[borrower]!;
  const turnsLeft = remaining + (s.turn === borrower && remaining < 3 ? 1 : 0);
  return remaining <= 0 ? 'Chuộc: hết lượt này' : `Chuộc: còn ${turnsLeft} lượt`;
}

export function ownsGroup(s: Pick<State, 'properties'>, owner: number, square: number): boolean {
  const group = BOARD[square]?.group;
  return Boolean(group && groupSquares(group).every((i) => s.properties[i]?.owner === owner));
}

export const bankHouses = (s: Pick<State, 'properties'>) =>
  32 - s.properties.reduce((sum, p) => sum + (p.houses === 5 ? 0 : p.houses), 0);
export const bankHotels = (s: Pick<State, 'properties'>) =>
  12 - s.properties.filter((p) => p.houses === 5).length;

export function rent(
  s: Pick<State, 'properties' | 'players'> & Partial<Pick<State, 'round' | 'shortages'>>,
  square: number,
  roll: number,
  multiplier = 1,
): number {
  const cell = BOARD[square]!;
  const deed = s.properties[square]!;
  if (deed.owner === null || deed.mortgaged || s.players[deed.owner]?.jailed) return 0;
  if (cell.kind === 'station') {
    const count = [5, 15, 25, 35].filter((i) => s.properties[i]?.owner === deed.owner).length;
    return STATION_BASE_FEE * count;
  }
  if (cell.kind === 'utility') return roll * utilityMultiplier(s, square);
  return (cell.rent?.[deed.houses] ?? 0) * (ownsGroup(s, deed.owner, square) ? 3 : 1);
}

/** Record the same public transfer that changes the authoritative balances. */
export function transferMoney(
  s: State,
  from: number | null,
  to: number | null,
  amount: number,
  reason: string,
) {
  if (amount <= 0) return;
  if (from !== null) s.players[from]!.cash -= amount;
  if (to !== null) s.players[to]!.cash += amount;
  s.transfers.push({ from, to, amount, reason });
}

export function charge(
  s: State,
  payer: number,
  amount: number,
  creditor: number | null,
  reason: string,
) {
  if (amount <= 0) return;
  if (s.players[payer]!.cash < amount) {
    s.debt = { amount, creditor, reason, after: s.after };
    if (payer !== s.turn) s.debt.payer = payer;
    s.phase = 'debt';
    s.notice = `${reason}: cần trả ${amount}. Bán nhà hoặc thế chấp để trả nợ.`;
    return;
  }
  transferMoney(s, payer, creditor, amount, reason);
  s.notice = `${reason}: −${amount}`;
}

export function jail(s: State, seat: number) {
  const p = s.players[seat]!;
  p.position = 10;
  p.jailed = true;
  p.jailRolls = 0;
  s.doubles = 0;
  s.after = 'end';
  s.phase = 'end';
  s.buildable = null;
  s.notice = 'Vào tù!';
}

export function move(
  s: State,
  seat: number,
  target: number,
  collectStart: boolean,
  roll: number,
  multiplier = 1,
) {
  const p = s.players[seat]!;
  if (collectStart && target <= p.position) transferMoney(s, null, seat, 200, 'Qua Xuất phát');
  p.position = target;
  land(s, seat, roll, multiplier);
}

function draw(s: State, deck: Deck, _seat: number, roll: number) {
  const id = s[deck][0];
  if (id === undefined) throw new Error('Empty card deck');
  const card = (deck === 'chance' ? CHANCE : CHEST)[id]!;
  s.lastCard = card.text;
  s.notice = card.text;
  awaitSpecialEvent(s, { kind: 'card', card, deck, roll });
}

export function awaitSpecialEvent(s: State, event: SpecialEventEffect) {
  s.specialEvent = { ...event, id: s.moneySequence, ready: false };
  s.phase = 'event';
  s.notice =
    event.kind === 'card'
      ? event.card.text
      : event.kind === 'tax'
        ? `${event.reason}: cần nộp ${event.amount.toLocaleString('vi-VN')} ₫.`
        : event.reason;
}

/** Apply a revealed event only once its owner or the server timer confirms it. */
export function resolveSpecialEvent(s: State, rng: () => number) {
  const event = s.specialEvent;
  if (!event) return;
  s.specialEvent = null;
  s.phase = s.after;
  const seat = s.turn;
  if (event.kind === 'airport') {
    // Uniformly choose among the other 39 squares; a flight never loops into the airport.
    const choice = Math.floor(rng() * (BOARD.length - 1));
    const target = choice >= 20 ? choice + 1 : choice;
    if (target === 0) transferMoney(s, null, seat, 200, 'Đáp Xuất phát');
    move(s, seat, target, false, event.roll);
    return;
  }
  if (event.kind === 'tax') {
    charge(s, seat, event.amount, null, event.reason);
    return;
  }
  if (event.kind === 'jail') {
    jail(s, seat);
    s.notice = event.reason;
    return;
  }
  const { card, deck, roll } = event;
  const id = s[deck].shift();
  if (id === undefined) throw new Error('Empty card deck');
  if (card.kind !== 'free') s[deck].push(id);
  switch (card.kind) {
    case 'shortage':
      s.shortages.push({ square: card.square, round: s.round + 1 });
      break;
    case 'cash':
      if (card.amount > 0) transferMoney(s, null, seat, card.amount, card.text);
      else charge(s, seat, -card.amount, null, card.text);
      break;
    case 'move':
      move(s, seat, card.target, true, roll);
      break;
    case 'nearest': {
      const targets = card.target === 'station' ? [5, 15, 25, 35] : UTILITY_SQUARES;
      const target = targets.find((i) => i > s.players[seat]!.position) ?? targets[0]!;
      move(s, seat, target, true, roll, 2);
      break;
    }
    case 'jail':
      jail(s, seat);
      break;
    case 'free':
      s.players[seat]!.freeCards.push(deck);
      break;
    case 'repairs': {
      const amount = s.properties.reduce((sum, deed) => {
        if (deed.owner !== seat) return sum;
        return sum + (deed.houses === 5 ? card.hotel : deed.houses * card.house);
      }, 0);
      charge(s, seat, amount, null, card.text);
      break;
    }
  }
}

export function utilityMultiplier(
  s: Pick<State, 'properties'> & Partial<Pick<State, 'round' | 'shortages'>>,
  square: number,
) {
  const owner = s.properties[square]?.owner;
  if (owner === null || owner === undefined) return 0;
  const both = UTILITY_SQUARES.every((i) => s.properties[i]?.owner === owner);
  const shortage = s.shortages?.some((event) => event.square === square && event.round === s.round);
  return (both ? 10 : 4) * (shortage ? 2 : 1);
}

/** Gross assets at original deed/building prices, less outstanding mortgage redemption. */
export function assetValue(s: Pick<State, 'players' | 'properties'>, seat: number) {
  return (
    s.players[seat]!.cash +
    s.players[seat]!.freeCards.length * 200 +
    s.properties.reduce(
      (sum, deed, square) =>
        deed.owner !== seat
          ? sum
          : sum +
            BOARD[square]!.price! +
            deed.houses * (BOARD[square]!.houseCost ?? 0) -
            (deed.mortgaged ? redeemAmount(s, square) : 0),
      0,
    )
  );
}

export function land(s: State, seat: number, roll: number, multiplier = 1) {
  const square = s.players[seat]!.position;
  const cell = BOARD[square]!;
  s.phase = s.after;
  s.pending = null;
  s.buildable = null;
  s.notice = `Đến ${cell.name}.`;
  if (isDeed(cell)) {
    const owner = s.properties[square]!.owner;
    if (owner === null) {
      if (cell.kind === 'station') {
        s.stationAuctions[square] ??= {
          square,
          highest: 0,
          leader: null,
          passed: [],
          bids: s.players.map(() => 0),
        };
        const auction = s.stationAuctions[square]!;
        if (auction.passed.includes(seat) || auction.leader === seat) return;
        s.auction = { ...auction, bidder: seat };
      }
      s.pending = square;
      s.phase = cell.kind === 'station' ? 'auction' : 'buy';
    } else if (owner === seat && cell.kind === 'street' && !s.players[seat]!.jailed) {
      s.buildable = square;
    } else if (owner !== seat) {
      charge(s, seat, rent(s, square, roll, multiplier), owner, `Tiền thuê ${cell.name}`);
    }
  } else if (cell.kind === 'tax') {
    awaitSpecialEvent(s, {
      kind: 'tax',
      amount: Math.max(cell.tax!, Math.floor(s.players[seat]!.cash * 0.1)),
      reason: cell.name,
    });
  } else if (cell.kind === 'chance' || cell.kind === 'chest') {
    draw(s, cell.kind, seat, roll);
  } else if (cell.kind === 'go-jail') {
    awaitSpecialEvent(s, { kind: 'jail', reason: 'Bị đưa vào tù!' });
  } else if (cell.kind === 'airport') {
    awaitSpecialEvent(s, { kind: 'airport', roll, reason: 'Chuyến bay đến một ô ngẫu nhiên.' });
  }
}

export function finishIfLast(s: State, ctx: Context) {
  const survivors = active(s);
  if (survivors.length === 1) {
    for (const auction of Object.values(s.stationAuctions)) {
      auction.bids.forEach((amount, seat) => {
        transferMoney(s, null, seat, amount, 'Hoàn tiền đấu giá');
      });
    }
    s.stationAuctions = {};
    s.winner = survivors[0]!;
    ctx.finish([ctx.players[survivors[0]!]!.id]);
  }
}

/** Resolve between decisions, so a winner's debt cannot overwrite another landing. */
export function settleStations(s: State) {
  if (s.winner !== null || (s.phase !== 'roll' && s.phase !== 'end')) return;
  const settlements = Object.values(s.stationAuctions)
    .map((auction) => ({
      auction,
      remaining: active(s).filter((seat) => !auction.passed.includes(seat)),
    }))
    .filter(({ remaining }) => remaining.length <= 1);
  // All qualifying deposits become spendable before any purchase can create debt.
  for (const { auction } of settlements) {
    auction.bids.forEach((amount, seat) => {
      transferMoney(s, null, seat, amount, 'Hoàn tiền đấu giá');
      auction.bids[seat] = 0;
    });
  }
  for (const { auction, remaining } of settlements) {
    delete s.stationAuctions[auction.square];
    const winner = remaining[0];
    if (winner === undefined) continue;
    const resume = s.phase;
    s.properties[auction.square]!.owner = winner;
    charge(s, winner, BOARD[auction.square]!.price!, null, `Mua ${BOARD[auction.square]!.name}`);
    if (s.debt) {
      s.debt.after = resume;
      return;
    }
    s.notice = `${BOARD[auction.square]!.name} bán giá ${BOARD[auction.square]!.price}.`;
  }
}

export function bankrupt(s: State, seat: number, creditor: number | null, ctx: Context) {
  const p = s.players[seat]!;
  for (const auction of Object.values(s.stationAuctions)) {
    transferMoney(s, null, seat, auction.bids[seat]!, 'Hoàn tiền đấu giá');
    auction.bids[seat] = 0;
    if (!auction.passed.includes(seat)) auction.passed.push(seat);
    if (auction.leader === seat) auction.leader = null;
  }
  p.bankrupt = true;
  expireMortgages(s, seat, true);
  for (const [i, deed] of s.properties.entries()) {
    if (deed.owner === seat && deed.houses)
      transferMoney(s, null, seat, (deed.houses * BOARD[i]!.houseCost!) / 2, 'Thanh lý nhà');
  }
  if (creditor !== null && !s.players[creditor]!.bankrupt) {
    transferMoney(s, seat, creditor, p.cash, 'Thanh lý tài sản');
    s.players[creditor]!.freeCards.push(...p.freeCards);
  } else {
    for (const deck of p.freeCards) {
      const cards = deck === 'chance' ? CHANCE : CHEST;
      s[deck].push(cards.findIndex((card) => card.kind === 'free'));
    }
  }
  if (p.cash > 0) transferMoney(s, seat, null, p.cash, 'Thanh lý tài sản');
  for (const deed of s.properties) {
    if (deed.owner !== seat) continue;
    deed.owner = creditor;
    deed.houses = 0;
    if (creditor === null) {
      deed.mortgaged = false;
      deed.mortgage = undefined;
    }
  }
  p.freeCards = [];
  if (s.turn === seat) s.specialEvent = null;
  s.trade = null;
  s.auction = null;
  s.debt = null;
  s.pending = null;
  if (s.turn === seat) s.buildable = null;
  s.notice = `${ctx.players[seat]?.name ?? 'Người chơi'} đã phá sản.`;
  finishIfLast(s, ctx);
  if (s.winner === null && s.turn === seat) {
    startTurn(s, next(s, seat));
    if (s.turn <= seat) s.round++;
    s.phase = 'roll';
    s.doubles = 0;
    s.dice = null;
  }
}
