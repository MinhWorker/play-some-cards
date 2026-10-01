import { testGame } from '@psc/sdk';
import { expect, it } from 'vitest';
import plugin from '../index.js';
import { tileActions } from './tileActions.js';

it('marks only the pending purchase and respects the buyer balance', () => {
  const game = testGame(plugin, ['a', 'b']);
  game.state.phase = 'buy';
  game.state.pending = 3;
  game.state.players[0]!.cash = 20;
  expect(tileActions(game.state, 0, 3).map((a) => a.event)).toEqual(['auction']);
  expect(tileActions(game.state, 0, 1)).toEqual([]);
  expect(tileActions(game.state, 1, 3)).toEqual([]);
});

it('offers mortgage for a partial set and building only after completing the set', () => {
  const game = testGame(plugin, ['a', 'b']);
  game.state.properties[1]!.owner = 0;
  expect(tileActions(game.state, 0, 1).map((a) => a.event)).toEqual(['mortgage']);
  game.state.properties[3]!.owner = 0;
  expect(tileActions(game.state, 0, 1).map((a) => a.event)).toEqual(['build', 'mortgage']);
  game.state.properties[1]!.houses = 1;
  expect(tileActions(game.state, 0, 1).map((a) => a.event)).toEqual(['sell-house']);
  expect(tileActions(game.state, 0, 3).map((a) => a.event)).toEqual(['build']);
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
