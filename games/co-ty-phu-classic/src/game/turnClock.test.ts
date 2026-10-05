import { seededRng, testGame } from '@psc/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';

const gameAt = (square: number, cash = 1000) => {
  const game = testGame(plugin, ['a', 'b'], { options: { turnSeconds: 15 }, seed: 1 });
  const rng = seededRng(1);
  for (let i = 0; i < 24; i++) rng();
  const sum = 2 + Math.floor(rng() * 6) + Math.floor(rng() * 6);
  game.state.players[0]!.position = (square - sum + 40) % 40;
  game.state.players[0]!.cash = cash;
  return game;
};

describe('PvP turn clock', () => {
  it('automatically rolls, buys and ends an inactive player’s turn', () => {
    const game = gameAt(3);
    expect(game.timer).toEqual({ event: 'turn-timeout', ms: 15000 });
    game.fireTimer();
    expect(game.state.phase).toBe('buy');
    expect(game.state.lastAutoAction).toMatchObject({ seat: 0, event: 'roll' });
    game.fireTimer();
    expect(game.state.properties[3]!.owner).toBe(0);
    expect(game.state.phase).toBe('end');
    game.fireTimer();
    expect(game.state.turn).toBe(1);
    expect(game.state.phase).toBe('roll');
    expect(game.timer).toEqual({ event: 'turn-timeout', ms: 15000 });
    expect(game.error('a', 'turn-timeout')).toBeTruthy();
  });

  it('ends the turn when a timed-out buyer cannot afford the property', () => {
    const game = gameAt(8, 1);
    game.send('a', 'roll');
    game.fireTimer();
    expect(game.state.phase).toBe('roll');
    expect(game.state.turn).toBe(1);
    expect(game.state.auction).toBeNull();
    expect(game.state.properties[8]!.owner).toBeNull();
    expect(game.state.lastAutoAction).toMatchObject({ seat: 0, event: 'end-turn' });
  });

  it('declines an unanswered trade instead of accepting someone’s assets', () => {
    const game = gameAt(3);
    game.send('a', 'offer-trade', { to: 1, give: -1, take: -1, giveCash: 50, takeCash: 0 });
    game.fireTimer();
    expect(game.state.trade).toBeNull();
    expect(game.state.phase).toBe('roll');
    expect(game.state.players.map((p) => p.cash)).toEqual([1000, 1000]);
    expect(game.state.lastAutoAction).toMatchObject({ seat: 1, event: 'decline-trade' });
  });

  it('liquidates enough assets and pays debt in one expiration', () => {
    const game = gameAt(39, 1);
    game.state.properties[1] = { owner: 0, houses: 2, mortgaged: false };
    game.state.properties[3]!.owner = 0;
    game.send('a', 'roll');
    game.send('a', 'confirm-event');
    expect(game.state.phase).toBe('debt');
    game.fireTimer();
    expect(game.state.phase).toBe('end');
    expect(game.state.debt).toBeNull();
    expect(game.state.players[0]!.bankrupt).toBe(false);
    expect(game.state.properties[1]!.houses).toBe(0);
    expect(game.state.properties[1]!.mortgaged).toBe(true);
    expect(game.state.properties[3]!.mortgaged).toBe(false);
    expect(game.state.transfers).toHaveLength(4);
    expect(game.state.players[0]!.cash).toBe(1);
  });

  it('declares insolvency when no assets can cover the debt and ends the game', () => {
    const game = gameAt(39, 1);
    game.send('a', 'roll');
    game.send('a', 'confirm-event');
    game.fireTimer();
    expect(game.state.players[0]!.bankrupt).toBe(true);
    expect(game.result?.winners).toEqual(['b']);
    expect(game.timer).toBeNull();
  });

  it('does not restart a deadline for optional property management', () => {
    const options = plugin.room!.options.parse({ turnSeconds: 60 });
    const rules = plugin.rules;
    let stored = rules.setup(['a', 'b'], seededRng(1), options);
    stored.state.properties[1]!.owner = 0;
    stored.state.properties[3]!.owner = 1;
    const before = rules.timer(stored);
    stored = rules.applyMove(
      stored,
      { event: 'mortgage', payload: { square: 1 } },
      'a',
      seededRng(1),
    );
    expect(rules.timer(stored)).toEqual(before);
    expect(before?.ms).toBe(60000);
  });

  it('does not time solo games, PvE games, or a bot decision', () => {
    expect(testGame(plugin, ['a']).timer).toBeNull();
    expect(testGame(plugin, ['a', 'b'], { bots: ['b'] }).timer).toBeNull();
    const botsTurn = testGame(plugin, ['a', 'b', 'c'], { bots: ['a'] });
    expect(botsTurn.timer).toBeNull();
    botsTurn.state.phase = 'end';
    botsTurn.send('a', 'end-turn');
    expect(botsTurn.timer?.event).toBe('turn-timeout');
  });

  it('keeps the separate 8-second event countdown then resumes the turn clock', () => {
    const game = gameAt(39);
    game.send('a', 'roll');
    expect(game.timer?.event).toBe('prepare-event');
    game.send('a', 'event-ready', { id: game.state.specialEvent!.id });
    expect(game.timer).toEqual({ event: 'auto-confirm-event', ms: 8000 });
    game.fireTimer();
    expect(game.state.players[0]!.cash).toBe(800);
    expect(game.timer).toEqual({ event: 'turn-timeout', ms: 15000 });
  });
});
