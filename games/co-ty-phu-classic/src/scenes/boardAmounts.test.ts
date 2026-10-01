import { testGame } from '@psc/sdk';
import { describe, expect, it } from 'vitest';
import { move } from '../game/rules.js';
import plugin from '../index.js';
import { boardAmounts } from './boardAmounts.js';

describe('board rent prices', () => {
  it('updates the displayed amount and the actual charge for every building level', () => {
    const game = testGame(plugin, ['a', 'b']);
    expect(boardAmounts(game.state)[1]).toBe('60');
    game.state.properties[1]!.owner = 0;
    for (const [level, amount] of [2, 10, 30, 90, 160, 250].entries()) {
      game.state.properties[1]!.houses = level;
      expect(boardAmounts(game.state)[1]).toBe(String(amount));
      const before = game.state.players.map((p) => p.cash);
      move(game.state, 1, 1, false, 4);
      expect(game.state.players.map((p) => p.cash)).toEqual([
        before[0]! + amount,
        before[1]! - amount,
      ]);
    }
    game.state.properties[1]!.houses = 4;
    expect(boardAmounts(game.state)[1]).toBe('160');
    game.state.players[0]!.jailed = true;
    expect(boardAmounts(game.state)[1]).toBe('0');
    const before = game.state.players.map((p) => p.cash);
    move(game.state, 1, 1, false, 4);
    expect(game.state.players.map((p) => p.cash)).toEqual(before);
    game.state.players[0]!.jailed = false;
    game.state.properties[1]!.mortgaged = true;
    expect(boardAmounts(game.state)[1]).toBe('0');
    move(game.state, 1, 1, false, 4);
    expect(game.state.players.map((p) => p.cash)).toEqual(before);
  });

  it('shows shared ownership rent, utility multipliers and tax amounts', () => {
    const game = testGame(plugin, ['a', 'b']);
    for (const square of [1, 3, 5, 15, 12]) game.state.properties[square]!.owner = 0;
    expect(boardAmounts(game.state)[1]).toBe('4');
    expect(boardAmounts(game.state)[5]).toBe('50');
    expect(boardAmounts(game.state)[12]).toBe('4×');
    game.state.properties[28]!.owner = 0;
    expect(boardAmounts(game.state)[12]).toBe('10×');
    expect(boardAmounts(game.state)[4]).toBe('200');
    expect(boardAmounts(game.state)[38]).toBe('100');
  });

  it('keeps the payable tax amount on the board through confirmation and collection', () => {
    const game = testGame(plugin, ['a', 'b'], { seed: 1 });
    expect(boardAmounts(game.state)[4]).toBe('200');
    game.send('a', 'roll');
    expect(game.state.players[0]!.position).toBe(4);
    game.send('a', 'confirm-event');
    expect(game.state.transfers).toEqual([
      { from: 0, to: null, amount: 200, reason: 'Thuế thu nhập' },
    ]);
    expect(boardAmounts(game.state)[4]).toBe('200');
  });
});
