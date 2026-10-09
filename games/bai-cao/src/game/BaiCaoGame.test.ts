import { testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { type Card, compareHands, handName, handOf } from './cards.js';
import { DEFAULT_BET, type Options, type View } from './model.js';

/** A card from its rank (A 2 … 10 J Q K) and suit (c s h d). */
const card = (text: string): Card => {
  const rank = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'].indexOf(
    text.slice(0, -1),
  );
  return rank * 4 + 'cshd'.indexOf(text.slice(-1));
};
const hand = (...cards: string[]) => handOf(cards.map(card));

const fresh = (players = ['a', 'b', 'c'], options: Partial<Options> = {}) =>
  testGame(plugin, players, { options });

describe('bài cào hands', () => {
  it('adds the points and keeps the last digit; 10 J Q K count nothing', () => {
    expect(hand('Ac', '2c', '3c')).toMatchObject({ points: 6, tay: false });
    expect(hand('9c', '8d', '10h').points).toBe(7);
    expect(hand('5c', '5d', 'Kh').points).toBe(0);
    expect(handName(hand('5c', '5d', 'Kh'))).toBe('Bù');
    expect(handName(hand('4c', '5d', 'Kh'))).toBe('9 nút');
  });

  it('puts Ba Tây above everything, then points, then the strongest card', () => {
    expect(hand('Jc', 'Qd', 'Kh').tay).toBe(true);
    expect(handName(hand('Jc', 'Qd', 'Kh'))).toBe('Ba Tây');
    expect(compareHands(hand('Jc', 'Qd', 'Kh'), hand('4c', '5d', 'Kd'))).toBeGreaterThan(0);
    expect(compareHands(hand('4c', '5d', '10h'), hand('2c', '3d', '4h'))).toBeGreaterThan(0);
    // 9 each: the king of diamonds beats the king of hearts.
    expect(compareHands(hand('4c', '5c', 'Kd'), hand('4d', '5d', 'Kh'))).toBeGreaterThan(0);
  });
});

describe('bài cào', () => {
  it('starts round 1 with the first seat dealing and everyone betting', () => {
    const game = fresh();
    expect(game.state).toMatchObject({ round: 1, rounds: 10, phase: 'bet', dealer: 0 });
    expect(game.state.points).toEqual([0, 0, 0]);
    expect(game.timer?.event).toBe('bet-over');
  });

  it('takes bets from everyone but the dealer, then deals three cards each', () => {
    const game = fresh();
    expect(game.error('a', 'bet', { amount: 10 })).toBe('Nhà cái không đặt cược');
    expect(game.error('b', 'bet', { amount: 7 })).toBe('Mức cược không hợp lệ');
    game.send('b', 'bet', { amount: 10 });
    expect(game.error('b', 'bet', { amount: 5 })).toBe('Bạn đã đặt cược');
    expect(game.state.phase).toBe('bet');
    game.send('c', 'bet', { amount: 20 });
    expect(game.state.phase).toBe('reveal');
    expect(game.state.hands.map((h) => h.length)).toEqual([3, 3, 3]);
    expect(new Set(game.state.hands.flat()).size).toBe(9);
    expect(game.timer?.event).toBe('reveal-over');
  });

  it('keeps cards secret until they are turned over', () => {
    const game = fresh();
    game.send('b', 'bet', { amount: 10 }).send('c', 'bet', { amount: 10 });
    const [a, b] = game.state.hands;
    game.assertHidden('a', b).assertHidden(null, a, b);
    expect((game.view('a') as View).hands[0]).toEqual(a);
    expect((game.view('a') as View).hands[1]).toBeNull();
    game.send('b', 'reveal');
    expect((game.view('a') as View).hands[1]).toEqual(b);
  });

  it('counts each hand against the dealer once everyone has turned over', () => {
    const game = fresh();
    game.send('b', 'bet', { amount: 10 }).send('c', 'bet', { amount: 20 });
    for (const p of ['a', 'b', 'c']) game.send(p, 'reveal');
    const { state } = game;
    expect(state.phase).toBe('showdown');
    const dealer = handOf(state.hands[0] ?? []);
    const expected = [1, 2].map((s) => {
      const mine = handOf(state.hands[s] ?? []);
      const won = compareHands(mine, dealer) > 0;
      return (won ? 1 : -1) * (s === 1 ? 10 : 20) * ((won ? mine : dealer).tay ? 2 : 1);
    });
    const [b = 0, c = 0] = expected;
    expect(state.points).toEqual([-(b + c), b, c]);
    expect(game.timer?.event).toBe('next-round');
  });

  it('bets the least for whoever is too slow, and turns every hand over when time is up', () => {
    const game = fresh();
    game.send('b', 'bet', { amount: 20 });
    game.fireTimer();
    expect(game.state.bets).toEqual([null, 20, DEFAULT_BET]);
    game.fireTimer();
    expect(game.state.phase).toBe('showdown');
    expect(game.state.revealed).toEqual([true, true, true]);
  });

  it('passes the deal round the table, and ends after the last round', () => {
    const game = fresh(['a', 'b'], { rounds: 5 });
    for (let round = 1; round <= 5; round++) {
      expect(game.state).toMatchObject({ round, dealer: (round - 1) % 2 });
      game.fireTimer().fireTimer().fireTimer();
    }
    expect(game.result).not.toBeNull();
    const [a = 0, b = 0] = game.state.points;
    expect(a + b).toBe(0);
    expect(game.result?.winners).toEqual(a === b ? [] : [a > b ? 'a' : 'b']);
  });

  it('lets the others play on when someone leaves, and ends when one is left', () => {
    const game = fresh();
    game.send('b', 'bet', { amount: 10 });
    game.leave('c');
    // c's bet no longer counts: b was the last one to bet, so the cards are out.
    expect(game.state.phase).toBe('reveal');
    expect(game.state.hands[2]).toEqual([]);
    game.send('a', 'reveal').send('b', 'reveal');
    expect(game.state.phase).toBe('showdown');
    game.leave('b');
    expect(game.result).not.toBeNull();
  });

  it('calls the round off when the dealer leaves', () => {
    const game = fresh();
    game.send('b', 'bet', { amount: 10 });
    game.leave('a');
    expect(game.state).toMatchObject({ phase: 'showdown', results: null, points: [0, 0, 0] });
    game.fireTimer();
    expect(game.state).toMatchObject({ round: 2, dealer: 1 });
  });

  it('lets the computer bet and turn its cards over', () => {
    const game = testGame(plugin, ['a', 'b'], { options: { bots: 1 }, bots: ['b'] });
    const move = game.bot('b') as { event: string; payload: { amount: number } };
    expect(move.event).toBe('bet');
    game.send('b', 'bet', move.payload);
    expect(game.bot('b')).toEqual({ event: 'reveal' });
    expect(game.bot('a')).toEqual({ event: 'reveal' });
  });
});
