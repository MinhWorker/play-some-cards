/** Console examples use the real hooks and catalogs, including normal card confirmation. */
import { testGame } from '@psc/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { catalogs } from './dev.js';
import { BOARD } from './model.js';

const setup = () => testGame(plugin, ['a', 'b']);
describe('tycoon dev commands', () => {
  it('sets exactly one roll and keeps the override hidden', () => {
    const game = setup();
    const before = game.state;
    game.command('dice 2 3');
    expect(before.devDice).toBeUndefined();
    expect(game.view('a')).not.toHaveProperty('devDice');
    game.send('a', 'roll');
    expect(game.state.dice).toEqual([2, 3]);
    expect(game.state.players[0]?.position).toBe(5);
    expect(game.state.devDice).toBeUndefined();
    expect(() => game.command('dice 1 0')).toThrow('từ 1 tới 6');
  });
  it('teleports a seat using a catalog reference without mutating the old state', () => {
    const game = setup();
    const before = game.state;
    game.command('tp 1 @square:san-bay');
    expect(game.state.players[1]?.position).toBe(20);
    expect(before.players[1]?.position).toBe(0);
    expect(game.state.phase).toBe(before.phase);
    expect(() => game.command('tp 3 2')).toThrow('Không có ghế');
    expect(() => game.command('tp 0 @square:sanbay')).toThrow('bấm Tab');
    expect(catalogs.square).toHaveLength(BOARD.length);
    expect(catalogs.square.map((c) => c.value)).toEqual(BOARD.map((_, i) => i));
  });
  it('sets cash with checked seat and amount', () => {
    const game = setup();
    const before = game.state;
    game.command('cash 1 700');
    expect(game.state.players[1]?.cash).toBe(700);
    expect(before.players[1]?.cash).toBe(1000);
    expect(() => game.command('cash 0 -1')).toThrow();
    expect(() => game.command('cash 3 10')).toThrow('Không có ghế');
  });
  it('draws a specified card and resolves it through the ordinary event hook', () => {
    const game = setup();
    const before = game.state;
    const cash = before.players[0]!.cash;
    game.command('card @card:chance-bank-interest');
    expect(game.state.specialEvent).toMatchObject({
      kind: 'card',
      card: { kind: 'cash', amount: 50 },
    });
    expect(before.specialEvent).toBeNull();
    expect(game.state.players[0]?.cash).toBe(cash);
    game.send('a', 'confirm-event');
    expect(game.state.players[0]?.cash).toBe(cash + 50);
    expect(game.state.chance).toHaveLength(before.chance.length);
    expect(new Set(game.state.chance).size).toBe(before.chance.length);
    game.command('card @card:chance-free');
    game.send('a', 'confirm-event');
    expect(() => game.command('card @card:chance-free')).toThrow('đang được người chơi giữ');
  });
});
