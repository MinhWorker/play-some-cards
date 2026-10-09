import { seededRng, testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { botShot } from './bot.js';
import { CELLS, FLEET, type Options, type Ship, type View } from './model.js';
import { fleetError, isSunk, randomFleet, shipAt } from './rules.js';

/** A fleet along the top rows: ship i on row 2i from column 0 (legal with spacing). */
const ROWS: Ship[] = FLEET.map((length, i) => shipAt(2 * i, 0, length, false) as Ship);

const fresh = (options: Partial<Options> = {}, bots: string[] = []) =>
  testGame(plugin, ['a', 'b'], { options, bots });

/** A game past setup, both fleets on the top rows. */
function battle(options: Partial<Options> = {}) {
  const game = fresh(options);
  game.send('a', 'arrange', { ships: ROWS });
  game.send('b', 'arrange', { ships: ROWS });
  game.send('a', 'ready');
  game.send('b', 'ready');
  return game;
}

describe('battleship fleets', () => {
  it('places random fleets that follow the rules', () => {
    const rng = seededRng(3);
    for (let i = 0; i < 50; i++) {
      expect(fleetError(randomFleet(rng, true), true)).toBeNull();
      expect(fleetError(randomFleet(rng, false), false)).toBeNull();
    }
  });

  it('refuses fleets with the wrong ships, bent ships, overlaps and touching ships', () => {
    expect(fleetError(ROWS, true)).toBeNull();
    expect(fleetError(ROWS.slice(1), true)).toBe('Hạm đội không đúng số tàu');
    const bent = [...ROWS.slice(0, 4), { cells: [80, 91] }];
    expect(fleetError(bent, true)).toBe('Tàu phải nằm thẳng hàng trong vùng biển');
    const wrapped = [...ROWS.slice(0, 4), { cells: [89, 90] }];
    expect(fleetError(wrapped, true)).toBe('Tàu phải nằm thẳng hàng trong vùng biển');
    const touching = [...ROWS.slice(0, 4), shipAt(7, 2, 2, false) as Ship];
    expect(fleetError(touching, true)).toBe('Các tàu không được nằm sát nhau');
    const close = [ROWS[0], shipAt(1, 5, 4, false), ...ROWS.slice(2)] as Ship[];
    expect(fleetError(close, true)).toBe('Các tàu không được nằm sát nhau');
    expect(fleetError(close, false)).toBeNull();
    const overlap = [ROWS[0], shipAt(0, 1, 4, true), ...ROWS.slice(2)] as Ship[];
    expect(fleetError(overlap, false)).toBe('Các tàu không được chồng lên nhau');
  });
});

describe('battleship', () => {
  it('starts in setup with random fleets, and fights once both are ready', () => {
    const game = fresh();
    expect(game.state).toMatchObject({ phase: 'setup', ready: [false, false], turn: 0 });
    expect(fleetError(game.state.fleets[0], true)).toBeNull();
    game.send('a', 'ready');
    expect(game.error('a', 'shuffle')).toBe('Bạn đã sẵn sàng');
    expect(game.error('a', 'fire', { cell: 0 })).toBe('Chưa vào trận');
    game.send('b', 'shuffle');
    game.send('b', 'ready');
    expect(game.state.phase).toBe('battle');
    expect(game.error('b', 'arrange', { ships: ROWS })).toBe('Trận đã bắt đầu');
  });

  it('keeps each fleet secret, arranging included', () => {
    const game = fresh();
    game.send('b', 'arrange', { ships: ROWS });
    const mine = game.view('b') as View;
    expect(mine.waters[1].ships).toEqual(ROWS);
    const theirs = game.view('a') as View;
    expect(theirs.waters[1].ships).toEqual([]);
    expect(theirs).not.toHaveProperty('fleets');
    expect((game.view(null) as View).waters[0].ships).toEqual([]);
    game.assertHidden('a', game.state.fleets[1]);
  });

  it('hits, misses and sinks; a hit earns another shot', () => {
    const game = battle();
    game.send('a', 'fire', { cell: 0 });
    expect(game.state.last).toEqual({ by: 0, cell: 0, hit: true, sunk: null });
    expect(game.state.turn).toBe(0);
    expect(game.error('a', 'fire', { cell: 0 })).toBe('Ô này đã bắn rồi');
    game.send('a', 'fire', { cell: 99 });
    expect(game.state).toMatchObject({ turn: 1, last: { hit: false } });
    expect(game.error('a', 'fire', { cell: 5 })).toBe('Chưa tới lượt bạn');
    game.send('b', 'fire', { cell: 50 });
    for (const at of [1, 2, 3]) game.send('a', 'fire', { cell: at });
    game.send('a', 'fire', { cell: 4 });
    expect(game.state.last?.sunk).toEqual([0, 1, 2, 3, 4]);
    const seen = (game.view('b') as View).waters[1];
    expect(seen.sunk).toEqual([5]);
    expect(seen.shots.filter((s) => s.hit)).toHaveLength(5);
  });

  it('passes the turn after every shot when hits earn nothing', () => {
    const game = battle({ bonus: false });
    game.send('a', 'fire', { cell: 0 });
    expect(game.state.turn).toBe(1);
  });

  it('ends when a whole fleet is sunk, and shows both fleets then', () => {
    const game = battle();
    for (const ship of ROWS) for (const at of ship.cells) game.send('a', 'fire', { cell: at });
    expect(game.state.end).toEqual({ reason: 'sunk', winner: 0 });
    expect(game.result).toEqual({ winners: ['a'] });
    expect((game.view('a') as View).waters[1].ships).toHaveLength(5);
  });

  it('gives the game to the other side on resigning or leaving', () => {
    const resigned = battle().send('a', 'resign');
    expect(resigned.state.end).toEqual({ reason: 'resign', winner: 1 });
    expect(resigned.result).toEqual({ winners: ['b'] });
    const left = fresh().leave('b');
    expect(left.state.end).toEqual({ reason: 'left', winner: 0 });
  });

  it('lets the computer get ready at once and fire only on its turn', () => {
    const game = fresh({ opponent: 'bot' }, ['b']);
    expect(game.bot('b')).toEqual({ event: 'ready' });
    game.send('b', 'ready');
    expect(game.bot('b')).toBeNull();
    game.send('a', 'ready');
    expect(game.bot('b')).toBeNull(); // a fires first
    // Fire until a miss hands the turn over (hits earn another shot).
    for (let at = 0; game.state.turn === 0; at++) game.send('a', 'fire', { cell: at });
    const shot = game.bot('b') as { event: string; payload: { cell: number } };
    expect(shot.event).toBe('fire');
    expect(game.error('b', 'fire', shot.payload)).toBeNull();
  });

  it('sinks a whole fleet in fewer shots the stronger it plays', () => {
    const average = (level: 'easy' | 'normal' | 'hard') => {
      let total = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const rng = seededRng(seed);
        const fleet = randomFleet(rng, true);
        const shots: { cell: number; hit: boolean }[] = [];
        const fired: number[] = [];
        while (!fleet.every((s) => isSunk(s, fired))) {
          const sunk = fleet.filter((s) => isSunk(s, fired));
          const at = botShot({ shots, sunk, spacing: true }, rng, level);
          expect(fired).not.toContain(at);
          fired.push(at);
          shots.push({ cell: at, hit: fleet.some((s) => s.cells.includes(at)) });
          expect(fired.length).toBeLessThanOrEqual(CELLS);
        }
        total += fired.length;
      }
      return total / 12;
    };
    const easy = average('easy');
    const normal = average('normal');
    const hard = average('hard');
    expect(normal).toBeLessThan(easy);
    expect(hard).toBeLessThan(normal);
    expect(hard).toBeLessThan(50);
  });
});
