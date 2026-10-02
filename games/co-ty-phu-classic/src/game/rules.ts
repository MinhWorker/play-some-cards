import type { GameContext } from '@psc/sdk';
import { CHANCE, CHEST, type Deck } from './cards.js';
import {
  BOARD,
  groupSquares,
  isDeed,
  type Options,
  type SpecialEventEffect,
  type State,
} from './model.js';

export type Context = GameContext<State, Options>;

export const copy = (state: State): State => ({
  ...state,
  moneySequence: (state.moneySequence ?? 0) + 1,
  transfers: [],
  players: state.players.map((p) => ({ ...p, freeCards: [...p.freeCards] })),
  properties: state.properties.map((p) => ({ ...p })),
  chance: [...state.chance],
  chest: [...state.chest],
  auction: state.auction && { ...state.auction, passed: [...state.auction.passed] },
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

export function ownsGroup(s: Pick<State, 'properties'>, owner: number, square: number): boolean {
  const group = BOARD[square]?.group;
  return Boolean(group && groupSquares(group).every((i) => s.properties[i]?.owner === owner));
}

export const bankHouses = (s: Pick<State, 'properties'>) =>
  32 - s.properties.reduce((sum, p) => sum + (p.houses === 5 ? 0 : p.houses), 0);
export const bankHotels = (s: Pick<State, 'properties'>) =>
  12 - s.properties.filter((p) => p.houses === 5).length;

export function rent(
  s: Pick<State, 'properties' | 'players'>,
  square: number,
  roll: number,
  multiplier = 1,
): number {
  const cell = BOARD[square]!;
  const deed = s.properties[square]!;
  if (deed.owner === null || deed.mortgaged || s.players[deed.owner]?.jailed) return 0;
  if (cell.kind === 'station') {
    const count = [5, 15, 25, 35].filter((i) => s.properties[i]?.owner === deed.owner).length;
    return 25 * 2 ** (count - 1) * multiplier;
  }
  if (cell.kind === 'utility') {
    const both = s.properties[12]?.owner === deed.owner && s.properties[28]?.owner === deed.owner;
    return roll * (multiplier > 1 ? 10 : both ? 10 : 4);
  }
  return (
    (cell.rent?.[deed.houses] ?? 0) *
    (deed.houses === 0 && ownsGroup(s, deed.owner, square) ? 2 : 1)
  );
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
    case 'cash':
      if (card.amount > 0) transferMoney(s, null, seat, card.amount, card.text);
      else charge(s, seat, -card.amount, null, card.text);
      break;
    case 'move':
      move(s, seat, card.target, true, roll);
      break;
    case 'nearest': {
      const targets = card.target === 'station' ? [5, 15, 25, 35] : [12, 28];
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
      s.pending = square;
      s.phase = 'buy';
    } else if (owner === seat && cell.kind === 'street' && !s.players[seat]!.jailed) {
      s.buildable = square;
    } else if (owner !== seat) {
      charge(s, seat, rent(s, square, roll, multiplier), owner, `Tiền thuê ${cell.name}`);
    }
  } else if (cell.kind === 'tax') {
    awaitSpecialEvent(s, {
      kind: 'tax',
      amount: cell.tax!,
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
    s.winner = survivors[0]!;
    ctx.finish([ctx.players[survivors[0]!]!.id]);
  }
}

export function bankrupt(s: State, seat: number, creditor: number | null, ctx: Context) {
  const p = s.players[seat]!;
  p.bankrupt = true;
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
    if (creditor === null) deed.mortgaged = false;
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
    s.turn = next(s, seat);
    s.phase = 'roll';
    s.doubles = 0;
    s.dice = null;
  }
}
