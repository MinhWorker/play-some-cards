import type { GameContext } from '@psc/sdk';
import { CHANCE, CHEST, type Deck } from './cards.js';
import { BOARD, groupSquares, isDeed, type State } from './model.js';

export type Context = GameContext<State>;

export const copy = (state: State): State => ({
  ...state,
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

export function ownsGroup(s: State, owner: number, square: number): boolean {
  const group = BOARD[square]?.group;
  return Boolean(group && groupSquares(group).every((i) => s.properties[i]?.owner === owner));
}

export function buildingsInGroup(s: State, square: number): boolean {
  const group = BOARD[square]?.group;
  return group ? groupSquares(group).some((i) => (s.properties[i]?.houses ?? 0) > 0) : false;
}

export const bankHouses = (s: State) =>
  32 - s.properties.reduce((sum, p) => sum + (p.houses === 5 ? 0 : p.houses), 0);
export const bankHotels = (s: State) => 12 - s.properties.filter((p) => p.houses === 5).length;

export function rent(s: State, square: number, roll: number, multiplier = 1): number {
  const cell = BOARD[square]!;
  const deed = s.properties[square]!;
  if (deed.owner === null || deed.mortgaged) return 0;
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
  s.players[payer]!.cash -= amount;
  if (creditor !== null) s.players[creditor]!.cash += amount;
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
  if (collectStart && target <= p.position) p.cash += 200;
  p.position = target;
  land(s, seat, roll, multiplier);
}

function draw(s: State, deck: Deck, seat: number, roll: number) {
  const id = s[deck].shift();
  if (id === undefined) throw new Error('Empty card deck');
  const card = (deck === 'chance' ? CHANCE : CHEST)[id]!;
  s.lastCard = card.text;
  s.notice = card.text;
  if (card.kind !== 'free') s[deck].push(id);
  switch (card.kind) {
    case 'cash':
      if (card.amount > 0) s.players[seat]!.cash += card.amount;
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
  s.notice = `Đến ${cell.name}.`;
  if (isDeed(cell)) {
    const owner = s.properties[square]!.owner;
    if (owner === null) {
      s.pending = square;
      s.phase = 'buy';
    } else if (owner !== seat) {
      charge(s, seat, rent(s, square, roll, multiplier), owner, `Tiền thuê ${cell.name}`);
    }
  } else if (cell.kind === 'tax') {
    charge(s, seat, cell.tax!, null, cell.name);
  } else if (cell.kind === 'chance' || cell.kind === 'chest') {
    draw(s, cell.kind, seat, roll);
  } else if (cell.kind === 'go-jail') {
    jail(s, seat);
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
    if (deed.owner === seat && deed.houses) p.cash += (deed.houses * BOARD[i]!.houseCost!) / 2;
  }
  if (creditor !== null && !s.players[creditor]!.bankrupt) {
    s.players[creditor]!.cash += p.cash;
  }
  p.cash = 0;
  for (const deed of s.properties) {
    if (deed.owner !== seat) continue;
    deed.owner = creditor;
    deed.houses = 0;
    if (creditor === null) deed.mortgaged = false;
  }
  p.freeCards = [];
  s.trade = null;
  s.auction = null;
  s.debt = null;
  s.pending = null;
  s.notice = `${ctx.players[seat]?.name ?? 'Người chơi'} đã phá sản.`;
  finishIfLast(s, ctx);
  if (s.winner === null && s.turn === seat) {
    s.turn = next(s, seat);
    s.phase = 'roll';
    s.doubles = 0;
    s.dice = null;
  }
}
