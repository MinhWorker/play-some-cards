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
  expect(tileActions(game.state, 0, 3).map((a) => a.event)).toEqual(['auction']);
  expect(tileActions(game.state, 0, 1)).toEqual([]);
  expect(tileActions(game.state, 1, 3)).toEqual([]);
});

it('offers one building on a return visit to a partial set, only to the current owner', () => {
  const game = testGame(plugin, ['a', 'b']);
  game.state.properties[1]!.owner = 0;
  expect(tileActions(game.state, 0, 1).map((a) => a.event)).toEqual(['mortgage']);
  game.state.players[0]!.position = 1;
  game.state.buildable = 1;
  expect(tileActions(game.state, 0, 1).map((a) => a.event)).toEqual(['build', 'mortgage']);
  game.state.properties[1]!.houses = 1;
  game.state.buildable = null;
  expect(tileActions(game.state, 0, 1).map((a) => a.event)).toEqual(['sell-house']);
  expect(tileActions(game.state, 0, 3)).toEqual([]);
  game.state.buildable = 1;
  game.state.turn = 1;
  expect(tileActions(game.state, 0, 1).map((a) => a.event)).toEqual(['sell-house']);
});

it('does not offer redemption below the exact server price', () => {
  const game = testGame(plugin, ['a', 'b']);
  game.state.properties[5]!.owner = 0;
  game.state.properties[5]!.mortgaged = true;
  game.state.players[0]!.cash = 110;
  expect(tileActions(game.state, 0, 5)).toEqual([]);
  game.state.players[0]!.cash = 111;
  expect(tileActions(game.state, 0, 5).map((a) => a.event)).toEqual(['redeem']);
});
