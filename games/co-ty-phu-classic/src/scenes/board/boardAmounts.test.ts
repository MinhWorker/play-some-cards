import { testGame } from '@psc/sdk';
import { describe, expect, it } from 'vitest';
import { BOARD } from '../../game/model.js';
import { move } from '../../game/rules.js';
import plugin from '../../index.js';
import { boardAmounts } from './boardAmounts.js';

describe('board rent prices', () => {
  it('updates the displayed amount and the actual charge for every building level', () => {
    const game = testGame(plugin, ['a', 'b']);
    expect(boardAmounts(game.state)[1]).toBe('200');
    game.state.properties[1]!.owner = 0;
    for (const [level, amount] of BOARD[1]!.rent!.entries()) {
      game.state.properties[1]!.houses = level;
      expect(boardAmounts(game.state)[1]).toBe(String(amount));
      game.state.players[1]!.cash = 5000;
      const before = game.state.players.map((p) => p.cash);
      move(game.state, 1, 1, false, 4);
      expect(game.state.players.map((p) => p.cash)).toEqual([
        before[0]! + amount,
        before[1]! - amount,
      ]);
    }
    game.state.properties[1]!.houses = 4;
    expect(boardAmounts(game.state)[1]).toBe('800');
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
    for (const square of [1, 2, 18, 5, 15]) game.state.properties[square]!.owner = 0;
    expect(boardAmounts(game.state)[1]).toBe('40');
    expect(boardAmounts(game.state)[5]).toBe('100');
    expect(boardAmounts(game.state)[12]).toBe('100');
    game.state.properties[28]!.owner = 0;
    expect(boardAmounts(game.state)[12]).toBe('100');
    expect(boardAmounts(game.state)[4]).toBe('10%');
    expect(boardAmounts(game.state)[38]).toBe('10%');
  });

  it('keeps the payable tax amount on the board through confirmation and collection', () => {
    const game = testGame(plugin, ['a', 'b'], { seed: 1 });
    expect(boardAmounts(game.state)[4]).toBe('10%');
    game.state.players[0]!.position = 4;
    move(game.state, 0, 4, false, 7);
    game.send('a', 'confirm-event');
    expect(game.state.transfers).toEqual([
      { from: 0, to: null, amount: 100, reason: 'Thuế thu nhập' },
    ]);
    expect(boardAmounts(game.state)[4]).toBe('10%');
  });
});
