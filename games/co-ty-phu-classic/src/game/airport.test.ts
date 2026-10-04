import { seededRng, testGame } from '@psc/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { BOARD } from './model.js';
import { move, resolveSpecialEvent } from './rules.js';

const atAirport = () => {
  const game = testGame(plugin, ['a', 'b']);
  game.state.after = 'end';
  move(game.state, 0, 20, false, 7);
  return game;
};
const fly = (target: number) => {
  const game = atAirport();
  const choice = target < 20 ? target : target - 1;
  resolveSpecialEvent(game.state, () => (choice + 0.5) / 39);
  return game;
};

describe('airport', () => {
  it('covers every other square without awarding money for crossing Start in flight', () => {
    const destinations = new Set<number>();
    for (let choice = 0; choice < 39; choice++) {
      const game = atAirport();
      expect(game.state.specialEvent?.kind).toBe('airport');
      expect(game.state.players[0]?.position).toBe(20);
      resolveSpecialEvent(game.state, () => (choice + 0.5) / 39);
      const position = game.state.players[0]!.position;
      destinations.add(position);
      expect(game.state.players[0]?.cash).toBe(position === 0 ? 1200 : 1000);
    }
    expect([...destinations]).toEqual(
      BOARD.flatMap((_, square) => (square === 20 ? [] : [square])),
    );
  });

  it('allows buying and building on the destination, preserving an extra roll', () => {
    expect(fly(3).state).toMatchObject({ phase: 'buy', pending: 3, after: 'end' });
    const game = atAirport();
    game.state.after = 'roll';
    game.state.properties[3]!.owner = 0;
    resolveSpecialEvent(game.state, () => 3.5 / 39);
    expect(game.state).toMatchObject({ phase: 'roll', buildable: 3, after: 'roll' });
  });

  it('charges fixed utility tax after confirming the destination and can enter debt', () => {
    const game = atAirport();
    game.state.properties[12]!.owner = 1;
    game.state.players[0]!.cash = 1;
    resolveSpecialEvent(game.state, () => 12.5 / 39);
    expect(game.state.specialEvent).toMatchObject({ kind: 'tax', amount: 100 });
    resolveSpecialEvent(game.state, () => 0);
    expect(game.state).toMatchObject({ phase: 'debt', debt: { amount: 100, creditor: null } });
    expect(game.state.players[0]?.cash).toBe(1);
  });

  it('continues destination taxes, cards and jail as separate confirmed events', () => {
    expect(fly(4).state.specialEvent).toMatchObject({ kind: 'tax', amount: 100 });
    const card = fly(17);
    expect(card.state.specialEvent).toMatchObject({ kind: 'card', deck: 'chest' });
    expect(BOARD[17]?.name).toBe('Khí vận');
    expect(fly(10).state.players[0]?.jailed).toBe(false);
    const jailed = fly(30);
    expect(jailed.state.specialEvent?.kind).toBe('jail');
    expect(jailed.state.players[0]?.position).toBe(30);
    jailed.send('a', 'confirm-event');
    expect(jailed.state.players[0]).toMatchObject({ position: 10, jailed: true });
  });

  it.each(['manual', 'timer'])('resolves a flight exactly once through %s confirmation', (mode) => {
    const rng = seededRng(1);
    for (let i = 0; i < 24; i++) rng();
    const sum = 2 + Math.floor(rng() * 6) + Math.floor(rng() * 6);
    const choice = Math.floor(rng() * 39);
    const target = choice >= 20 ? choice + 1 : choice;
    const game = testGame(plugin, ['a', 'b'], { seed: 1 });
    game.state.players[0]!.position = 20 - sum;
    game.send('a', 'roll');
    const id = game.state.specialEvent!.id;
    expect(game.state.players[0]?.position).toBe(20);
    expect(game.error('b', 'confirm-event')).toBe('Chưa tới lượt bạn');
    game.send('a', 'event-ready', { id });
    if (mode === 'timer') game.fireTimer();
    else game.send('a', 'confirm-event');
    expect(game.state.players[0]?.position).toBe(target);
    expect(game.error('a', 'event-ready', { id })).toBe('Sự kiện đã thay đổi');
    expect(game.state.specialEvent?.kind).not.toBe('airport');
  });
});
