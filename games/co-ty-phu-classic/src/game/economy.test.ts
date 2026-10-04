import { seededRng, testGame } from '@psc/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { botMove } from './bot.js';
import { CHANCE } from './cards.js';
import { AUCTION_TURN_MS, BOARD, isDeed } from './model.js';
import { copy, move, rent, resolveSpecialEvent, utilityTax } from './rules.js';

const auction = () => {
  const game = testGame(plugin, ['a', 'b', 'c']);
  game.state.after = 'end';
  move(game.state, 0, 5, false, 7);
  return game;
};

const visit = (game: ReturnType<typeof auction>, seat: number, square = 5) => {
  game.state.turn = seat;
  game.state.after = 'end';
  move(game.state, seat, square, false, 7);
};

describe('station contributions on landing', () => {
  it('refunds every simultaneously resolved station before checking purchase affordability', () => {
    const game = testGame(plugin, ['a', 'b', 'c', 'd']);
    game.state.players[0]!.cash = 0;
    game.state.stationAuctions[5] = {
      square: 5,
      highest: 50,
      leader: 0,
      passed: [1, 3],
      bids: [50, 0, 0, 0],
    };
    game.state.stationAuctions[15] = {
      square: 15,
      highest: 150,
      leader: 0,
      passed: [1, 3],
      bids: [300, 0, 0, 0],
    };
    game.state.turn = 3;
    game.state.phase = 'end';
    game.leave('c');
    expect(game.state.players[0]!.cash).toBe(150);
    expect(game.state.properties[5]!.owner).toBe(0);
    expect(game.state.properties[15]!.owner).toBe(0);
    expect(game.state.debt).toMatchObject({ payer: 0, amount: 200, reason: 'Mua Bến Trung' });
    game.send('a', 'mortgage', { square: 5 }).send('a', 'pay-debt');
    expect(game.state.players[0]!.cash).toBe(50);
    expect(game.state.debt).toBeNull();
    expect(game.state.turn).toBe(3);
    expect(game.state.phase).toBe('end');
  });

  it('only lets the visitor contribute once, then resumes the turn and persists the deposit', () => {
    const game = auction();
    expect(game.error('a', 'buy')).toBeTruthy();
    expect(game.error('b', 'bid', { amount: 50 })).toBeTruthy();
    expect(game.error('b', 'pass')).toBeTruthy();
    expect(game.error('a', 'bid', { amount: 10 })).toBeTruthy();
    game.send('a', 'bid', { amount: 50 });
    const previous = game.state;
    expect(previous.phase).toBe('end');
    expect(previous.auction).toBeNull();
    expect(previous.pending).toBeNull();
    expect(previous.players[0]!.cash).toBe(1450);
    expect(game.error('a', 'bid', { amount: 100 })).toBeTruthy();
    game.send('a', 'end-turn');
    expect(game.state.stationAuctions[5]!.bids).toEqual([50, 0, 0]);
    visit(game, 1);
    game.send('b', 'bid', { amount: 100 });
    visit(game, 0);
    expect(game.error('a', 'bid', { amount: 200 })).toBeTruthy();
    game.send('a', 'bid', { amount: 150 });
    expect(game.state.stationAuctions[5]!.bids).toEqual([200, 100, 0]);
    expect(game.state.players[0]!.cash).toBe(1300);
    expect(previous.stationAuctions[5]!.bids).toEqual([50, 0, 0]);
  });

  it('keeps withdrawn deposits until three of four players pass, then refunds before payment', () => {
    const game = testGame(plugin, ['a', 'b', 'c', 'd']);
    for (const [seat, amount] of [
      [0, 50],
      [1, 100],
      [2, 150],
      [0, 200],
    ]) {
      visit(game, seat!);
      game.send(['a', 'b', 'c', 'd'][seat!]!, 'bid', { amount });
    }
    expect(game.state.stationAuctions[5]!.bids).toEqual([250, 100, 150, 0]);
    visit(game, 1);
    game.send('b', 'pass');
    expect(game.state.players[1]!.cash).toBe(1400);
    expect(game.state.stationAuctions[5]!.highest).toBe(200);
    visit(game, 1);
    expect(game.state.phase).toBe('end');
    expect(game.error('b', 'bid', { amount: 250 })).toBeTruthy();
    visit(game, 2);
    game.send('c', 'pass');
    expect(game.state.properties[5]!.owner).toBeNull(); // d has never visited.
    visit(game, 3);
    game.send('d', 'pass');
    expect(game.state.properties[5]!.owner).toBe(0);
    expect(game.state.players.map((p) => p.cash)).toEqual([1300, 1500, 1500, 1500]);
    expect(game.state.stationAuctions[5]).toBeUndefined();
    expect(game.state.transfers.map((t) => t.amount)).toEqual([250, 100, 150, 200]);
    expect(game.state.transfers.at(-1)).toMatchObject({ from: 0, to: null, reason: 'Mua Bến Bắc' });
  });

  it('uses spendable cash for each new contribution and tracks stations independently', () => {
    const game = auction();
    game.state.players[0]!.cash = 50;
    game.send('a', 'bid', { amount: 50 });
    visit(game, 0);
    expect(game.error('a', 'bid', { amount: 100 })).toBeTruthy();
    visit(game, 1, 15);
    game.send('b', 'bid', { amount: 50 });
    expect(game.state.stationAuctions[5]!.highest).toBe(50);
    expect(game.state.stationAuctions[15]!.highest).toBe(50);
    expect(copy(game.state).stationAuctions[15]).not.toBe(game.state.stationAuctions[15]);
  });

  it('preserves an extra roll after contributing and allows the latest contributor to withdraw', () => {
    const game = auction();
    game.state.after = 'roll';
    game.send('a', 'bid', { amount: 50 });
    expect(game.state.phase).toBe('roll');
    visit(game, 0);
    game.send('a', 'pass');
    expect(game.state.stationAuctions[5]!.passed).toEqual([0]);
    expect(game.state.players[0]!.cash).toBe(1450);
  });

  it('passes only the visitor after the station decision countdown expires', () => {
    const game = testGame(plugin, ['a', 'b', 'c'], { seed: 1 });
    const rng = seededRng(1);
    for (let i = 0; i < 24; i++) rng();
    const sum = 2 + Math.floor(rng() * 6) + Math.floor(rng() * 6);
    game.state.players[0]!.position = (5 - sum + 40) % 40;
    game.send('a', 'roll');
    expect(game.timer).toMatchObject({ event: 'turn-timeout', ms: AUCTION_TURN_MS });
    game.fireTimer();
    expect(game.state.stationAuctions[5]!.passed).toEqual([0]);
    expect(game.state.auction).toBeNull();
    expect(game.state.properties[5]!.owner).toBeNull();
  });

  it('refunds the leaver before liquidation without canceling other station deposits', () => {
    const game = auction();
    game.send('a', 'bid', { amount: 50 });
    visit(game, 1);
    game.send('b', 'bid', { amount: 100 });
    game.leave('b');
    expect(game.state.stationAuctions[5]!.bids).toEqual([50, 0, 0]);
    expect(game.state.stationAuctions[5]!.highest).toBe(100);
    expect(game.state.players.map((p) => p.cash)).toEqual([1450, 0, 1500]);
    expect(game.state.transfers[0]).toMatchObject({ to: 1, amount: 100 });
    visit(game, 2);
    game.send('c', 'pass');
    expect(game.state.properties[5]!.owner).toBe(0);
    expect(game.state.players[0]!.cash).toBe(1300);
  });

  it('retains other deposits when the current visitor leaves during a station decision', () => {
    const game = testGame(plugin, ['a', 'b', 'c', 'd']);
    visit(game, 0);
    game.send('a', 'bid', { amount: 50 });
    visit(game, 1);
    game.leave('b');
    expect(game.state.turn).toBe(2);
    expect(game.state.phase).toBe('roll');
    expect(game.state.stationAuctions[5]!.bids).toEqual([50, 0, 0, 0]);
    expect(game.state.stationAuctions[5]!.passed).toEqual([1]);
  });

  it('lets an off-turn winner settle the purchase debt and resumes the visiting player', () => {
    const game = auction();
    game.state.players[0]!.cash = 50;
    game.send('a', 'bid', { amount: 50 });
    game.state.properties[3]!.owner = 0;
    visit(game, 1);
    game.send('b', 'pass');
    visit(game, 2);
    game.send('c', 'pass');
    expect(game.state.debt).toMatchObject({ payer: 0, amount: 200, after: 'end' });
    expect(game.state.players[0]!.cash).toBe(50);
    expect(game.state.turn).toBe(2);
    expect(game.error('c', 'pay-debt')).toBeTruthy();
    expect(botMove(game.state, 0)?.event).toBe('mortgage');
    game.send('a', 'mortgage', { square: 3 }).send('a', 'pay-debt');
    expect(game.state.players[0]!.cash).toBe(10);
    expect(game.state.phase).toBe('end');
    expect(game.state.turn).toBe(2);
    expect(game.state.properties[5]!.owner).toBe(0);
  });

  it('handles an insolvent off-turn winner without taking away the visitor’s turn', () => {
    const game = auction();
    game.state.players[0]!.cash = 50;
    game.send('a', 'bid', { amount: 50 });
    visit(game, 1);
    game.send('b', 'pass');
    visit(game, 2);
    game.send('c', 'pass');
    game.send('a', 'bankrupt');
    expect(game.state.turn).toBe(2);
    expect(game.state.phase).toBe('end');
    expect(game.state.properties[5]!.owner).toBeNull();
    expect(game.state.stationAuctions).toEqual({});
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

  it('charges linear station fees while respecting jail and mortgage', () => {
    const game = auction();
    for (const square of [5, 15, 25]) game.state.properties[square]!.owner = 0;
    expect(rent(game.state, 5, 7)).toBe(150);
    game.state.properties[35]!.owner = 0;
    expect(rent(game.state, 5, 7, 2)).toBe(200);
    game.state.players[0]!.jailed = true;
    expect(rent(game.state, 5, 7)).toBe(0);
    game.state.players[0]!.jailed = false;
    game.state.properties[5]!.mortgaged = true;
    expect(rent(game.state, 5, 7)).toBe(0);
  });
});

describe('station fee payments', () => {
  it.each([1, 2, 3, 4])('charges 50 times %s owned stations directly to the owner', (count) => {
    const game = testGame(plugin, ['a', 'b']);
    for (const square of [5, 15, 25, 35].slice(0, count)) game.state.properties[square]!.owner = 1;
    move(game.state, 0, 5, false, 7);
    expect(game.state.transfers).toContainEqual({
      from: 0,
      to: 1,
      amount: 50 * count,
      reason: 'Tiền thuê Bến Bắc',
    });
    expect(game.state.players.map((p) => p.cash)).toEqual([1500 - 50 * count, 1500 + 50 * count]);
    const before = game.state.players[1]!.cash;
    move(game.state, 1, 5, false, 7);
    expect(game.state.players[1]!.cash).toBe(before);
  });

  it('uses the same fee for the nearest-station card and creates rent debt when cash is short', () => {
    const game = testGame(plugin, ['a', 'b']);
    game.state.properties[5]!.owner = 1;
    game.state.chance = [
      CHANCE.findIndex((card) => card.kind === 'nearest' && card.target === 'station'),
    ];
    move(game.state, 0, 36, false, 7);
    resolveSpecialEvent(game.state, () => 0);
    expect(game.state.transfers.at(-1)).toMatchObject({ from: 0, to: 1, amount: 50 });
    game.state.players[0]!.cash = 49;
    move(game.state, 0, 5, false, 7);
    expect(game.state.debt).toMatchObject({ creditor: 1, amount: 50 });
  });
});
