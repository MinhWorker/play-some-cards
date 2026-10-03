import { testGame } from '@psc/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { CHANCE } from './cards.js';
import { BOARD, isDeed } from './model.js';
import { move, rent, resolveSpecialEvent, utilityTax } from './rules.js';

const auction = () => {
  const game = testGame(plugin, ['a', 'b', 'c']);
  game.state.after = 'end';
  move(game.state, 0, 5, false, 7);
  return game;
};

describe('station auction escrow', () => {
  it('requires an auction, holds only the latest bid and refunds before charging the fixed price', () => {
    const game = auction();
    expect(game.state.phase).toBe('auction');
    expect(game.error('a', 'buy')).toBeTruthy();
    game.send('a', 'bid', { amount: 10 });
    expect(game.state.players[0]?.cash).toBe(1490);
    expect(game.error('b', 'bid', { amount: 11 })).toBeTruthy();
    game.send('b', 'bid', { amount: 20 }).send('c', 'pass');
    game.send('a', 'bid', { amount: 30 });
    expect(game.state.players[0]?.cash).toBe(1470);
    game.send('b', 'pass');
    expect(game.state.properties[5]?.owner).toBe(0);
    expect(game.state.players.map((p) => p.cash)).toEqual([1300, 1500, 1500]);
    expect(game.state.auction).toBeNull();
    expect(game.state.transfers.map((t) => t.reason)).toEqual([
      'Rút tiền đấu giá',
      'Hoàn tiền đấu giá',
      'Đấu giá Bến Bắc',
    ]);
  });

  it('allows withdrawing the leader and permanently excludes withdrawn seats', () => {
    const game = auction();
    game.send('a', 'bid', { amount: 10 }).send('b', 'bid', { amount: 20 });
    game.send('c', 'bid', { amount: 30 }).send('a', 'pass');
    expect(game.state.players[0]?.cash).toBe(1500);
    expect(game.error('a', 'bid', { amount: 40 })).toBeTruthy();
    game.send('b', 'bid', { amount: 40 }).send('c', 'pass');
    expect(game.state.properties[5]?.owner).toBe(1);
    expect(game.state.players.map((p) => p.cash)).toEqual([1500, 1300, 1500]);
  });

  it('refunds all deposits if the turn owner leaves, and preserves other deposits if a bidder leaves', () => {
    const game = auction();
    game.send('a', 'bid', { amount: 10 }).send('b', 'bid', { amount: 20 });
    game.leave('c');
    expect(game.state.auction?.bids).toEqual([10, 20, 0]);
    expect(game.state.players.map((p) => p.cash)).toEqual([1490, 1480, 0]);
    game.send('a', 'pass');
    expect(game.state.players[1]?.cash).toBe(1300);
    const leaving = auction();
    leaving.send('a', 'bid', { amount: 10 }).send('b', 'bid', { amount: 20 });
    leaving.leave('a');
    expect(leaving.state.auction).toBeNull();
    expect(leaving.state.players[1]?.cash).toBe(1500);
  });

  it('keeps the fixed increment when the leading bidder leaves', () => {
    const game = auction();
    game
      .send('a', 'bid', { amount: 10 })
      .send('b', 'bid', { amount: 20 })
      .send('c', 'bid', { amount: 30 });
    game.leave('c');
    expect(game.state.auction?.highest).toBe(30);
    expect(game.state.auction?.bids).toEqual([10, 20, 0]);
    game.send('a', 'bid', { amount: 40 }).send('b', 'pass');
    expect(game.state.players[0]?.cash).toBe(1300);
    expect(game.state.players[1]?.cash).toBe(1500);
  });

  it('rejects bids when the fixed station price cannot be paid', () => {
    const game = auction();
    game.state.players[0]!.cash = 199;
    expect(game.error('a', 'bid', { amount: 10 })).toBeTruthy();
    game.send('a', 'pass').send('b', 'pass');
    expect(game.state.properties[5]?.owner).toBe(2);
    expect(game.state.players[2]?.cash).toBe(1300);
  });
});

describe('taxes and table rounds', () => {
  it.each([4, 38])('charges 10%% of cash with a 200 minimum on square %s', (square) => {
    const game = testGame(plugin, ['a', 'b']);
    game.state.players[0]!.cash = 3456;
    move(game.state, 0, square, false, 7);
    expect(game.state.specialEvent).toMatchObject({ kind: 'tax', amount: 345 });
    resolveSpecialEvent(game.state, () => 0);
    expect(game.state.players[0]?.cash).toBe(3111);
    game.state.players[0]!.cash = 100;
    move(game.state, 0, square, false, 7);
    resolveSpecialEvent(game.state, () => 0);
    expect(game.state.debt?.amount).toBe(200);
  });

  it.each([12, 28])('never sells utility %s and doubles only its next table round', (square) => {
    const game = testGame(plugin, ['a', 'b']);
    expect(isDeed(BOARD[square]!)).toBe(false);
    const id = CHANCE.findIndex((card) => card.kind === 'shortage' && card.square === square);
    game.state.chance = [id];
    move(game.state, 0, 7, false, 7);
    resolveSpecialEvent(game.state, () => 0);
    expect(utilityTax(game.state, square)).toBe(100);
    expect(utilityTax(game.state, square === 12 ? 28 : 12)).toBe(100);
    game.state.phase = 'end';
    game.send('a', 'end-turn');
    game.state.phase = 'end';
    game.send('b', 'end-turn');
    expect(game.state.round).toBe(1);
    expect(utilityTax(game.state, square)).toBe(200);
    move(game.state, 0, square, false, 12);
    expect(game.state.specialEvent).toMatchObject({ kind: 'tax', amount: 200 });
    resolveSpecialEvent(game.state, () => 0);
    expect(game.state.players[0]?.cash).toBe(1300);
    game.state.phase = 'end';
    game.send('a', 'end-turn');
    game.state.phase = 'end';
    game.send('b', 'end-turn');
    expect(utilityTax(game.state, square)).toBe(100);
    expect(game.state.shortages).toEqual([]);
  });

  it('triples station rent only with all four stations, while respecting jail and mortgage', () => {
    const game = auction();
    for (const square of [5, 15, 25]) game.state.properties[square]!.owner = 0;
    expect(rent(game.state, 5, 7)).toBe(100);
    game.state.properties[35]!.owner = 0;
    expect(rent(game.state, 5, 7)).toBe(600);
    game.state.players[0]!.jailed = true;
    expect(rent(game.state, 5, 7)).toBe(0);
    game.state.players[0]!.jailed = false;
    game.state.properties[5]!.mortgaged = true;
    expect(rent(game.state, 5, 7)).toBe(0);
  });
});
