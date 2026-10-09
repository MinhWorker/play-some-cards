import { seededRng, testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { legalMoves, optionsSchema, squareOf } from './model.js';

const start = (players = ['a', 'b']) => testGame(plugin, players);
const roll = (game: ReturnType<typeof start>, value: number) => game.command(`roll-dice ${value}`);

// All fixtures go through the same SDK command parser used by the sandbox's dev console.
describe('co-ca-ngua', () => {
  it('starts with four horses each and opposite colors for two players', () => {
    const game = start();
    expect(game.state.colors).toEqual([0, 2]);
    expect(game.state.horses.flat().every((h) => h.position === -1 && !h.finished)).toBe(true);
    expect(start(['a', 'b', 'c', 'd']).state.colors).toEqual([0, 1, 2, 3]);
    expect(game.timer).toEqual({ event: 'timeout', ms: 30_000 });
  });

  it('uses seeded server randomness and refuses forged dice and invalid input', () => {
    const game = start();
    const expected = 1 + Math.floor(seededRng(1)() * 6);
    expect(game.error('b', 'roll')).toBe('Chưa tới lượt bạn');
    expect(game.error('a', 'move', { horse: 0 })).toBe('Hãy tung xúc xắc trước');
    expect(game.error('a', 'move', { horse: 4 })).toBe('Nước đi không hợp lệ');
    expect(game.error('a', 'roll', { value: 6 })).toBe('Nước đi không hợp lệ');
    game.send('a', 'roll');
    expect(game.state.dice).toBe(expected);
    expect(game.error('a', 'roll')).toBe('Chưa thể tung xúc xắc');
  });

  it.each([1, 6])('lets %i leave the paddock and awards only six a repeat turn', (dice) => {
    const game = roll(start(), dice);
    expect(legalMoves(game.state).map((m) => m.horse)).toEqual([0, 1, 2, 3]);
    game.send('a', 'move', { horse: 0 });
    expect(game.state.horses[0]?.[0]?.position).toBe(0);
    expect(game.state.phase).toBe('pause');
    expect(game.error('a', 'move', { horse: 1 })).toBe('Hãy tung xúc xắc trước');
    game.fireTimer();
    expect(game.state.turn).toBe(dice === 6 ? 0 : 1);
    expect(game.state.dice).toBeNull();
  });

  it('automatically passes when no horse can move', () => {
    const game = roll(start(), 4);
    expect(legalMoves(game.state)).toEqual([]);
    expect(game.state.notice).toBe('Không có nước đi');
    game.fireTimer();
    expect(game.state.turn).toBe(1);
  });

  it('blocks jumping over either color and landing on a teammate', () => {
    for (const blocker of ['0 1 2', '1 0 28']) {
      const game = start().command(`set-horse 0 0 0; set-horse 0 2 10; set-horse ${blocker}`);
      roll(game, 3);
      expect(game.error('a', 'move', { horse: 0 })).toBe('Ngựa này không đi được');
    }
    const own = start().command('set-horse 0 0 0; set-horse 0 1 3');
    roll(own, 3);
    expect(legalMoves(own.state).some((m) => m.horse === 0)).toBe(false);
  });

  it('kicks an opponent at the destination back into its paddock, including start squares', () => {
    const game = start().command('set-horse 0 0 0; set-horse 1 0 29');
    roll(game, 3).send('a', 'move', { horse: 0 });
    expect(game.state.horses[0]?.[0]?.position).toBe(3);
    expect(game.state.horses[1]?.[0]?.position).toBe(-1);
    expect(game.state.lastMove?.capture).toEqual({ seat: 1, horse: 0 });
    const spawn = start().command('set-horse 1 0 26');
    roll(spawn, 1).send('a', 'move', { horse: 2 });
    expect(spawn.state.horses[1]?.[0]?.position).toBe(-1);
  });

  it('wraps the shared track while keeping each color’s own gate', () => {
    const game = start().command('set-horse 1 0 30');
    expect(squareOf(game.state, 1, 30)).toBe(4);
    game.state.turn = 1;
    roll(game, 5).send('b', 'move', { horse: 0 });
    expect(game.state.horses[1]?.[0]?.position).toBe(35);
  });

  it('must reach the gate exactly before entering the numbered home lane', () => {
    const game = start().command('set-horse 0 0 49');
    roll(game, 3);
    expect(legalMoves(game.state).some((m) => m.horse === 0)).toBe(false);
    const exact = start().command('set-horse 0 0 49');
    roll(exact, 2).send('a', 'move', { horse: 0 });
    expect(exact.state.horses[0]?.[0]?.position).toBe(51);
    const home = start().command('set-horse 0 0 51');
    roll(home, 4).send('a', 'move', { horse: 0 });
    expect(home.state.horses[0]?.[0]).toEqual({ position: 55, finished: false });
  });

  it('promotes one home square only on its printed number, without jumping a horse', () => {
    const game = start().command('set-horse 0 0 53');
    roll(game, 2);
    expect(legalMoves(game.state).some((m) => m.horse === 0)).toBe(false);
    const next = start().command('set-horse 0 0 53');
    roll(next, 3).send('a', 'move', { horse: 0 });
    expect(next.state.horses[0]?.[0]?.position).toBe(54);
    const blocked = start().command('set-horse 0 0 51; set-horse 0 1 53');
    roll(blocked, 6);
    expect(legalMoves(blocked.state).some((m) => m.horse === 0)).toBe(false);
  });

  it('parks the four horses in order 6, 5, 4, 3 and wins only after all four', () => {
    const game = start();
    for (const [horse, value] of [6, 5, 4, 3].entries()) {
      // Give both colors a fresh roll without altering finished horses.
      game.state.turn = 0;
      game.state.phase = 'roll';
      game.command(`set-horse 0 ${horse} 51`);
      roll(game, value).send('a', 'move', { horse });
      expect(game.state.horses[0]?.[horse]).toEqual({ position: 51 + value, finished: true });
      expect(game.result).toEqual(horse === 3 ? { winners: ['a'] } : null);
      expect(legalMoves(game.state).some((m) => m.horse === horse)).toBe(false);
    }
    expect(game.timer).toBeNull();
    game.newGame();
    expect(game.result).toBeNull();
    expect(game.state.horses.flat().every((h) => h.position === -1 && !h.finished)).toBe(true);
  });

  const ranked = (players = ['a', 'b', 'c', 'd']) =>
    testGame(plugin, players, { options: { mode: 'ranked' } });
  const complete = (game: ReturnType<typeof start>, seat: number) => {
    for (const [horse, value] of [6, 5, 4, 3].entries()) {
      game.state.turn = seat;
      game.state.phase = 'roll';
      game.command(`set-horse ${seat} ${horse} 51`);
      roll(game, value).send(['a', 'b', 'c', 'd'][seat] ?? 'a', 'move', { horse });
    }
  };

  it('defaults existing rooms to normal mode and validates the ranking option', () => {
    expect(optionsSchema.parse({})).toEqual({ bots: 0, mode: 'normal' });
    expect(optionsSchema.safeParse({ mode: 'other' }).success).toBe(false);
  });

  it('ranks finishers in order, continues their opponents, and assigns the last seat', () => {
    const game = ranked();
    complete(game, 2);
    expect(game.state.rankings).toEqual([2]);
    expect(game.result).toBeNull();
    expect(game.state.winner).toBeNull();
    expect(game.bot('c')).toBeNull();
    game.fireTimer();
    expect(game.state.turn).toBe(3);
    roll(game, 2).fireTimer();
    expect(game.state.turn).toBe(0);
    expect(legalMoves(roll(game, 1).state)).toHaveLength(4);
    game.send('a', 'move', { horse: 0 }).fireTimer();
    expect(game.state.turn).toBe(1);
    roll(game, 2).fireTimer();
    expect(game.state.turn).toBe(3);
    complete(game, 0);
    expect(game.state.rankings).toEqual([2, 0]);
    expect(game.result).toBeNull();
    complete(game, 3);
    expect(game.state.rankings).toEqual([2, 0, 3, 1]);
    expect(game.state.winner).toBe(2);
    expect(game.result).toEqual({ winners: ['c'] });
    expect(game.timer).toBeNull();
    game.newGame();
    expect(game.state.rankings).toEqual([]);
    expect(game.result).toBeNull();
  });

  it('ends a two-player ranked match once both places can be determined', () => {
    const game = ranked(['a', 'b']);
    complete(game, 1);
    expect(game.state.rankings).toEqual([1, 0]);
    expect(game.result).toEqual({ winners: ['b'] });
  });

  it('keeps a finisher’s rank and horses when they leave, without giving the survivor first place', () => {
    const game = ranked(['a', 'b', 'c']);
    complete(game, 0);
    const parked = game.state.horses[0];
    game.leave('a');
    expect(game.result).toBeNull();
    expect(game.state.horses[0]).toEqual(parked);
    expect(game.state.rankings).toEqual([0]);
    game.leave('b');
    expect(game.state.rankings).toEqual([0, 2]);
    expect(game.result).toEqual({ winners: ['a'] });
    expect(game.state.horses[1]?.every((h) => h.position === -1)).toBe(true);
  });

  it('skips an unfinished leaver and ranks only the remaining players', () => {
    const game = ranked();
    game.leave('b');
    complete(game, 0);
    expect(game.result).toBeNull();
    game.fireTimer();
    expect(game.state.turn).toBe(2);
    complete(game, 2);
    expect(game.state.rankings).toEqual([0, 2, 3]);
    expect(game.result).toEqual({ winners: ['a'] });
  });

  it('uses the timeout for a roll or a legal move, and offers bots the same actions', () => {
    const game = start().command('set-horse 0 0 10');
    expect(game.bot('b')).toBeNull();
    expect(game.bot('a')).toEqual({ event: 'roll' });
    game.fireTimer();
    expect(game.state.phase).toBe('choose');
    expect(game.bot('a')?.event).toBe('move');
    game.fireTimer();
    expect(game.state.moves).toBe(1);
    expect(game.state.phase).toBe('pause');
    expect(game.bot('a')).toBeNull();
  });

  it('continues after a leaver, clears their horses and finishes with the last survivor', () => {
    const game = start(['a', 'b', 'c']).command('set-horse 0 0 2; set-horse 1 0 8');
    game.leave('a');
    expect(game.state.turn).toBe(1);
    expect(game.state.horses[0]?.every((h) => h.position === -1)).toBe(true);
    expect(game.result).toBeNull();
    game.leave('c');
    expect(game.result).toEqual({ winners: ['b'] });
    expect(game.state.winner).toBe(1);
  });

  it.each(['normal', 'ranked'] as const)(
    'can play a complete seeded %s match through bots and timers',
    (mode) => {
      const game = testGame(plugin, ['a', 'b', 'c', 'd'], { options: { mode } });
      for (let events = 0; !game.result && events < 20_000; events++) {
        const player = ['a', 'b', 'c', 'd'][game.state.turn] ?? 'a';
        const action = game.bot(player);
        if (action) game.send(player, action.event, action.payload as object);
        else game.fireTimer();
        for (const team of game.state.horses) {
          const onBoard = team.filter((h) => h.position >= 0).map((h) => h.position);
          expect(new Set(onBoard).size).toBe(onBoard.length);
        }
      }
      expect(game.result?.winners).toHaveLength(1);
      if (mode === 'ranked') expect(new Set(game.state.rankings).size).toBe(4);
    },
  );
});
