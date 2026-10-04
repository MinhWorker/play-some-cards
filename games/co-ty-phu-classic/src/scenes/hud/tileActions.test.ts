import { testGame } from '@psc/sdk';
import { expect, it } from 'vitest';
import { move } from '../../game/rules.js';
import plugin from '../../index.js';
import { tileActions } from './tileActions.js';

it('offers the next full station contribution only to its visitor with enough cash', () => {
  const game = testGame(plugin, ['a', 'b', 'c']);
  move(game.state, 0, 5, false, 7);
  expect(tileActions(game.state, 0, 5)).toEqual([
    { label: 'Góp 50 ₫', event: 'bid', payload: { amount: 50 } },
    { label: 'Từ bỏ', event: 'pass', payload: {} },
  ]);
  expect(tileActions(game.state, 1, 5)).toEqual([]);
  game.send('a', 'bid', { amount: 50 });
  expect(tileActions(game.state, 0, 5)).toEqual([]);
  move(game.state, 0, 5, false, 7);
  game.state.players[0]!.cash = 75;
  expect(tileActions(game.state, 0, 5)).toEqual([{ label: 'Từ bỏ', event: 'pass', payload: {} }]);
});

it('marks only the pending purchase and respects the buyer balance', () => {
  const game = testGame(plugin, ['a', 'b']);
  game.state.phase = 'buy';
  game.state.pending = 3;
  game.state.players[0]!.cash = 20;
  expect(tileActions(game.state, 0, 3).map((a) => a.event)).toEqual(['end-turn']);
  expect(tileActions(game.state, 0, 1)).toEqual([]);
  expect(tileActions(game.state, 1, 3)).toEqual([]);
});

it('offers one building on a return visit to a partial set, only to the current owner', () => {
  const game = testGame(plugin, ['a', 'b']);
  game.state.properties[1]!.owner = 0;
  expect(tileActions(game.state, 0, 1).map((a) => a.event)).toEqual(['auction', 'mortgage']);
  game.state.players[0]!.position = 1;
  game.state.buildable = 1;
  expect(tileActions(game.state, 0, 1).map((a) => a.event)).toEqual([
    'build',
    'auction',
    'mortgage',
  ]);
  game.state.properties[1]!.houses = 1;
  game.state.buildable = null;
  expect(tileActions(game.state, 0, 1).map((a) => a.event)).toEqual([
    'sell-house',
    'auction',
    'mortgage',
  ]);
  expect(tileActions(game.state, 0, 3)).toEqual([]);
  game.state.buildable = 1;
  game.state.turn = 1;
  expect(tileActions(game.state, 0, 1).map((a) => a.event)).toEqual(['sell-house']);
});

it('does not offer redemption below the exact server price', () => {
  const game = testGame(plugin, ['a', 'b']);
  game.state.properties[5]!.owner = 0;
  game.state.properties[5]!.mortgaged = true;
  game.state.players[0]!.cash = 109;
  expect(tileActions(game.state, 0, 5).map((a) => a.event)).toEqual(['auction']);
  game.state.players[0]!.cash = 110;
  expect(tileActions(game.state, 0, 5).map((a) => a.event)).toEqual(['auction', 'redeem']);
});

it('offers mortgage and redemption remotely only to the current manager', () => {
  const game = testGame(plugin, ['a', 'b']);
  game.state.properties[1]!.owner = 0;
  game.state.players[0]!.position = 10;
  expect(tileActions(game.state, 0, 1).map((a) => a.event)).toEqual(['auction', 'mortgage']);
  game.send('a', 'mortgage', { square: 1 });
  expect(tileActions(game.state, 0, 1).map((a) => a.event)).toEqual(['auction', 'redeem']);
  game.state.turn = 1;
  expect(tileActions(game.state, 0, 1)).toEqual([]);
});

it('uses the same 20% bid steps for resale of streets and owned stations', () => {
  for (const square of [3, 5]) {
    const game = testGame(plugin, ['a', 'b']);
    game.state.properties[square]!.owner = 0;
    game.send('a', 'auction', { square });
    const actions = tileActions(game.state, 1, square);
    expect(actions.filter((a) => a.event === 'bid').map((a) => a.payload.amount)).toEqual(
      square === 3 ? [36, 72, 108] : [40, 80, 120],
    );
    expect(actions.at(-1)?.event).toBe('pass');
    expect(tileActions(game.state, 0, square)).toEqual([]);
  }
});
